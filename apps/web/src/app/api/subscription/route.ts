import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    })

    if (!subscription) {
      return NextResponse.json({
        plan: 'FREE',
        status: 'ACTIVE',
        jobsUsed: 0,
        jobsLimit: 3,
        currentPeriodEnd: null,
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
      })
    }

    return NextResponse.json({
      plan: subscription.plan,
      status: subscription.status,
      jobsUsed: subscription.jobsUsed,
      jobsLimit: subscription.jobsLimit,
      currentPeriodEnd: subscription.currentPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    })
  } catch (error) {
    console.error('Subscription fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
