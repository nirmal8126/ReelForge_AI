import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueReelJob } from '@/lib/queue'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const job = await prisma.reelJob.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 })
    }

    if (job.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Only failed jobs can be retried' },
        { status: 400 }
      )
    }

    // Reset job status to QUEUED
    await prisma.reelJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        errorMessage: null,
      },
    })

    // Re-enqueue the job
    await enqueueReelJob({
      reelJobId: job.id,
      userId: job.userId,
      prompt: job.prompt,
      script: job.script || undefined,
      style: job.style || undefined,
      language: job.language || undefined,
      voiceId: job.voiceId || undefined,
      durationSeconds: job.durationSeconds,
      aspectRatio: job.aspectRatio,
      channelProfileId: job.channelProfileId || undefined,
      plan: session.user.plan || 'FREE',
    })

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (error) {
    console.error('Reel job retry error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
