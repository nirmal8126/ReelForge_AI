import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Platform OAuth configuration
// ---------------------------------------------------------------------------

interface OAuthConfig {
  authUrl: string
  scopes: string[]
  clientIdEnv: string
}

const PLATFORM_OAUTH: Record<string, OAuthConfig> = {
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    clientIdEnv: 'GOOGLE_CLIENT_ID',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    scopes: [
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
    ],
    clientIdEnv: 'FACEBOOK_APP_ID',
  },
  instagram: {
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    scopes: [
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
    ],
    clientIdEnv: 'FACEBOOK_APP_ID',
  },
}

// ---------------------------------------------------------------------------
// GET /api/social-accounts/connect/[platform] — redirect to OAuth
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { platform } = await params

  const config = PLATFORM_OAUTH[platform]
  if (!config) {
    return NextResponse.json(
      { error: `Unsupported platform: ${platform}` },
      { status: 400 }
    )
  }

  const clientId = process.env[config.clientIdEnv]
  if (!clientId) {
    return NextResponse.json(
      { error: `${platform} OAuth is not configured` },
      { status: 500 }
    )
  }

  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin
  const redirectUri = `${baseUrl}/api/social-accounts/callback/${platform}`

  // State param includes userId for CSRF protection
  const state = Buffer.from(
    JSON.stringify({ userId: session.user.id, platform, ts: Date.now() })
  ).toString('base64url')

  const params2 = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  })

  const oauthUrl = `${config.authUrl}?${params2.toString()}`

  return NextResponse.redirect(oauthUrl)
}
