import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueQuoteJob } from '@/lib/queue'
import { z } from 'zod'

const createQuoteSchema = z.object({
  prompt: z.string().min(3, 'Prompt must be at least 3 characters').max(500),
  category: z.string().min(1).max(50),
  language: z.string().regex(/^[a-z]{2}$/).default('hi'),
  bgType: z.enum(['gradient', 'stock', 'ai']).default('gradient'),
  bgValue: z.string().max(500).optional(),
  textColor: z.string().max(10).default('#FFFFFF'),
  fontStyle: z.enum(['serif', 'sans', 'handwritten', 'bold']).default('serif'),
  aspectRatio: z.enum(['1:1', '9:16', '16:9']).default('1:1'),
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
        processing: ['QUEUED', 'TEXT_GENERATING', 'IMAGE_GENERATING', 'VOICE_GENERATING', 'COMPOSING', 'UPLOADING'],
        failed: ['FAILED'],
      }

      const mappedStatuses = statusMap[status.toLowerCase()]
      if (mappedStatuses) {
        where.status = { in: mappedStatuses }
      } else {
        // Allow direct status values
        const validStatuses = [
          'QUEUED', 'TEXT_GENERATING', 'IMAGE_GENERATING', 'VOICE_GENERATING',
          'COMPOSING', 'UPLOADING', 'COMPLETED', 'FAILED',
        ]
        if (validStatuses.includes(status.toUpperCase())) {
          where.status = status.toUpperCase()
        }
      }
    }

    const [quotes, total] = await Promise.all([
      prisma.quoteJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.quoteJob.count({ where }),
    ])

    return NextResponse.json({
      quotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('GET /api/quotes error:', error)
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
    const data = createQuoteSchema.parse(body)

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
            description: 'Quote generation (over quota)',
            balanceAfter: (user.creditsBalance - 1),
          },
        }),
      ])
    }

    // Create the quote job
    const quoteJob = await prisma.quoteJob.create({
      data: {
        userId: session.user.id,
        prompt: data.prompt,
        category: data.category,
        language: data.language,
        bgType: data.bgType,
        bgValue: data.bgValue || null,
        textColor: data.textColor,
        fontStyle: data.fontStyle,
        aspectRatio: data.aspectRatio,
        voiceId: data.voiceId || null,
        status: 'QUEUED',
        creditsCost: 1,
      },
    })

    // Enqueue the job to BullMQ
    const queueJobId = await enqueueQuoteJob({
      quoteJobId: quoteJob.id,
      userId: session.user.id,
      prompt: data.prompt,
      category: data.category,
      language: data.language,
      bgType: data.bgType,
      bgValue: data.bgValue,
      textColor: data.textColor,
      fontStyle: data.fontStyle,
      aspectRatio: data.aspectRatio,
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
      id: quoteJob.id,
      status: quoteJob.status,
      queueJobId,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('POST /api/quotes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
