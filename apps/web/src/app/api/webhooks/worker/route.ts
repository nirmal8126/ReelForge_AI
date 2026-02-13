import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

const workerCallbackSchema = z.object({
  reelJobId: z.string(),
  status: z.enum(['COMPLETED', 'FAILED']),
  outputUrl: z.string().url().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  processingTimeMs: z.number().int().positive().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    // Verify worker secret
    const workerSecret = req.headers.get('x-worker-secret')
    if (!workerSecret || workerSecret !== process.env.WORKER_CALLBACK_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid worker secret' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const {
      reelJobId,
      status,
      outputUrl,
      thumbnailUrl,
      processingTimeMs,
      errorMessage,
    } = workerCallbackSchema.parse(body)

    // Find the reel job
    const reelJob = await prisma.reelJob.findUnique({
      where: { id: reelJobId },
      select: {
        id: true,
        userId: true,
        channelProfileId: true,
        status: true,
      },
    })

    if (!reelJob) {
      return NextResponse.json(
        { error: 'Reel job not found' },
        { status: 404 }
      )
    }

    // Update the reel job
    await prisma.reelJob.update({
      where: { id: reelJobId },
      data: {
        status,
        outputUrl: outputUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        processingTimeMs: processingTimeMs || null,
        errorMessage: errorMessage || null,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    })

    // If completed, update the channel profile's total reels generated
    if (status === 'COMPLETED' && reelJob.channelProfileId) {
      await prisma.channelProfile.update({
        where: { id: reelJob.channelProfileId },
        data: {
          totalReelsGenerated: { increment: 1 },
        },
      })
    }

    console.log(
      `Worker callback: job=${reelJobId}, status=${status}, time=${processingTimeMs}ms`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Worker webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
