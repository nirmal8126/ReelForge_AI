import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'
import { publishToPlatform } from '@/lib/social-publish'

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
      accessToken: account.accessToken,
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
