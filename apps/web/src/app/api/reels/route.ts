import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueReelJob } from '@/lib/queue'
import { z } from 'zod'
import { REEL_DURATIONS, ASPECT_RATIOS } from '@/lib/constants'

const createReelSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(2000),
  title: z.string().min(1).max(255).optional(),
  script: z.string().optional(),
  style: z.string().max(100).optional(),
  language: z.string().regex(/^[a-z]{2}$/).default('en'),
  voiceId: z.string().max(100).optional(),
  durationSeconds: z.number().refine(
    (v) => (REEL_DURATIONS as readonly number[]).includes(v),
    'Invalid duration'
  ),
  aspectRatio: z.enum(ASPECT_RATIOS),
  channelProfileId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const status = searchParams.get('status')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { userId: session.user.id }

    if (status && status !== 'all') {
      const validStatuses = [
        'QUEUED', 'PROCESSING', 'SCRIPT_GENERATING', 'VOICE_GENERATING',
        'VIDEO_GENERATING', 'COMPOSING', 'UPLOADING', 'COMPLETED', 'FAILED',
      ]
      if (validStatuses.includes(status.toUpperCase())) {
        where.status = status.toUpperCase()
      }
    }

    const [reels, total] = await Promise.all([
      prisma.reelJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          channelProfile: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.reelJob.count({ where }),
    ])

    return NextResponse.json({
      reels,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('GET /api/reels error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = createReelSchema.parse(body)

    // Check subscription quota
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    })

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 403 })
    }

    const hasUnlimitedJobs = subscription.jobsLimit === -1
    const hasQuota = hasUnlimitedJobs || subscription.jobsUsed < subscription.jobsLimit

    if (!hasQuota) {
      // Check if user has credits as fallback
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { creditsBalance: true },
      })

      if (!user || user.creditsBalance < 1) {
        return NextResponse.json(
          { error: 'Monthly quota exceeded. Upgrade your plan or purchase credits.' },
          { status: 403 }
        )
      }

      // Deduct a credit
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.user.id },
          data: { creditsBalance: { decrement: 1 } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: session.user.id,
            amount: -1,
            type: 'JOB_DEBIT',
            description: 'Reel generation (over quota)',
            balanceAfter: (user.creditsBalance - 1),
          },
        }),
      ])
    }

    // Validate channel profile if provided
    if (data.channelProfileId) {
      const profile = await prisma.channelProfile.findFirst({
        where: { id: data.channelProfileId, userId: session.user.id },
      })
      if (!profile) {
        return NextResponse.json({ error: 'Channel profile not found' }, { status: 404 })
      }
    }

    // Generate title from prompt if not provided
    const title = data.title || data.prompt.slice(0, 80) + (data.prompt.length > 80 ? '...' : '')

    // Create the reel job
    const reelJob = await prisma.reelJob.create({
      data: {
        userId: session.user.id,
        title,
        prompt: data.prompt,
        script: data.script || null,
        style: data.style || null,
        language: data.language,
        voiceId: data.voiceId || null,
        durationSeconds: data.durationSeconds,
        aspectRatio: data.aspectRatio,
        channelProfileId: data.channelProfileId || null,
        status: 'QUEUED',
      },
    })

    // Enqueue the job to BullMQ
    const queueJobId = await enqueueReelJob({
      reelJobId: reelJob.id,
      userId: session.user.id,
      prompt: data.prompt,
      script: data.script,
      style: data.style,
      language: data.language,
      voiceId: data.voiceId,
      durationSeconds: data.durationSeconds,
      aspectRatio: data.aspectRatio,
      channelProfileId: data.channelProfileId,
      plan: subscription.plan,
    })

    // Increment jobs used on subscription (if not using credits)
    if (hasQuota) {
      await prisma.subscription.update({
        where: { userId: session.user.id },
        data: { jobsUsed: { increment: 1 } },
      })
    }

    return NextResponse.json({
      id: reelJob.id,
      title: reelJob.title,
      status: reelJob.status,
      queueJobId,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('POST /api/reels error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
