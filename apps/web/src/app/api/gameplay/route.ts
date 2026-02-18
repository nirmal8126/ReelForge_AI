import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueGameplayJob } from '@/lib/queue'
import { checkModuleCredits } from '@/lib/module-config'
import { z } from 'zod'

const createGameplaySchema = z.object({
  template: z.enum(['ENDLESS_RUNNER', 'BALL_MAZE', 'OBSTACLE_TOWER', 'COLOR_SWITCH']),
  theme: z.enum(['neon', 'pastel', 'retro', 'dark', 'candy']).default('neon'),
  difficulty: z.enum(['easy', 'medium', 'hard', 'insane']).default('medium'),
  duration: z.number().int().min(15).max(60).default(30),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  musicStyle: z.enum(['upbeat', 'chill', 'intense', 'none']).default('upbeat'),
  gameTitle: z.string().max(100).optional(),
  showScore: z.boolean().default(true),
  ctaText: z.string().max(200).optional(),
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
      const statusMap: Record<string, string[]> = {
        completed: ['COMPLETED'],
        processing: ['QUEUED', 'CONFIG_GENERATING', 'RENDERING', 'ENCODING', 'UPLOADING'],
        failed: ['FAILED'],
      }

      const mappedStatuses = statusMap[status.toLowerCase()]
      if (mappedStatuses) {
        where.status = { in: mappedStatuses }
      }
    }

    const [jobs, total] = await Promise.all([
      prisma.gameplayJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.gameplayJob.count({ where }),
    ])

    return NextResponse.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('GET /api/gameplay error:', error)
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
    const data = createGameplaySchema.parse(body)

    // Check module pricing + credits
    const creditCheck = await checkModuleCredits(session.user.id, 'gameplay')
    if (!creditCheck.ok) {
      return NextResponse.json({ error: creditCheck.error }, { status: creditCheck.status })
    }

    // Create the gameplay job
    const gameplayJob = await prisma.gameplayJob.create({
      data: {
        userId: session.user.id,
        template: data.template,
        theme: data.theme,
        difficulty: data.difficulty,
        duration: data.duration,
        aspectRatio: data.aspectRatio,
        musicStyle: data.musicStyle,
        gameTitle: data.gameTitle || null,
        showScore: data.showScore,
        ctaText: data.ctaText || null,
        status: 'QUEUED',
        creditsCost: creditCheck.creditsCost,
      },
    })

    // Enqueue the job
    const queueJobId = await enqueueGameplayJob({
      gameplayJobId: gameplayJob.id,
      userId: session.user.id,
      template: data.template,
      theme: data.theme,
      difficulty: data.difficulty,
      duration: data.duration,
      aspectRatio: data.aspectRatio,
      musicStyle: data.musicStyle,
      gameTitle: data.gameTitle,
      showScore: data.showScore,
      ctaText: data.ctaText,
      plan: creditCheck.subscription.plan,
    })

    return NextResponse.json({
      id: gameplayJob.id,
      status: gameplayJob.status,
      queueJobId,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('POST /api/gameplay error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
