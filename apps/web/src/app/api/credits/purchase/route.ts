import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'
import { CREDIT_PACKAGES } from '@/lib/constants'

const purchaseSchema = z.object({
  packageIndex: z.number().min(0).max(2),
  regionId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { packageIndex, regionId } = purchaseSchema.parse(body)
    const pkg = CREDIT_PACKAGES[packageIndex]

    if (!pkg) {
      return NextResponse.json({ error: 'Invalid package' }, { status: 400 })
    }

    // Resolve region-specific price and currency
    let currency = 'usd'
    let unitAmount: number = pkg.price

    if (regionId) {
      const regionCredit = await prisma.regionCreditPrice.findUnique({
        where: { regionId_credits: { regionId, credits: pkg.credits } },
        include: { region: { select: { currency: true } } },
      })
      if (regionCredit) {
        currency = regionCredit.region.currency
        unitAmount = regionCredit.priceAmount
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer_email: session.user.email,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${pkg.credits} ReelForge Credits`,
              description: `${pkg.credits} reel generation credits`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?credits=purchased`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
      metadata: {
        userId: session.user.id,
        type: 'credit_purchase',
        credits: pkg.credits.toString(),
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Credit purchase error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
