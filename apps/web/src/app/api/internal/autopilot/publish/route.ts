import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'
import { publishToPlatform } from '@/lib/social-publish'

// ---------------------------------------------------------------------------
// Auto-refresh expired OAuth tokens before publishing
// ---------------------------------------------------------------------------

async function refreshAccessTokenIfNeeded(account: {
  id: string
  platform: string
  accessToken: string
  refreshToken: string | null
  tokenExpiry: Date | null
}): Promise<string> {
  // If no expiry or not expired yet (with 5-min buffer), return current token
  if (account.tokenExpiry) {
    const buffer = 5 * 60 * 1000 // 5 minutes
    if (new Date(account.tokenExpiry).getTime() - buffer > Date.now()) {
      return account.accessToken
    }
  }

  // Token expired — try to refresh
  if (!account.refreshToken) {
    throw new Error(`${account.platform} token expired and no refresh token available. Please reconnect the account.`)
  }

  if (account.platform === 'YOUTUBE') {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: account.refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`YouTube token refresh failed: ${err}`)
    }

    const data = await res.json()
    const newAccessToken = data.access_token as string
    const expiresIn = (data.expires_in as number) || 3600

    // Update token in DB
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        accessToken: newAccessToken,
        tokenExpiry: new Date(Date.now() + expiresIn * 1000),
      },
    })

    return newAccessToken
  }

  // For other platforms, return existing token (Facebook long-lived tokens rarely expire)
  return account.accessToken
}

export async function POST(req: NextRequest) {
  // Verify worker secret
  const workerSecret = req.headers.get('x-worker-secret')
  if (!workerSecret || workerSecret !== process.env.WORKER_CALLBACK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    userId,
    socialAccountId,
    jobType,
    jobId,
    mediaUrl,
    title,
    isImage,
    textContent,
    format,
  } = body

  try {
    // Get the social account
    const account = await prisma.socialAccount.findFirst({
      where: {
        id: socialAccountId,
        userId,
        isActive: true,
      },
    })

    if (!account) {
      return NextResponse.json({
        success: false,
        error: 'Social account not found or inactive',
      })
    }

    // Refresh token if expired
    const accessToken = await refreshAccessTokenIfNeeded(account)

    // Create publish record
    const record = await prisma.publishRecord.create({
      data: {
        userId,
        socialAccountId: account.id,
        jobType,
        jobId,
        title: title || null,
        status: 'UPLOADING',
      },
    })

    // Publish to platform
    const result = await publishToPlatform(account.platform, {
      accessToken,
      accountId: account.accountId,
      videoUrl: mediaUrl,
      title: title || 'Untitled',
      format,
      isImage,
      textContent,
    })

    // Update publish record
    await prisma.publishRecord.update({
      where: { id: record.id },
      data: result.success
        ? {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            platformPostId: result.platformPostId || null,
            platformUrl: result.platformUrl || null,
          }
        : {
            status: 'FAILED',
            errorMessage: result.errorMessage || 'Unknown error',
          },
    })

    return NextResponse.json({
      success: result.success,
      platformPostId: result.platformPostId,
      platformUrl: result.platformUrl,
      error: result.errorMessage,
    })
  } catch (error) {
    console.error('Autopilot publish error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    })
  }
}
