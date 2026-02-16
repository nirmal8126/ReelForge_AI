import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueLongFormRecompose } from '@/lib/queue'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const job = await prisma.longFormJob.findFirst({
      where: { id: params.id, userId: session.user.id },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Only completed jobs can be recomposed' },
        { status: 400 }
      )
    }

    // Set status to RECOMPOSING
    await prisma.longFormJob.update({
      where: { id: job.id },
      data: {
        status: 'RECOMPOSING',
        progress: 0,
        errorMessage: null,
      },
    })

    // Enqueue recompose job
    await enqueueLongFormRecompose({
      longFormJobId: job.id,
      userId: job.userId,
      aspectRatio: job.aspectRatio,
      voiceId: job.voiceId || undefined,
      language: job.language,
      plan: session.user.plan || 'FREE',
    })

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (error) {
    console.error('Recompose error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
