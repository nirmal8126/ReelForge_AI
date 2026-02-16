import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

const createSeriesSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetAudience: z.string().max(100).optional(),
  artStyle: z.string().max(50).optional(),
  narratorVoiceId: z.string().max(100).optional(),
  language: z.string().regex(/^[a-z]{2}$/).default('en'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  characters: z.array(z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    personality: z.string().max(2000).optional(),
    voiceId: z.string().max(100).optional(),
    color: z.string().max(7).optional(),
  })).optional(),
})

// GET /api/cartoon-studio/series — list user's series
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const series = await prisma.cartoonSeries.findMany({
    where: { userId: session.user.id },
    include: {
      _count: { select: { characters: true, episodes: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ series })
}

// POST /api/cartoon-studio/series — create new series
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = createSeriesSchema.parse(body)

    const series = await prisma.cartoonSeries.create({
      data: {
        userId: session.user.id,
        name: data.name,
        description: data.description,
        targetAudience: data.targetAudience,
        artStyle: data.artStyle,
        narratorVoiceId: data.narratorVoiceId,
        language: data.language,
        aspectRatio: data.aspectRatio,
        characters: data.characters?.length ? {
          create: data.characters.map((c) => ({
            name: c.name,
            description: c.description,
            personality: c.personality,
            voiceId: c.voiceId,
            color: c.color,
          })),
        } : undefined,
      },
      include: {
        characters: true,
        _count: { select: { episodes: true } },
      },
    })

    return NextResponse.json({ series }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    throw err
  }
}
