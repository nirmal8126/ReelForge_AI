import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

const updateSeriesSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  targetAudience: z.string().max(100).optional(),
  artStyle: z.string().max(50).optional(),
  narratorVoiceId: z.string().max(100).optional(),
  language: z.string().regex(/^[a-z]{2}$/).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
})

// GET /api/cartoon-studio/series/[seriesId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId } = await params

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
    include: {
      characters: { orderBy: { createdAt: 'asc' } },
      episodes: { orderBy: { episodeNumber: 'asc' } },
    },
  })

  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  return NextResponse.json({ series })
}

// PATCH /api/cartoon-studio/series/[seriesId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId } = await params

  const existing = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = updateSeriesSchema.parse(body)

    const series = await prisma.cartoonSeries.update({
      where: { id: seriesId },
      data,
      include: { characters: true },
    })

    return NextResponse.json({ series })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    throw err
  }
}

// DELETE /api/cartoon-studio/series/[seriesId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId } = await params

  const existing = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  await prisma.cartoonSeries.delete({ where: { id: seriesId } })

  return NextResponse.json({ success: true })
}
