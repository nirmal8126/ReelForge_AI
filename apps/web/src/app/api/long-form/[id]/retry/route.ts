import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueLongFormJob } from '@/lib/queue'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const job = await prisma.longFormJob.findFirst({
      where: {
        id: params.id,
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

    // Reset job status to QUEUED so the resumable pipeline picks it up
    await prisma.longFormJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        errorMessage: null,
        progress: 0,
      },
    })

    // Re-enqueue the job — the pipeline will skip already-completed stages
    await enqueueLongFormJob({
      longFormJobId: job.id,
      userId: job.userId,
      prompt: job.prompt,
      title: job.title,
      durationMinutes: job.durationMinutes,
      style: job.style || undefined,
      language: job.language,
      voiceId: job.voiceId || undefined,
      aspectRatio: job.aspectRatio,
      aiClipRatio: job.aiClipRatio || 0.3,
      useStockFootage: job.useStockFootage ?? true,
      useStaticVisuals: job.useStaticVisuals ?? true,
      publishToYouTube: job.publishToYouTube ?? false,
      channelProfileId: job.channelProfileId || undefined,
      plan: session.user.plan || 'FREE',
    })

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (error) {
    console.error('Long-form job retry error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
