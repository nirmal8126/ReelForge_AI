import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueChallengeJob } from '@/lib/queue'
import { z } from 'zod'

const createChallengeSchema = z.object({
  challengeType: z.enum(['emoji_guess', 'riddle', 'math', 'gk_quiz', 'would_you_rather']),
  category: z.string().min(1).max(50),
  difficulty: z.enum(['easy', 'medium', 'hard', 'impossible']).default('medium'),
  numQuestions: z.number().int().min(1).max(5).default(3),
  timerSeconds: z.number().int().min(5).max(15).default(5),
  language: z.string().regex(/^[a-z]{2}$/).default('hi'),
  prompt: z.string().max(500).optional(),
  templateStyle: z.enum(['neon', 'minimal', 'gameshow']).default('neon'),
  voiceEnabled: z.boolean().default(false),
  voiceId: z.string().max(100).optional(),
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
        processing: ['QUEUED', 'CONTENT_GENERATING', 'COMPOSING', 'UPLOADING'],
        failed: ['FAILED'],
      }

      const mappedStatuses = statusMap[status.toLowerCase()]
      if (mappedStatuses) {
        where.status = { in: mappedStatuses }
      }
    }

    const [challenges, total] = await Promise.all([
      prisma.challengeJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.challengeJob.count({ where }),
    ])

    return NextResponse.json({
      challenges,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('GET /api/challenges error:', error)
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
    const data = createChallengeSchema.parse(body)

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
            description: 'Challenge video generation (over quota)',
            balanceAfter: (user.creditsBalance - 1),
          },
        }),
      ])
    }

    // Create the challenge job
    const challengeJob = await prisma.challengeJob.create({
      data: {
        userId: session.user.id,
        challengeType: data.challengeType,
        category: data.category,
        difficulty: data.difficulty,
        numQuestions: data.numQuestions,
        timerSeconds: data.timerSeconds,
        language: data.language,
        prompt: data.prompt || null,
        templateStyle: data.templateStyle,
        voiceEnabled: data.voiceEnabled,
        voiceId: data.voiceId || null,
        status: 'QUEUED',
        creditsCost: 1,
      },
    })

    // Enqueue the job
    const queueJobId = await enqueueChallengeJob({
      challengeJobId: challengeJob.id,
      userId: session.user.id,
      challengeType: data.challengeType,
      category: data.category,
      difficulty: data.difficulty,
      numQuestions: data.numQuestions,
      timerSeconds: data.timerSeconds,
      language: data.language,
      prompt: data.prompt,
      templateStyle: data.templateStyle,
      voiceEnabled: data.voiceEnabled,
      voiceId: data.voiceId,
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
      id: challengeJob.id,
      status: challengeJob.status,
      queueJobId,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('POST /api/challenges error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
