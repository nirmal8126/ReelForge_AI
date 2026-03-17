import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 }
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Forbidden', status: 403 }
  }
  return { userId: session.user.id }
}

// GET /api/admin/marketing/badges — get badge counts
export const dynamic = 'force-dynamic';
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const badgeCounts = await prisma.userBadge.groupBy({
    by: ['badge'],
    _count: { id: true },
  })

  const totalBadges = await prisma.userBadge.count()

  const badges = badgeCounts.map((b) => ({
    badge: b.badge,
    count: b._count.id,
  }))

  return NextResponse.json({ badges, totalBadges })
}

const awardSchema = z.object({
  userId: z.string().min(1),
  badge: z.enum([
    'FIRST_REFERRAL', 'REFERRAL_5', 'REFERRAL_25', 'POWER_REFERRER_100',
    'FIRST_REEL', 'REEL_MASTER_50', 'EARLY_ADOPTER', 'STREAK_7D',
  ]),
})

// POST /api/admin/marketing/badges — manually award a badge
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = awardSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { id: data.userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const badge = await prisma.userBadge.create({
      data: {
        userId: data.userId,
        badge: data.badge as any,
      },
    })

    return NextResponse.json({ badge })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    // Unique constraint = already awarded
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'User already has this badge' }, { status: 409 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to award badge' }, { status: 500 })
  }
}
