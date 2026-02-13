import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      referralCode: true,
      referralTier: true,
      totalReferrals: true,
      creditsBalance: true,
      cashPendingCents: true,
      cashWithdrawnCents: true,
    },
  })

  const referrals = await prisma.referral.findMany({
    where: { referrerUserId: session.user.id },
    include: {
      referred: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const completedReferrals = referrals.filter(r => r.status === 'COMPLETED' || r.status === 'PAID')

  return NextResponse.json({
    ...user,
    referrals,
    totalCompleted: completedReferrals.length,
    referralLink: `${process.env.NEXT_PUBLIC_APP_URL}/register?ref=${user?.referralCode}`,
  })
}
