import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

// GET /api/banners — get active banners for the current user
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ banners: [] })
  }

  const now = new Date()

  const banners = await prisma.banner.findMany({
    where: {
      isActive: true,
      OR: [
        { startsAt: null },
        { startsAt: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })

  // Filter by user's plan if targetPlans is set
  const userPlan = (session.user as any).plan || 'FREE'
  const filtered = banners.filter((b) => {
    if (!b.targetPlans) return true
    const plans = b.targetPlans as string[]
    return plans.length === 0 || plans.includes(userPlan)
  })

  return NextResponse.json({ banners: filtered })
}
