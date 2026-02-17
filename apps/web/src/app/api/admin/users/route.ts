import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

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
// GET /api/admin/users — list all users with stats
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const search = searchParams.get('search') || ''
  const limit = 20

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        referralTier: true,
        creditsBalance: true,
        totalReferrals: true,
        createdAt: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            jobsLimit: true,
            jobsUsed: true,
          },
        },
        _count: {
          select: {
            reelJobs: true,
            quoteJobs: true,
            challengeJobs: true,
            longFormJobs: true,
            cartoonSeries: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ users, total, page, limit })
}

// ---------------------------------------------------------------------------
// PUT /api/admin/users — update user credits or subscription
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const { userId, creditsBalance, plan, jobsLimit, jobsUsed } = body

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Update credits balance if provided
  if (creditsBalance !== undefined) {
    const credits = parseInt(String(creditsBalance), 10)
    if (isNaN(credits) || credits < 0) {
      return NextResponse.json({ error: 'Invalid credits value' }, { status: 400 })
    }
    await prisma.user.update({
      where: { id: userId },
      data: { creditsBalance: credits },
    })
  }

  // Update subscription if any subscription fields provided
  if (plan !== undefined || jobsLimit !== undefined || jobsUsed !== undefined) {
    const validPlans = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']
    if (plan !== undefined && !validPlans.includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const subData: Record<string, unknown> = {}
    if (plan !== undefined) subData.plan = plan
    if (jobsLimit !== undefined) {
      const limit = parseInt(String(jobsLimit), 10)
      if (isNaN(limit) || limit < 0) {
        return NextResponse.json({ error: 'Invalid jobsLimit' }, { status: 400 })
      }
      subData.jobsLimit = limit
    }
    if (jobsUsed !== undefined) {
      const used = parseInt(String(jobsUsed), 10)
      if (isNaN(used) || used < 0) {
        return NextResponse.json({ error: 'Invalid jobsUsed' }, { status: 400 })
      }
      subData.jobsUsed = used
    }

    await prisma.subscription.upsert({
      where: { userId },
      update: subData,
      create: {
        userId,
        plan: (plan as 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE') || 'FREE',
        jobsLimit: typeof subData.jobsLimit === 'number' ? subData.jobsLimit : 3,
        jobsUsed: typeof subData.jobsUsed === 'number' ? subData.jobsUsed : 0,
      },
    })
  }

  return NextResponse.json({ success: true })
}
