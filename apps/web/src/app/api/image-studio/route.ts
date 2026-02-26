import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueImageStudioJob } from '@/lib/queue'
import { checkModuleCredits } from '@/lib/module-config'
import { getImageStudioCreditCost } from '@/lib/credit-cost'
import { z } from 'zod'

const createSchema = z.object({
  mode: z.enum(['video', 'enhance']).default('video'),
  title: z.string().max(255).optional(),
  prompt: z.string().max(2000).optional(),
  imageUrls: z.array(z.string().min(1)).min(1).max(5),
  language: z.string().regex(/^[a-z]{2}$/).default('hi'),
  voiceEnabled: z.boolean().default(false),
  voiceId: z.string().max(100).optional(),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('9:16'),
  transitionStyle: z.string().max(50).default('fade'),
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
        'QUEUED', 'ANALYZING', 'SCRIPT_GENERATING', 'VOICE_GENERATING',
        'COMPOSING', 'UPLOADING', 'COMPLETED', 'FAILED',
      ]
      if (validStatuses.includes(status.toUpperCase())) {
        where.status = status.toUpperCase()
      }
    }

    const [jobs, total] = await Promise.all([
      prisma.imageStudioJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.imageStudioJob.count({ where }),
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
    console.error('GET /api/image-studio error:', error)
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
    const data = createSchema.parse(body)

    const creditCost = getImageStudioCreditCost(data.imageUrls.length, data.voiceEnabled)
    const creditCheck = await checkModuleCredits(session.user.id, 'image_studio', creditCost)
    if (!creditCheck.ok) {
      return NextResponse.json({ error: creditCheck.error }, { status: creditCheck.status })
    }

    const title = data.title || (data.prompt ? data.prompt.slice(0, 80) : `Image Studio - ${data.imageUrls.length} image${data.imageUrls.length > 1 ? 's' : ''}`)

    const job = await prisma.imageStudioJob.create({
      data: {
        userId: session.user.id,
        mode: data.mode,
        title,
        prompt: data.prompt || null,
        imageUrls: data.imageUrls,
        imageCount: data.imageUrls.length,
        language: data.language,
        voiceEnabled: data.voiceEnabled,
        voiceId: data.voiceId || null,
        aspectRatio: data.aspectRatio,
        transitionStyle: data.transitionStyle,
        status: 'QUEUED',
        creditsCost: creditCheck.creditsCost,
      },
    })

    const queueJobId = await enqueueImageStudioJob({
      imageStudioJobId: job.id,
      userId: session.user.id,
      mode: data.mode,
      imageUrls: data.imageUrls,
      prompt: data.prompt,
      title,
      language: data.language,
      voiceEnabled: data.voiceEnabled,
      voiceId: data.voiceId,
      aspectRatio: data.aspectRatio,
      transitionStyle: data.transitionStyle,
      plan: creditCheck.subscription.plan,
    })

    return NextResponse.json({
      id: job.id,
      title: job.title,
      status: job.status,
      queueJobId,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('POST /api/image-studio error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
