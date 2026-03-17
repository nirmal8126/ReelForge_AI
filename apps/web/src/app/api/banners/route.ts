import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { resolveSegmentWhereForUser, SegmentRules } from '@/lib/segment-resolver'

/** Deterministic hash for consistent A/B split per user+experiment */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0
  }
  return Math.abs(hash)
}

// GET /api/banners — get active banners for the current user
export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ banners: [] })
  }

  const userId = session.user.id
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
  let filtered = banners.filter((b) => {
    if (!b.targetPlans) return true
    const plans = b.targetPlans as string[]
    return plans.length === 0 || plans.includes(userPlan)
  })

  // Segment targeting — filter out banners whose segment doesn't match this user
  const segmentBanners = filtered.filter((b) => b.targetSegmentId)
  if (segmentBanners.length > 0) {
    const segmentIds = [...new Set(segmentBanners.map((b) => b.targetSegmentId!))]
    const segments = await prisma.userSegment.findMany({
      where: { id: { in: segmentIds }, isActive: true },
    })
    const segmentMap = new Map(segments.map((s) => [s.id, s]))

    const excludeIds = new Set<string>()
    for (const banner of segmentBanners) {
      const seg = segmentMap.get(banner.targetSegmentId!)
      if (!seg) {
        excludeIds.add(banner.id)
        continue
      }
      const where = resolveSegmentWhereForUser(seg.rules as unknown as SegmentRules, userId)
      const match = await prisma.user.count({ where })
      if (match === 0) excludeIds.add(banner.id)
    }
    filtered = filtered.filter((b) => !excludeIds.has(b.id))
  }

  // A/B experiment resolution — for banners in a running experiment,
  // only return the variant this user is assigned to
  const experiments = await prisma.bannerExperiment.findMany({
    where: { status: 'RUNNING' },
  })

  if (experiments.length > 0) {
    const excludeBannerIds = new Set<string>()

    for (const exp of experiments) {
      const hash = simpleHash(userId + exp.id)
      const showA = (hash % 100) < exp.splitPercent
      // Exclude the variant NOT assigned to this user
      excludeBannerIds.add(showA ? exp.bannerBId : exp.bannerAId)
    }

    filtered = filtered.filter((b) => !excludeBannerIds.has(b.id))
  }

  return NextResponse.json({ banners: filtered })
}
