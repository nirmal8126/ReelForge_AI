import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import { Zap, BarChart3, Crown, Check, Sparkles, ShieldCheck, Clock } from 'lucide-react'
import { BillingActions } from '@/components/billing/billing-actions'
import { getRegionForCountry, formatRegionPrice } from '@/lib/pricing'
import { detectCountry } from '@/lib/geo'

export default async function BillingPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const [subscription, user, recentTransactions] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { creditsBalance: true, stripeCustomerId: true, country: true },
    }),
    prisma.creditTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  // Lazy-backfill country for OAuth users who signed up before regional pricing
  let userCountry = user?.country || null
  if (!userCountry) {
    userCountry = await detectCountry()
    await prisma.user.update({
      where: { id: session.user.id },
      data: { country: userCountry },
    }).catch(() => {}) // non-critical
  }

  // Resolve pricing region for this user
  const region = await getRegionForCountry(userCountry)

  const currentPlan = subscription?.plan || 'FREE'
  const jobsUsed = subscription?.jobsUsed || 0
  const jobsLimit = subscription?.jobsLimit || 3
  const usagePercent = jobsLimit > 0 ? Math.round((jobsUsed / jobsLimit) * 100) : 0
  const remaining = Math.max(0, jobsLimit - jobsUsed)

  // Build plan prices from region data
  const sym = region.currencySymbol
  const getPlanPrice = (plan: string) => {
    const pp = region.planPrices.find((p: { plan: string; priceAmount: number }) => p.plan === plan)
    return pp ? formatRegionPrice(pp.priceAmount, sym) : `${sym}0`
  }

  const plans = [
    { key: 'FREE', name: 'Free', price: getPlanPrice('FREE'), monthly: '/mo', quota: '3 jobs/mo', features: ['All 6 modules', 'AI script generation', 'Basic voices', '720p quality', 'Watermarked'] },
    { key: 'STARTER', name: 'Starter', price: getPlanPrice('STARTER'), monthly: '/mo', quota: '25 jobs/mo', features: ['Everything in Free', '50+ AI voices', 'No watermark', '1080p quality', '1 channel profile'] },
    { key: 'PRO', name: 'Pro', price: getPlanPrice('PRO'), monthly: '/mo', quota: '75 jobs/mo', features: ['Everything in Starter', 'Priority queue', '5 channel profiles', 'Custom intros/outros', 'Analytics'], popular: true },
    { key: 'BUSINESS', name: 'Business', price: getPlanPrice('BUSINESS'), monthly: '/mo', quota: '200 jobs/mo', features: ['Everything in Pro', 'Unlimited profiles', 'Team collaboration', 'API access', 'White-label option'] },
  ]

  // Build credit packs from region data
  const regionCredits = region.creditPrices.sort((a: { credits: number }, b: { credits: number }) => a.credits - b.credits)
  const creditPacks = regionCredits.map((cp: { credits: number; priceAmount: number; label: string }, i: number) => {
    const perCredit = cp.priceAmount / cp.credits / 100
    const firstPerCredit = regionCredits[0] ? regionCredits[0].priceAmount / regionCredits[0].credits / 100 : perCredit
    const savings = i > 0 && firstPerCredit > 0
      ? `${Math.round((1 - perCredit / firstPerCredit) * 100)}% off`
      : null
    return {
      credits: cp.credits,
      price: formatRegionPrice(cp.priceAmount, sym),
      perCredit: `${sym}${perCredit.toFixed(2)}`,
      savings,
      index: i,
      popular: i === 1,
    }
  })

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/[0.06]">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Billing & Subscription</h1>
          <p className="text-sm text-gray-500 mt-2">Manage your plan, usage, and credits</p>
        </div>
        <BillingActions
          currentPlan={currentPlan}
          hasStripeCustomer={!!user?.stripeCustomerId}
          regionId={region.id}
        />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Current Plan */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Current Plan</span>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
              currentPlan === 'FREE' ? 'bg-gray-500/10' :
              currentPlan === 'STARTER' ? 'bg-blue-500/10' :
              currentPlan === 'PRO' ? 'bg-brand-500/10' :
              'bg-amber-500/10'
            }`}>
              <Crown className={`h-4.5 w-4.5 ${
                currentPlan === 'FREE' ? 'text-gray-400' :
                currentPlan === 'STARTER' ? 'text-blue-400' :
                currentPlan === 'PRO' ? 'text-brand-400' :
                'text-amber-400'
              }`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-white capitalize">{currentPlan.toLowerCase()}</p>
          <p className="text-xs text-gray-500 mt-1">
            {subscription?.currentPeriodEnd ? (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Renews {formatDate(subscription.currentPeriodEnd)}
              </span>
            ) : (
              'Free tier — no billing'
            )}
          </p>
        </div>

        {/* Usage */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Usage</span>
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <BarChart3 className="h-4.5 w-4.5 text-purple-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold text-white">{jobsUsed}</p>
            <span className="text-sm text-gray-500">/ {jobsLimit}</span>
          </div>
          <div className="mt-2.5">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-yellow-500' : 'bg-brand-500'
                }`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-gray-500">{usagePercent}% used</p>
              <p className="text-xs text-gray-500">{remaining} remaining</p>
            </div>
          </div>
        </div>

        {/* Credits */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Credits</span>
            <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Zap className="h-4.5 w-4.5 text-yellow-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold text-white">{user?.creditsBalance || 0}</p>
            <span className="text-sm text-gray-500">credits</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Credits used when over monthly quota (1-12 per job)</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* LEFT — Plans (takes 2 cols) */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">Plans</h2>
            <span className="text-xs text-gray-500">Billed monthly</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.key === currentPlan
              const planOrder = ['FREE', 'STARTER', 'PRO', 'BUSINESS']
              const isDowngrade = planOrder.indexOf(plan.key) < planOrder.indexOf(currentPlan)
              return (
                <div
                  key={plan.key}
                  className={`rounded-xl border p-5 relative transition ${
                    plan.popular
                      ? 'border-brand-500/50 bg-brand-500/5'
                      : isCurrent
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-3">
                    {plan.popular && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">
                        Popular
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Current
                      </span>
                    )}
                    {!plan.popular && !isCurrent && <div className="h-5" />}
                  </div>

                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  <div className="mt-1.5 flex items-baseline gap-0.5">
                    <span className="text-2xl font-bold text-white">{plan.price}</span>
                    <span className="text-sm text-gray-500">{plan.monthly}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-gray-400">{plan.quota}</p>

                  <ul className="mt-4 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                        <Check className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                          plan.popular ? 'text-brand-400' : isCurrent ? 'text-green-400' : 'text-gray-500'
                        }`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Action Button */}
                  <div className="mt-5">
                    {isCurrent ? (
                      <div className="w-full text-center rounded-lg bg-white/5 border border-white/10 py-2.5 text-sm font-medium text-gray-500">
                        Current Plan
                      </div>
                    ) : plan.key === 'FREE' ? (
                      isDowngrade ? (
                        <BillingActions
                          currentPlan={currentPlan}
                          targetPlan={plan.key}
                          hasStripeCustomer={!!user?.stripeCustomerId}
                          regionId={region.id}
                          buttonOnly
                        />
                      ) : null
                    ) : (
                      <BillingActions
                        currentPlan={currentPlan}
                        targetPlan={plan.key}
                        hasStripeCustomer={!!user?.stripeCustomerId}
                        buttonOnly
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT — Credit Packs + Recent Activity */}
        <div className="space-y-6">
          {/* Credit Packs */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="h-4.5 w-4.5 text-yellow-400" />
              <h2 className="text-lg font-semibold text-white">Buy Credits</h2>
            </div>
            <div className="space-y-3">
              {creditPacks.map((pack: { credits: number; price: string; perCredit: string; savings: string | null; index: number; popular?: boolean }) => (
                <div
                  key={pack.credits}
                  className={`rounded-xl border p-4 transition ${
                    pack.popular
                      ? 'border-yellow-500/30 bg-yellow-500/5'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                        pack.popular ? 'bg-yellow-500/10' : 'bg-white/5'
                      }`}>
                        <Zap className={`h-4 w-4 ${pack.popular ? 'text-yellow-400' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{pack.credits} Credits</p>
                        <p className="text-xs text-gray-500">{pack.perCredit}/credit</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-white">{pack.price}</p>
                      {pack.savings && (
                        <span className="text-[10px] font-semibold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                          {pack.savings}
                        </span>
                      )}
                    </div>
                  </div>
                  <BillingActions creditPackIndex={pack.index} regionId={region.id} buttonOnly creditPurchase />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
            </div>
            {recentTransactions.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-gray-600">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {tx.type === 'REFERRAL_REWARD' ? 'Referral reward' :
                         tx.type === 'PURCHASE' ? 'Credit purchase' :
                         tx.type === 'JOB_DEBIT' ? 'Job debit' :
                         tx.type === 'ADMIN_GRANT' ? 'Admin grant' :
                         tx.type === 'REFUND' ? 'Refund' :
                         tx.type === 'MILESTONE_REWARD' ? 'Milestone reward' :
                         tx.type === 'CAMPAIGN_BONUS' ? 'Campaign bonus' :
                         tx.description || tx.type}
                      </p>
                      <p className="text-[10px] text-gray-600">{formatDate(tx.createdAt)}</p>
                    </div>
                    <span className={`text-xs font-semibold flex-shrink-0 ${
                      tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} cr
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Feature Comparison</h2>
          <p className="text-xs text-gray-500 mt-1">See what each plan includes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Feature</th>
                {plans.map((p) => (
                  <th key={p.key} className={`text-center text-xs font-medium uppercase tracking-wider px-4 py-3 ${
                    p.key === currentPlan ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {p.name}
                    {p.key === currentPlan && <span className="block text-[10px] font-normal text-green-400/60 mt-0.5">Current</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { feature: 'Jobs per month', values: ['3', '25', '75', '200'] },
                { feature: 'Modules included', values: ['All 6', 'All 6', 'All 6', 'All 6'] },
                { feature: 'Video quality', values: ['720p', '1080p', '1080p', '1080p'] },
                { feature: 'AI voices', values: ['Basic', '50+', '50+', '50+'] },
                { feature: 'Channel profiles', values: ['-', '1', '5', 'Unlimited'] },
                { feature: 'Watermark', values: ['Yes', 'No', 'No', 'No'] },
                { feature: 'Priority queue', values: ['-', '-', 'Yes', 'Yes'] },
                { feature: 'Custom intros/outros', values: ['-', '-', 'Yes', 'Yes'] },
                { feature: 'Analytics', values: ['-', '-', 'Yes', 'Yes'] },
                { feature: 'API access', values: ['-', '-', '-', 'Yes'] },
                { feature: 'Team collaboration', values: ['-', '-', '-', 'Yes'] },
              ].map((row) => (
                <tr key={row.feature} className="hover:bg-white/[0.02] transition">
                  <td className="px-6 py-3 text-sm text-gray-300">{row.feature}</td>
                  {row.values.map((val, i) => (
                    <td key={i} className="text-center px-4 py-3">
                      {val === 'Yes' ? (
                        <Check className="h-4 w-4 text-green-400 mx-auto" />
                      ) : val === '-' ? (
                        <span className="text-gray-600">-</span>
                      ) : val === 'No' ? (
                        <span className="text-gray-500 text-xs">Watermark</span>
                      ) : (
                        <span className={`text-sm ${plans[i].key === currentPlan ? 'text-white font-medium' : 'text-gray-400'}`}>
                          {val}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Cost per Module */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden mt-6">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="h-4.5 w-4.5 text-yellow-400" />
            Credit Cost per Module
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Each job uses 1 from your monthly quota. Over quota, credits are deducted based on the module:
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Module</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Credit Cost</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Pricing Factor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { module: 'Reels', cost: '1-3 credits', factor: 'Duration: 5-15s = 1, 30s = 2, 60s = 3' },
                { module: 'Quotes', cost: '1 credit', factor: 'Flat rate' },
                { module: 'Challenges', cost: '1-3 credits', factor: '5+ questions +1, voice enabled +1' },
                { module: 'Gameplay', cost: '1-3 credits', factor: 'Duration: 15s = 1, 30s = 2, 45-60s = 3' },
                { module: 'Long-Form Videos', cost: '3-12 credits', factor: '5min = 3, 10min = 5, 15min = 7, 20min = 9, 30min = 12' },
                { module: 'Cartoon Studio', cost: '5 credits', factor: 'Flat rate per episode' },
              ].map((row) => (
                <tr key={row.module} className="hover:bg-white/[0.02] transition">
                  <td className="px-6 py-3 text-sm font-medium text-white">{row.module}</td>
                  <td className="px-4 py-3 text-sm text-yellow-400 font-medium">{row.cost}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.factor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
