import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'
import { enqueueLongFormJob } from '@/lib/queue'
import { checkModuleCredits } from '@/lib/module-config'
import { getLongFormCreditCost } from '@/lib/credit-cost'

const outlineSegmentSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  talkingPoints: z.array(z.string()).optional(),
  durationSeconds: z.number().min(10).max(600),
  visualSuggestion: z.string().max(1000).optional(),
})

const createLongFormSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  prompt: z.string().min(10).max(2000),
  durationMinutes: z.number().min(5).max(30).default(10),
  style: z.string().max(100).optional(),
  language: z.string().regex(/^[a-z]{2}$/).default('hi'),
  voiceId: z.string().max(100).optional(),
  voiceEnabled: z.boolean().default(true),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  bgMusicTrack: z.string().max(50).optional(),
  bgMusicVolume: z.number().min(0).max(100).optional(),
  aiClipRatio: z.number().min(0).max(1).default(0.3),
  useStockFootage: z.boolean().default(true),
  useStaticVisuals: z.boolean().default(true),
  publishToYouTube: z.boolean().default(false),
  channelProfileId: z.string().optional(),
  // Pre-approved outline from plan mode
  outline: z.object({ segments: z.array(outlineSegmentSchema) }).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = createLongFormSchema.parse(body)

    // Calculate credit cost based on duration
    const creditsCost = getLongFormCreditCost(data.durationMinutes)

    // Estimate external API costs in cents (for display/logging)
    const segmentCount = Math.ceil((data.durationMinutes * 60) / 30) // ~30s per segment
    const aiSegments = Math.ceil(segmentCount * data.aiClipRatio)
    const estimatedCostCents = Math.ceil(
      (aiSegments * 40) + // RunwayML: $0.40 per 30s AI clip
      (data.durationMinutes * 3) + // ElevenLabs: ~$0.03 per minute
      10 // Claude script generation
    )

    // Check module pricing + credits (uses subscription quota first, then credits)
    const creditCheck = await checkModuleCredits(session.user.id, 'long_form', creditsCost)
    if (!creditCheck.ok) {
      return NextResponse.json(
        { error: creditCheck.error, creditsCost },
        { status: creditCheck.status }
      )
    }

    // Get user subscription for queue priority
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    })

    const title = data.title || data.prompt.substring(0, 80)

    // Create long-form job (with optional pre-approved outline)
    const longFormJob = await prisma.longFormJob.create({
      data: {
        userId: session.user.id,
        channelProfileId: data.channelProfileId || null,
        title,
        prompt: data.prompt,
        durationMinutes: data.durationMinutes,
        style: data.style || null,
        language: data.language,
        voiceId: data.voiceId || null,
        aspectRatio: data.aspectRatio,
        bgMusicTrack: data.bgMusicTrack || null,
        bgMusicVolume: data.bgMusicVolume ?? null,
        aiClipRatio: data.aiClipRatio,
        useStockFootage: data.useStockFootage,
        useStaticVisuals: data.useStaticVisuals,
        publishToYouTube: data.publishToYouTube,
        creditsCost: creditCheck.creditsCost,
        estimatedCostCents,
        outline: data.outline ? JSON.parse(JSON.stringify(data.outline)) : undefined,
        status: 'QUEUED',
      },
    })

    // Enqueue job to BullMQ
    const queueJobId = await enqueueLongFormJob({
      longFormJobId: longFormJob.id,
      userId: session.user.id,
      prompt: data.prompt,
      title,
      durationMinutes: data.durationMinutes,
      style: data.style,
      language: data.language,
      voiceId: data.voiceId,
      voiceEnabled: data.voiceEnabled,
      aspectRatio: data.aspectRatio,
      bgMusicTrack: data.bgMusicTrack,
      bgMusicVolume: data.bgMusicVolume,
      aiClipRatio: data.aiClipRatio,
      useStockFootage: data.useStockFootage,
      useStaticVisuals: data.useStaticVisuals,
      publishToYouTube: data.publishToYouTube,
      channelProfileId: data.channelProfileId,
      plan: creditCheck.subscription.plan,
    })

    return NextResponse.json(
      {
        job: longFormJob,
        queueJobId,
        estimatedCostCents,
        creditsCost: creditCheck.creditsCost,
        message: 'Long-form video job created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Long-form job creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status') || undefined

    const skip = (page - 1) * limit

    const where: any = {
      userId: session.user.id,
      ...(status && { status }),
    }

    const [jobs, total] = await Promise.all([
      prisma.longFormJob.findMany({
        where,
        include: {
          channelProfile: {
            select: { id: true, name: true },
          },
          _count: {
            select: { segments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.longFormJob.count({ where }),
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
    console.error('Long-form jobs fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
