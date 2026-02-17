import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
  typescript: true,
})

export const PLAN_PRICES: Record<string, { priceId: string; jobsLimit: number }> = {
  STARTER: { priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID!, jobsLimit: 25 },
  PRO: { priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID!, jobsLimit: 75 },
  BUSINESS: { priceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID!, jobsLimit: 200 },
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: string,
  customerId?: string,
  overridePriceId?: string,
) {
  const priceId = overridePriceId || PLAN_PRICES[plan]?.priceId
  if (!priceId) throw new Error('Invalid plan or missing Stripe Price ID')

  const session = await stripe.checkout.sessions.create({
    customer: customerId || undefined,
    customer_email: customerId ? undefined : email,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    metadata: { userId, plan },
    subscription_data: {
      metadata: { userId, plan },
    },
  })

  return session
}

export async function createBillingPortalSession(customerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  })
  return session
}
