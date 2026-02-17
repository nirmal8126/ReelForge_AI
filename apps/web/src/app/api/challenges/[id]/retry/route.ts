import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueChallengeJob } from '@/lib/queue'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const job = await prisma.challengeJob.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    if (job.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Only failed jobs can be retried' },
        { status: 400 }
      )
    }

    // Reset job status to QUEUED
    await prisma.challengeJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        errorMessage: null,
        progress: 0,
      },
    })

    // Re-enqueue the job
    await enqueueChallengeJob({
      challengeJobId: job.id,
      userId: job.userId,
      challengeType: job.challengeType,
      category: job.category,
      difficulty: job.difficulty,
      numQuestions: job.numQuestions,
      timerSeconds: job.timerSeconds,
      language: job.language,
      prompt: job.prompt || undefined,
      templateStyle: job.templateStyle,
      voiceEnabled: job.voiceEnabled,
      voiceId: job.voiceId || undefined,
      plan: session.user.plan || 'FREE',
    })

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (error) {
    console.error('Challenge job retry error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
