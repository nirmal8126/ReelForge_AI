import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueQuoteJob } from '@/lib/queue'
import { checkModuleCredits } from '@/lib/module-config'
import { z } from 'zod'

const createQuoteSchema = z.object({
  prompt: z.string().min(3, 'Prompt must be at least 3 characters').max(500),
  category: z.string().min(1).max(50),
  language: z.string().regex(/^[a-z]{2}$/).default('hi'),
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
        processing: ['QUEUED', 'TEXT_GENERATING'],
        failed: ['FAILED'],
      }

      const mappedStatuses = statusMap[status.toLowerCase()]
      if (mappedStatuses) {
        where.status = { in: mappedStatuses }
      } else {
        const validStatuses = [
          'QUEUED', 'TEXT_GENERATING',
          'COMPLETED', 'FAILED',
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

    // Check module pricing + credits
    const creditCheck = await checkModuleCredits(session.user.id, 'quotes')
    if (!creditCheck.ok) {
      return NextResponse.json({ error: creditCheck.error }, { status: creditCheck.status })
    }

    // Create the quote job
    const quoteJob = await prisma.quoteJob.create({
      data: {
        userId: session.user.id,
        prompt: data.prompt,
        category: data.category,
        language: data.language,
        status: 'QUEUED',
        creditsCost: creditCheck.creditsCost,
      },
    })

    // Enqueue the job to BullMQ
    const queueJobId = await enqueueQuoteJob({
      quoteJobId: quoteJob.id,
      userId: session.user.id,
      prompt: data.prompt,
      category: data.category,
      language: data.language,
      plan: creditCheck.subscription.plan,
    })

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
