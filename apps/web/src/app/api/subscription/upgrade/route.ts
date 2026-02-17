import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { createCheckoutSession } from '@/lib/stripe'
import { z } from 'zod'

const upgradeSchema = z.object({
  plan: z.enum(['STARTER', 'PRO', 'BUSINESS']),
  regionId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { plan, regionId } = upgradeSchema.parse(body)

    // Get user with existing subscription
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent downgrading to same plan
    if (user.subscription?.plan === plan) {
      return NextResponse.json(
        { error: 'You are already on this plan' },
        { status: 400 }
      )
    }

    // Look up region-specific Stripe Price ID
    let overridePriceId: string | undefined
    if (regionId) {
      const regionPrice = await prisma.regionPlanPrice.findUnique({
        where: { regionId_plan: { regionId, plan } },
      })
      if (regionPrice?.stripePriceId) {
        overridePriceId = regionPrice.stripePriceId
      }
    }

    // Create Stripe checkout session
    const checkoutSession = await createCheckoutSession(
      user.id,
      user.email,
      plan,
      user.stripeCustomerId || undefined,
      overridePriceId,
    )

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Subscription upgrade error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
