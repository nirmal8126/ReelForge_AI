import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueGameplayJob } from '@/lib/queue'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const job = await prisma.gameplayJob.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Gameplay job not found' }, { status: 404 })
    }

    if (job.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Only failed jobs can be retried' },
        { status: 400 }
      )
    }

    // Reset job status to QUEUED
    await prisma.gameplayJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        errorMessage: null,
        progress: 0,
      },
    })

    // Re-enqueue the job
    await enqueueGameplayJob({
      gameplayJobId: job.id,
      userId: job.userId,
      template: job.template,
      theme: job.theme,
      difficulty: job.difficulty,
      duration: job.duration,
      aspectRatio: job.aspectRatio,
      musicStyle: job.musicStyle,
      gameTitle: job.gameTitle || undefined,
      showScore: job.showScore,
      ctaText: job.ctaText || undefined,
      plan: session.user.plan || 'FREE',
    })

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (error) {
    console.error('Gameplay job retry error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
