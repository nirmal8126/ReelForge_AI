import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'
import { PLANS } from '@/lib/constants'

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

// ---------------------------------------------------------------------------
// GET /api/admin/plans — list all plans with subscriber counts
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  // Get subscriber count per plan
  const subscriberCounts = await prisma.subscription.groupBy({
    by: ['plan'],
    _count: true,
  })

  const countMap: Record<string, number> = {}
  for (const sc of subscriberCounts) {
    countMap[sc.plan] = sc._count
  }

  const plans = Object.entries(PLANS).map(([key, plan]) => ({
    key,
    name: plan.name,
    price: plan.price,
    jobsLimit: plan.jobsLimit,
    profilesLimit: plan.profilesLimit,
    subscribers: countMap[key] || 0,
  }))

  return NextResponse.json({ plans })
}

// ---------------------------------------------------------------------------
// PUT /api/admin/plans — update jobsLimit for a plan
// ---------------------------------------------------------------------------

const updatePlanSchema = z.object({
  plan: z.enum(['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']),
  jobsLimit: z.number().int().min(0).max(10000),
})

export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const data = updatePlanSchema.parse(body)

  // Bulk update all subscriptions on this plan
  const result = await prisma.subscription.updateMany({
    where: { plan: data.plan as never },
    data: { jobsLimit: data.jobsLimit },
  })

  return NextResponse.json({
    updated: result.count,
    plan: data.plan,
    jobsLimit: data.jobsLimit,
  })
}
