import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'

// ---------------------------------------------------------------------------
// Platform token exchange configuration
// ---------------------------------------------------------------------------

interface TokenConfig {
  tokenUrl: string
  clientIdEnv: string
  clientSecretEnv: string
  profileUrl?: string
  platformEnum: 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM'
}

const PLATFORM_TOKEN: Record<string, TokenConfig> = {
  youtube: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    profileUrl: 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    platformEnum: 'YOUTUBE',
  },
  facebook: {
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
    profileUrl: 'https://graph.facebook.com/v18.0/me?fields=id,name,picture',
    platformEnum: 'FACEBOOK',
  },
  instagram: {
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
    platformEnum: 'INSTAGRAM',
  },
}

// ---------------------------------------------------------------------------
// GET /api/social-accounts/callback/[platform] — handle OAuth callback
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin

  // Handle user denied access
  if (error) {
    return NextResponse.redirect(`${baseUrl}/social-accounts?error=${error}`)
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${baseUrl}/social-accounts?error=missing_params`)
  }

  // Decode state
  let state: { userId: string; platform: string; ts: number }
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
  } catch {
    return NextResponse.redirect(`${baseUrl}/social-accounts?error=invalid_state`)
  }

  // Verify state freshness (10 minute window)
  if (Date.now() - state.ts > 10 * 60 * 1000) {
    return NextResponse.redirect(`${baseUrl}/social-accounts?error=expired_state`)
  }

  const config = PLATFORM_TOKEN[platform]
  if (!config) {
    return NextResponse.redirect(`${baseUrl}/social-accounts?error=unsupported_platform`)
  }

  const clientId = process.env[config.clientIdEnv]
  const clientSecret = process.env[config.clientSecretEnv]

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseUrl}/social-accounts?error=not_configured`)
  }

  const redirectUri = `${baseUrl}/api/social-accounts/callback/${platform}`

  try {
    // Exchange code for token
    const tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Token exchange failed:', tokenData)
      return NextResponse.redirect(`${baseUrl}/social-accounts?error=token_exchange_failed`)
    }

    const accessToken = tokenData.access_token
    const refreshToken = tokenData.refresh_token || null
    const expiresIn = tokenData.expires_in
    const tokenExpiry = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null

    // Fetch profile info
    let accountId = ''
    let accountName = ''
    let accountAvatar: string | null = null

    if (platform === 'youtube' && config.profileUrl) {
      const profileRes = await fetch(config.profileUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const profileData = await profileRes.json()
      const channel = profileData.items?.[0]
      if (channel) {
        accountId = channel.id
        accountName = channel.snippet?.title || 'YouTube Channel'
        accountAvatar = channel.snippet?.thumbnails?.default?.url || null
      }
    } else if (platform === 'facebook' && config.profileUrl) {
      const profileRes = await fetch(`${config.profileUrl}&access_token=${accessToken}`)
      const profileData = await profileRes.json()
      accountId = profileData.id || ''
      accountName = profileData.name || 'Facebook Account'
      accountAvatar = profileData.picture?.data?.url || null

      // Also fetch pages the user manages
      try {
        const pagesRes = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
        )
        const pagesData = await pagesRes.json()

        // Save each page as a separate social account
        if (pagesData.data?.length) {
          for (const page of pagesData.data) {
            await prisma.socialAccount.upsert({
              where: {
                userId_platform_accountId: {
                  userId: state.userId,
                  platform: 'FACEBOOK',
                  accountId: page.id,
                },
              },
              create: {
                userId: state.userId,
                platform: 'FACEBOOK',
                accountId: page.id,
                accountName: `${page.name} (Page)`,
                accessToken: page.access_token,
                refreshToken: null,
                tokenExpiry: null,
                scopes: page.perms?.join(',') || null,
                isActive: true,
              },
              update: {
                accountName: `${page.name} (Page)`,
                accessToken: page.access_token,
                isActive: true,
              },
            })
          }
        }
      } catch (err) {
        console.error('Failed to fetch Facebook pages:', err)
      }
    } else if (platform === 'instagram') {
      // Instagram accounts are connected through Facebook pages
      try {
        const pagesRes = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
        )
        const pagesData = await pagesRes.json()

        if (pagesData.data?.length) {
          for (const page of pagesData.data) {
            // Get Instagram Business Account linked to this page
            const igRes = await fetch(
              `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${page.access_token}`
            )
            const igData = await igRes.json()
            const igAccount = igData.instagram_business_account

            if (igAccount) {
              accountId = igAccount.id
              accountName = igAccount.username || igAccount.name || 'Instagram Account'
              accountAvatar = igAccount.profile_picture_url || null

              await prisma.socialAccount.upsert({
                where: {
                  userId_platform_accountId: {
                    userId: state.userId,
                    platform: 'INSTAGRAM',
                    accountId: igAccount.id,
                  },
                },
                create: {
                  userId: state.userId,
                  platform: 'INSTAGRAM',
                  accountId: igAccount.id,
                  accountName: accountName,
                  accountAvatar: accountAvatar,
                  accessToken: page.access_token,
                  refreshToken: null,
                  tokenExpiry: null,
                  scopes: 'instagram_basic,instagram_content_publish',
                  isActive: true,
                },
                update: {
                  accountName: accountName,
                  accountAvatar: accountAvatar,
                  accessToken: page.access_token,
                  isActive: true,
                },
              })
            }
          }
        }

        // If we saved Instagram accounts via pages, redirect success
        if (accountId) {
          return NextResponse.redirect(`${baseUrl}/social-accounts?connected=${platform}`)
        }
      } catch (err) {
        console.error('Failed to fetch Instagram accounts:', err)
      }

      // Fallback if no Instagram business accounts found
      if (!accountId) {
        return NextResponse.redirect(`${baseUrl}/social-accounts?error=no_instagram_business`)
      }
    }

    // Fallback account ID
    if (!accountId) {
      accountId = `${platform}_${state.userId}_${Date.now()}`
      accountName = `${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`
    }

    // Upsert the main account
    await prisma.socialAccount.upsert({
      where: {
        userId_platform_accountId: {
          userId: state.userId,
          platform: config.platformEnum,
          accountId,
        },
      },
      create: {
        userId: state.userId,
        platform: config.platformEnum,
        accountId,
        accountName,
        accountAvatar,
        accessToken,
        refreshToken,
        tokenExpiry,
        scopes: tokenData.scope || null,
        isActive: true,
      },
      update: {
        accountName,
        accountAvatar,
        accessToken,
        refreshToken,
        tokenExpiry: tokenExpiry || undefined,
        scopes: tokenData.scope || undefined,
        isActive: true,
      },
    })

    return NextResponse.redirect(`${baseUrl}/social-accounts?connected=${platform}`)
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(`${baseUrl}/social-accounts?error=callback_failed`)
  }
}
