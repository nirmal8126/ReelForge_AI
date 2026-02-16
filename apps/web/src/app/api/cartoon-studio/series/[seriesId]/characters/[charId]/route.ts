import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

const updateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  personality: z.string().max(2000).optional(),
  voiceId: z.string().max(100).optional(),
  color: z.string().max(7).optional(),
})

// PATCH /api/cartoon-studio/series/[seriesId]/characters/[charId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; charId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId, charId } = await params

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
  })
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  const existing = await prisma.cartoonCharacter.findFirst({
    where: { id: charId, seriesId },
  })
  if (!existing) return NextResponse.json({ error: 'Character not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = updateCharacterSchema.parse(body)

    const character = await prisma.cartoonCharacter.update({
      where: { id: charId },
      data,
    })

    return NextResponse.json({ character })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    throw err
  }
}

// DELETE /api/cartoon-studio/series/[seriesId]/characters/[charId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ seriesId: string; charId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId, charId } = await params

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
  })
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  const existing = await prisma.cartoonCharacter.findFirst({
    where: { id: charId, seriesId },
  })
  if (!existing) return NextResponse.json({ error: 'Character not found' }, { status: 404 })

  await prisma.cartoonCharacter.delete({ where: { id: charId } })

  return NextResponse.json({ success: true })
}
