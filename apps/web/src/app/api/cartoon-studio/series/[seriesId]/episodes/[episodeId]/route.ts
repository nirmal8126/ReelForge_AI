import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { enqueueCartoonEpisode } from '@/lib/queue'

// GET /api/cartoon-studio/series/[seriesId]/episodes/[episodeId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; episodeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId, episodeId } = await params

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
  })
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  const episode = await prisma.cartoonEpisode.findFirst({
    where: { id: episodeId, seriesId },
    include: {
      scenes: { orderBy: { sceneIndex: 'asc' } },
      series: { include: { characters: true } },
    },
  })

  if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 })

  return NextResponse.json({ episode })
}

// POST /api/cartoon-studio/series/[seriesId]/episodes/[episodeId] — retry
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; episodeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId, episodeId } = await params

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
  })
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  const episode = await prisma.cartoonEpisode.findFirst({
    where: { id: episodeId, seriesId },
  })
  if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 })

  if (episode.status !== 'FAILED') {
    return NextResponse.json({ error: 'Only failed episodes can be retried' }, { status: 400 })
  }

  // Reset status
  await prisma.cartoonEpisode.update({
    where: { id: episodeId },
    data: { status: 'QUEUED', progress: 0, errorMessage: null, currentStage: null },
  })

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  })

  await enqueueCartoonEpisode({
    episodeId,
    seriesId,
    userId: session.user.id,
    prompt: episode.prompt,
    title: episode.title,
    language: series.language,
    aspectRatio: series.aspectRatio,
    narratorVoiceId: series.narratorVoiceId || undefined,
    bgMusicTrack: series.bgMusicTrack || undefined,
    bgMusicVolume: series.bgMusicVolume ?? undefined,
    plan: subscription?.plan || 'FREE',
  })

  return NextResponse.json({ success: true, message: 'Episode retry queued' })
}

// DELETE /api/cartoon-studio/series/[seriesId]/episodes/[episodeId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; episodeId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId, episodeId } = await params

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
  })
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  const episode = await prisma.cartoonEpisode.findFirst({
    where: { id: episodeId, seriesId },
  })
  if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 })

  // Delete scenes first (child records), then the episode
  await prisma.cartoonScene.deleteMany({ where: { episodeId } })
  await prisma.cartoonEpisode.delete({ where: { id: episodeId } })

  return NextResponse.json({ success: true, message: 'Episode deleted' })
}
