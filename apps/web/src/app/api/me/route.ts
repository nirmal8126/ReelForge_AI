import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscription: true,
      _count: {
        select: {
          reelJobs: true,
          channelProfiles: true,
          referralsMade: true,
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    referralCode: user.referralCode,
    referralTier: user.referralTier,
    creditsBalance: user.creditsBalance,
    totalReferrals: user.totalReferrals,
    subscription: user.subscription ? {
      plan: user.subscription.plan,
      status: user.subscription.status,
      jobsUsed: user.subscription.jobsUsed,
      jobsLimit: user.subscription.jobsLimit,
      currentPeriodEnd: user.subscription.currentPeriodEnd,
    } : null,
    counts: user._count,
  })
}

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: data.name },
      select: { id: true, name: true, email: true },
    })

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
