import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueQuoteJob } from '@/lib/queue'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const job = await prisma.quoteJob.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (job.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Only failed jobs can be retried' },
        { status: 400 }
      )
    }

    // Reset job status to QUEUED
    await prisma.quoteJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        errorMessage: null,
        progress: 0,
      },
    })

    // Re-enqueue the job
    await enqueueQuoteJob({
      quoteJobId: job.id,
      userId: job.userId,
      prompt: job.prompt,
      category: job.category,
      language: job.language,
      bgType: job.bgType,
      bgValue: job.bgValue || undefined,
      textColor: job.textColor,
      fontStyle: job.fontStyle,
      aspectRatio: job.aspectRatio,
      voiceId: job.voiceId || undefined,
      plan: session.user.plan || 'FREE',
    })

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (error) {
    console.error('Quote job retry error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
