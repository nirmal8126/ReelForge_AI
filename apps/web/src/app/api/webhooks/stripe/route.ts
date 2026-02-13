import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLAN_PRICES } from '@/lib/stripe'
import { prisma } from '@reelforge/db'
import type Stripe from 'stripe'

// Map Stripe price IDs back to plan names
function getPlanFromPriceId(priceId: string): string | null {
  for (const [plan, config] of Object.entries(PLAN_PRICES)) {
    if (config.priceId === priceId) return plan
  }
  return null
}

function getJobsLimitForPlan(plan: string): number {
  const limits: Record<string, number> = {
    FREE: 3,
    STARTER: 25,
    PRO: 75,
    BUSINESS: 200,
    ENTERPRISE: -1,
  }
  return limits[plan] ?? 3
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Stripe webhook signature verification failed:', message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const userId = session.metadata?.userId
        const plan = session.metadata?.plan

        if (!userId || !plan) {
          console.error('Missing metadata in checkout session:', session.id)
          break
        }

        const subscriptionId = session.subscription as string
        const customerId = session.customer as string

        // Retrieve the subscription to get period dates
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscriptionId
        )

        // Update user with Stripe customer ID
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId },
        })

        // Upsert the subscription record
        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            plan: plan as 'STARTER' | 'PRO' | 'BUSINESS',
            status: 'ACTIVE',
            jobsLimit: getJobsLimitForPlan(plan),
            jobsUsed: 0,
            stripeSubscriptionId: subscriptionId,
            stripePriceId:
              stripeSubscription.items.data[0]?.price.id || null,
            currentPeriodStart: new Date(
              stripeSubscription.current_period_start * 1000
            ),
            currentPeriodEnd: new Date(
              stripeSubscription.current_period_end * 1000
            ),
          },
          update: {
            plan: plan as 'STARTER' | 'PRO' | 'BUSINESS',
            status: 'ACTIVE',
            jobsLimit: getJobsLimitForPlan(plan),
            jobsUsed: 0,
            stripeSubscriptionId: subscriptionId,
            stripePriceId:
              stripeSubscription.items.data[0]?.price.id || null,
            currentPeriodStart: new Date(
              stripeSubscription.current_period_start * 1000
            ),
            currentPeriodEnd: new Date(
              stripeSubscription.current_period_end * 1000
            ),
          },
        })

        console.log(
          `Checkout completed: user=${userId}, plan=${plan}, subscription=${subscriptionId}`
        )
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        const userId = subscription.metadata?.userId
        if (!userId) {
          console.error(
            'Missing userId in subscription metadata:',
            subscription.id
          )
          break
        }

        const priceId = subscription.items.data[0]?.price.id
        const plan = priceId ? getPlanFromPriceId(priceId) : null

        const updateData: Record<string, unknown> = {
          status:
            subscription.status === 'active'
              ? 'ACTIVE'
              : subscription.status === 'past_due'
                ? 'PAST_DUE'
                : subscription.status === 'canceled'
                  ? 'CANCELED'
                  : subscription.status === 'trialing'
                    ? 'TRIALING'
                    : 'ACTIVE',
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000
          ),
          currentPeriodEnd: new Date(
            subscription.current_period_end * 1000
          ),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          stripePriceId: priceId || null,
        }

        if (plan) {
          updateData.plan = plan
          updateData.jobsLimit = getJobsLimitForPlan(plan)
        }

        await prisma.subscription.update({
          where: { userId },
          data: updateData,
        })

        console.log(
          `Subscription updated: user=${userId}, plan=${plan}, status=${subscription.status}`
        )
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        const userId = subscription.metadata?.userId
        if (!userId) {
          console.error(
            'Missing userId in subscription metadata:',
            subscription.id
          )
          break
        }

        await prisma.subscription.update({
          where: { userId },
          data: {
            plan: 'FREE',
            status: 'CANCELED',
            jobsLimit: 3,
            jobsUsed: 0,
            stripeSubscriptionId: null,
            stripePriceId: null,
            cancelAtPeriodEnd: false,
          },
        })

        console.log(`Subscription deleted: user=${userId}, reverted to FREE`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        const subscriptionId = invoice.subscription as string | null
        if (!subscriptionId) break

        // Find the subscription in our DB by Stripe subscription ID
        const dbSubscription = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        })

        if (dbSubscription) {
          await prisma.subscription.update({
            where: { id: dbSubscription.id },
            data: { status: 'PAST_DUE' },
          })

          console.log(
            `Payment failed: user=${dbSubscription.userId}, subscription=${subscriptionId}`
          )
        }
        break
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }
  } catch (error) {
    console.error('Error processing Stripe webhook:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}
