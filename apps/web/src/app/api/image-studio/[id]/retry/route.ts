import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueImageStudioJob } from '@/lib/queue'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const job = await prisma.imageStudioJob.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Only failed jobs can be retried' },
        { status: 400 }
      )
    }

    // Reset job status to QUEUED
    await prisma.imageStudioJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        errorMessage: null,
        progress: 0,
      },
    })

    const imageUrls = Array.isArray(job.imageUrls) ? (job.imageUrls as string[]) : []

    // Re-enqueue the job
    await enqueueImageStudioJob({
      imageStudioJobId: job.id,
      userId: job.userId,
      mode: job.mode,
      imageUrls,
      prompt: job.prompt || undefined,
      title: job.title || undefined,
      language: job.language || undefined,
      voiceEnabled: job.voiceEnabled,
      voiceId: job.voiceId || undefined,
      aspectRatio: job.aspectRatio,
      transitionStyle: job.transitionStyle || 'fade',
      plan: session.user.plan || 'FREE',
    })

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (error) {
    console.error('Image studio job retry error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
