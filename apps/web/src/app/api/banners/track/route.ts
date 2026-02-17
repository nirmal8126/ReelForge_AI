import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

const trackSchema = z.object({
  bannerId: z.string().min(1),
  action: z.enum(['view', 'click']),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { bannerId, action } = trackSchema.parse(body)

    if (action === 'view') {
      await prisma.banner.update({
        where: { id: bannerId },
        data: { viewCount: { increment: 1 } },
      })
    } else {
      await prisma.banner.update({
        where: { id: bannerId },
        data: { clickCount: { increment: 1 } },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }
}
