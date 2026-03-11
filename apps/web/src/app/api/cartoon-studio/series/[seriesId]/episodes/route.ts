import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'
import { enqueueCartoonEpisode } from '@/lib/queue'
import { checkModuleCredits } from '@/lib/module-config'
import { getCartoonCreditCost } from '@/lib/credit-cost'

const createEpisodeSchema = z.object({
  title: z.string().min(1).max(300),
  prompt: z.string().min(10).max(3000),
  synopsis: z.string().max(2000).optional(),
})

// GET /api/cartoon-studio/series/[seriesId]/episodes
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId } = await params

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
  })
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  const episodes = await prisma.cartoonEpisode.findMany({
    where: { seriesId },
    orderBy: { episodeNumber: 'asc' },
    include: { _count: { select: { scenes: true } } },
  })

  return NextResponse.json({ episodes })
}

// POST /api/cartoon-studio/series/[seriesId]/episodes — create & enqueue
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId } = await params

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
    include: { characters: true },
  })
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  if (series.characters.length === 0) {
    return NextResponse.json({ error: 'Series must have at least one character' }, { status: 400 })
  }

  // Check module pricing + credits (uses subscription quota first, then credits)
  const creditCost = getCartoonCreditCost()
  const creditCheck = await checkModuleCredits(session.user.id, 'cartoon_studio', creditCost)
  if (!creditCheck.ok) {
    return NextResponse.json({ error: creditCheck.error }, { status: creditCheck.status })
  }

  try {
    const body = await req.json()
    const data = createEpisodeSchema.parse(body)

    // Auto-increment episode number
    const lastEpisode = await prisma.cartoonEpisode.findFirst({
      where: { seriesId },
      orderBy: { episodeNumber: 'desc' },
    })
    const episodeNumber = (lastEpisode?.episodeNumber || 0) + 1

    const episode = await prisma.cartoonEpisode.create({
      data: {
        seriesId,
        title: data.title,
        prompt: data.prompt,
        synopsis: data.synopsis,
        episodeNumber,
        creditsCost: creditCheck.creditsCost,
        status: 'QUEUED',
      },
    })

    await enqueueCartoonEpisode({
      episodeId: episode.id,
      seriesId,
      userId: session.user.id,
      prompt: data.prompt,
      title: data.title,
      language: series.language,
      aspectRatio: series.aspectRatio,
      narratorVoiceId: series.narratorVoiceId || undefined,
      bgMusicTrack: series.bgMusicTrack || undefined,
      bgMusicVolume: series.bgMusicVolume ?? undefined,
      plan: creditCheck.subscription.plan,
    })

    return NextResponse.json({ episode }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    throw err
  }
}
