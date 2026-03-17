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
    return { error: 'Forbidden — Super Admin access required', status: 403 }
  }

  return { userId: session.user.id }
}

// Default tier configs for seeding
const DEFAULT_TIERS = [
  { tier: 'FREE' as const, creditsPerReferral: 5, cashPercent: 0, recurringPercent: 0 },
  { tier: 'AFFILIATE' as const, creditsPerReferral: 10, cashPercent: 10, recurringPercent: 0 },
  { tier: 'PARTNER' as const, creditsPerReferral: 15, cashPercent: 15, recurringPercent: 5 },
]

// ---------------------------------------------------------------------------
// GET /api/admin/referrals — list tier configs + stats
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  // Ensure all tiers exist
  for (const def of DEFAULT_TIERS) {
    await prisma.referralTierConfig.upsert({
      where: { tier: def.tier },
      create: {
        tier: def.tier,
        creditsPerReferral: def.creditsPerReferral,
        cashPercent: def.cashPercent,
        recurringPercent: def.recurringPercent,
      },
      update: {},
    })
  }

  const [tiers, stats] = await Promise.all([
    prisma.referralTierConfig.findMany({
      orderBy: { tier: 'asc' },
    }),
    // Get referral stats
    Promise.all([
      prisma.referral.count(),
      prisma.referral.count({ where: { status: 'COMPLETED' } }),
      prisma.referral.aggregate({ _sum: { referrerRewardCredits: true } }),
      prisma.user.groupBy({
        by: ['referralTier'],
        _count: true,
      }),
    ]),
  ])

  const [totalReferrals, convertedReferrals, rewardSum, tierCounts] = stats

  const usersByTier: Record<string, number> = {}
  for (const tc of tierCounts) {
    usersByTier[tc.referralTier] = tc._count
  }

  // Sort tiers to match FREE, AFFILIATE, PARTNER order
  const tierOrder = ['FREE', 'AFFILIATE', 'PARTNER']
  tiers.sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier))

  return NextResponse.json({
    tiers,
    stats: {
      totalReferrals,
      convertedReferrals,
      totalCreditsRewarded: rewardSum._sum.referrerRewardCredits || 0,
      usersByTier,
    },
  })
}

// ---------------------------------------------------------------------------
// PUT /api/admin/referrals — update a tier config
// ---------------------------------------------------------------------------

const updateTierSchema = z.object({
  tier: z.enum(['FREE', 'AFFILIATE', 'PARTNER']),
  creditsPerReferral: z.number().int().min(0).max(1000).optional(),
  cashPercent: z.number().int().min(0).max(100).optional(),
  recurringPercent: z.number().int().min(0).max(100).optional(),
})

export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const data = updateTierSchema.parse(body)

  const updated = await prisma.referralTierConfig.update({
    where: { tier: data.tier },
    data: {
      ...(data.creditsPerReferral !== undefined && { creditsPerReferral: data.creditsPerReferral }),
      ...(data.cashPercent !== undefined && { cashPercent: data.cashPercent }),
      ...(data.recurringPercent !== undefined && { recurringPercent: data.recurringPercent }),
    },
  })

  return NextResponse.json({ tier: updated })
}
