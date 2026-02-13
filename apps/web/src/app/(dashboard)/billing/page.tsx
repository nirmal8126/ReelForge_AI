import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import { CreditCard, Zap, ArrowUpRight } from 'lucide-react'
import { BillingActions } from '@/components/billing/billing-actions'
import { PLANS } from '@/lib/constants'

export default async function BillingPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const [subscription, user] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { creditsBalance: true, stripeCustomerId: true },
    }),
  ])

  const currentPlan = subscription?.plan || 'FREE'
  const jobsUsed = subscription?.jobsUsed || 0
  const jobsLimit = subscription?.jobsLimit || 3
  const usagePercent = jobsLimit > 0 ? Math.round((jobsUsed / jobsLimit) * 100) : 0

  const plans = [
    { key: 'FREE', name: 'Free', price: '$0', monthly: '/mo', reels: '3 reels/mo', features: ['AI script generation', 'Basic voices', '720p quality', 'Watermarked'] },
    { key: 'STARTER', name: 'Starter', price: '$19', monthly: '/mo', reels: '25 reels/mo', features: ['Everything in Free', '50+ AI voices', 'No watermark', '1080p quality', '1 channel profile'] },
    { key: 'PRO', name: 'Pro', price: '$49', monthly: '/mo', reels: '75 reels/mo', features: ['Everything in Starter', 'Priority queue', '5 channel profiles', 'Custom intros/outros', 'Analytics'], popular: true },
    { key: 'BUSINESS', name: 'Business', price: '$99', monthly: '/mo', reels: '200 reels/mo', features: ['Everything in Pro', 'Unlimited profiles', 'Team collaboration', 'API access', 'White-label option'] },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Billing & Subscription</h1>
        <p className="text-gray-400 mt-1">Manage your plan, usage, and credits</p>
      </div>

      {/* Current Plan Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Current Plan</span>
            <CreditCard className="h-5 w-5 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-white capitalize">{currentPlan.toLowerCase()}</p>
          <p className="text-xs text-gray-500 mt-1">
            {subscription?.currentPeriodEnd
              ? `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
              : 'Free tier'}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Usage This Period</span>
          </div>
          <p className="text-2xl font-bold text-white">{jobsUsed} / {jobsLimit}</p>
          <div className="mt-3">
            <div className="h-2 rounded-full bg-white/10">
              <div
                className={`h-2 rounded-full transition-all ${usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-yellow-500' : 'bg-brand-500'}`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{usagePercent}% used</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Credit Balance</span>
            <Zap className="h-5 w-5 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-white">{user?.creditsBalance || 0} credits</p>
          <p className="text-xs text-gray-500 mt-1">1 credit = 1 reel generation</p>
        </div>
      </div>

      {/* Plan Management Actions */}
      <BillingActions
        currentPlan={currentPlan}
        hasStripeCustomer={!!user?.stripeCustomerId}
      />

      {/* Plan Comparison */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-6">Compare Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.key === currentPlan
            return (
              <div
                key={plan.key}
                className={`rounded-xl border p-6 transition ${
                  plan.popular
                    ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                    : isCurrent
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                {plan.popular && <p className="text-brand-400 text-xs font-medium mb-3">Most Popular</p>}
                {isCurrent && <p className="text-green-400 text-xs font-medium mb-3">Current Plan</p>}

                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.monthly}</span>
                </div>
                <p className="mt-1 text-sm text-gray-400">{plan.reels}</p>

                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <svg className="h-4 w-4 text-brand-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {!isCurrent && plan.key !== 'FREE' && (
                  <BillingActions
                    currentPlan={currentPlan}
                    targetPlan={plan.key}
                    hasStripeCustomer={!!user?.stripeCustomerId}
                    buttonOnly
                  />
                )}
                {isCurrent && (
                  <div className="mt-6 w-full text-center rounded-lg bg-white/10 py-2 text-sm font-medium text-gray-400">
                    Current Plan
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Credit Packs */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-6">Buy Extra Credits</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { credits: 10, price: '$9.99', perCredit: '$1.00/credit', index: 0 },
            { credits: 50, price: '$39.99', perCredit: '$0.80/credit', index: 1, popular: true },
            { credits: 100, price: '$69.99', perCredit: '$0.70/credit', index: 2 },
          ].map((pack) => (
            <div
              key={pack.credits}
              className={`rounded-xl border p-6 ${pack.popular ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/10 bg-white/5'}`}
            >
              {pack.popular && <p className="text-yellow-400 text-xs font-medium mb-2">Best Value</p>}
              <p className="text-2xl font-bold text-white">{pack.credits} Credits</p>
              <p className="text-3xl font-bold text-white mt-2">{pack.price}</p>
              <p className="text-sm text-gray-400 mt-1">{pack.perCredit}</p>
              <BillingActions creditPackIndex={pack.index} buttonOnly creditPurchase />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
