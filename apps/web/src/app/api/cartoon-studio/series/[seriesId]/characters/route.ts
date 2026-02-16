import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

const createCharacterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  personality: z.string().max(2000).optional(),
  voiceId: z.string().max(100).optional(),
  color: z.string().max(7).optional(),
})

// POST /api/cartoon-studio/series/[seriesId]/characters
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId } = await params

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
  })
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = createCharacterSchema.parse(body)

    const character = await prisma.cartoonCharacter.create({
      data: {
        seriesId,
        name: data.name,
        description: data.description,
        personality: data.personality,
        voiceId: data.voiceId,
        color: data.color,
      },
    })

    return NextResponse.json({ character }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    throw err
  }
}
