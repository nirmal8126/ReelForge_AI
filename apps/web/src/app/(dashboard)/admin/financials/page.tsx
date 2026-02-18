import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import { format, subDays } from 'date-fns'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  PiggyBank,
} from 'lucide-react'
import {
  RevenueVsCostChart,
  CostBreakdownChart,
  GrowthIndicator,
  ServiceStatusPanel,
} from '@/components/dashboard/financial-charts'

/* ─── Constants ─── */

const PLAN_PRICES_CENTS: Record<string, number> = {
  STARTER: 1900,
  PRO: 4900,
  BUSINESS: 9900,
  ENTERPRISE: 29900,
}

// Average estimated cost per completed job (in cents)
const MODULE_AVG_COST_CENTS: Record<string, number> = {
  reels: 35,
  quotes: 8,
  challenges_no_voice: 10,
  challenges_voice: 32,
  gameplay: 30,
  longform_per_min: 40,
  longform_fallback: 200, // if no durationMinutes
  cartoon: 400,
}

const AVG_CREDIT_PRICE_CENTS = 80 // ~$0.80 per credit

const SERVICES = [
  { key: 'anthropic', name: 'Anthropic (Claude)', category: 'AI Models', envVar: 'ANTHROPIC_API_KEY' },
  { key: 'openai', name: 'OpenAI (GPT)', category: 'AI Models', envVar: 'OPENAI_API_KEY' },
  { key: 'gemini', name: 'Google Gemini', category: 'AI Models', envVar: 'GEMINI_API_KEY' },
  { key: 'runwayml', name: 'RunwayML', category: 'Video Generation', envVar: 'RUNWAYML_API_SECRET' },
  { key: 'elevenlabs', name: 'ElevenLabs', category: 'Audio', envVar: 'ELEVENLABS_API_KEY' },
  { key: 'pexels', name: 'Pexels', category: 'Stock Media', envVar: 'PEXELS_API_KEY' },
  { key: 'pixabay', name: 'Pixabay', category: 'Stock Media', envVar: 'PIXABAY_API_KEY' },
  { key: 'stripe', name: 'Stripe', category: 'Payments', envVar: 'STRIPE_SECRET_KEY' },
  { key: 'r2', name: 'Cloudflare R2', category: 'Storage', envVar: 'R2_ACCESS_KEY_ID' },
  { key: 'resend', name: 'Resend', category: 'Email', envVar: 'RESEND_API_KEY' },
  { key: 'redis', name: 'Redis (Upstash)', category: 'Cache / Queue', envVar: 'UPSTASH_REDIS_REST_URL' },
]

/* ─── Helpers ─── */

function buildDateMap(days: number) {
  const map: Record<string, { revenue: number; cost: number }> = {}
  for (let i = days - 1; i >= 0; i--) {
    map[format(subDays(new Date(), i), 'MMM dd')] = { revenue: 0, cost: 0 }
  }
  return map
}

/* ─── Data Fetching ─── */

async function getFinancialData() {
  const now = new Date()
  const thirtyDaysAgo = subDays(now, 30)
  const sixtyDaysAgo = subDays(now, 60)

  const [
    // Subscriptions
    activePaidSubs,
    cancelledSubs30d,
    // Credit purchases
    creditPurchases30d,
    creditPurchasesPrev30d,
    // Completed jobs (30d) for cost estimation
    completedReels30d,
    completedQuotes30d,
    completedChallengesNoVoice30d,
    completedChallengesVoice30d,
    completedGameplay30d,
    completedLongForm30d,
    completedCartoon30d,
    // Completed jobs (prev 30d) for growth
    completedReelsPrev,
    completedQuotesPrev,
    completedChallengesPrev,
    completedGameplayPrev,
    completedLongFormPrev,
    completedCartoonPrev,
    // All-time completed counts for cost breakdown
    allReels,
    allQuotes,
    allChallengesNoVoice,
    allChallengesVoice,
    allGameplay,
    allLongForm,
    allCartoon,
    // User growth
    usersThisMonth,
    usersLastMonth,
    // Daily completed jobs by module (30 days) for cost chart
    dailyReels,
    dailyQuotes,
    dailyChallenges,
    dailyGameplay,
    dailyLongForm,
    dailyCartoon,
    // Long-form jobs with estimatedCostCents
    longFormWithCosts,
  ] = await Promise.all([
    // Active paid subscriptions
    prisma.subscription.findMany({
      where: { status: 'ACTIVE', plan: { not: 'FREE' } },
      select: { plan: true },
    }),
    // Cancelled subs in 30d
    prisma.subscription.count({
      where: { status: 'CANCELED', updatedAt: { gte: thirtyDaysAgo } },
    }),
    // Credit purchases (30d + prev 30d)
    prisma.creditTransaction.findMany({
      where: { type: 'PURCHASE', createdAt: { gte: thirtyDaysAgo } },
      select: { amount: true, createdAt: true },
    }),
    prisma.creditTransaction.findMany({
      where: { type: 'PURCHASE', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      select: { amount: true },
    }),
    // Completed jobs 30d per module
    prisma.reelJob.count({ where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.quoteJob.count({ where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.challengeJob.count({ where: { status: 'COMPLETED', voiceEnabled: false, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.challengeJob.count({ where: { status: 'COMPLETED', voiceEnabled: true, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.gameplayJob.count({ where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.longFormJob.count({ where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.cartoonEpisode.count({ where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } } }),
    // Prev 30d completed for growth
    prisma.reelJob.count({ where: { status: 'COMPLETED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.quoteJob.count({ where: { status: 'COMPLETED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.challengeJob.count({ where: { status: 'COMPLETED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.gameplayJob.count({ where: { status: 'COMPLETED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.longFormJob.count({ where: { status: 'COMPLETED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.cartoonEpisode.count({ where: { status: 'COMPLETED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    // All-time completed per module (for cost breakdown)
    prisma.reelJob.count({ where: { status: 'COMPLETED' } }),
    prisma.quoteJob.count({ where: { status: 'COMPLETED' } }),
    prisma.challengeJob.count({ where: { status: 'COMPLETED', voiceEnabled: false } }),
    prisma.challengeJob.count({ where: { status: 'COMPLETED', voiceEnabled: true } }),
    prisma.gameplayJob.count({ where: { status: 'COMPLETED' } }),
    prisma.longFormJob.count({ where: { status: 'COMPLETED' } }),
    prisma.cartoonEpisode.count({ where: { status: 'COMPLETED' } }),
    // User growth
    prisma.user.count({ where: { createdAt: { gte: subDays(now, 30) } } }),
    prisma.user.count({ where: { createdAt: { gte: subDays(now, 60), lt: subDays(now, 30) } } }),
    // Daily completed jobs for cost chart
    prisma.reelJob.findMany({ where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.quoteJob.findMany({ where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.challengeJob.findMany({ where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true, voiceEnabled: true } }),
    prisma.gameplayJob.findMany({ where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.longFormJob.findMany({ where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true, durationMinutes: true, estimatedCostCents: true } }),
    prisma.cartoonEpisode.findMany({ where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    // Long-form jobs with cost data for better estimates
    prisma.longFormJob.findMany({
      where: { status: 'COMPLETED', estimatedCostCents: { not: null } },
      select: { estimatedCostCents: true, durationMinutes: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // ─── MRR Calculation ───
  const planCounts: Record<string, number> = {}
  for (const sub of activePaidSubs) {
    planCounts[sub.plan] = (planCounts[sub.plan] || 0) + 1
  }
  const mrrCents = Object.entries(planCounts).reduce(
    (sum, [plan, count]) => sum + (PLAN_PRICES_CENTS[plan] || 0) * count,
    0
  )

  // ─── Credit Revenue (30d) ───
  const creditRevenue30dCents = creditPurchases30d.reduce(
    (sum, tx) => sum + tx.amount * AVG_CREDIT_PRICE_CENTS,
    0
  )
  const creditRevenuePrev30dCents = creditPurchasesPrev30d.reduce(
    (sum, tx) => sum + tx.amount * AVG_CREDIT_PRICE_CENTS,
    0
  )

  const totalRevenue30dCents = mrrCents + creditRevenue30dCents

  // ─── Cost Calculation (30d) ───
  // Better long-form cost: use actual estimatedCostCents when available
  const avgLongFormCostCents = longFormWithCosts.length > 0
    ? Math.round(longFormWithCosts.reduce((sum, j) => sum + (j.estimatedCostCents || 0), 0) / longFormWithCosts.length)
    : MODULE_AVG_COST_CENTS.longform_fallback

  const totalCost30dCents =
    completedReels30d * MODULE_AVG_COST_CENTS.reels +
    completedQuotes30d * MODULE_AVG_COST_CENTS.quotes +
    completedChallengesNoVoice30d * MODULE_AVG_COST_CENTS.challenges_no_voice +
    completedChallengesVoice30d * MODULE_AVG_COST_CENTS.challenges_voice +
    completedGameplay30d * MODULE_AVG_COST_CENTS.gameplay +
    completedLongForm30d * avgLongFormCostCents +
    completedCartoon30d * MODULE_AVG_COST_CENTS.cartoon

  const profitCents = totalRevenue30dCents - totalCost30dCents

  // ─── Revenue vs Cost Chart (daily, 30d) ───
  const chartDateMap = buildDateMap(30)

  // Add daily subscription revenue (MRR / 30 per day)
  const dailySubRevenueCents = Math.round(mrrCents / 30)
  for (const key of Object.keys(chartDateMap)) {
    chartDateMap[key].revenue += dailySubRevenueCents / 100
  }

  // Add credit purchase revenue per day
  for (const tx of creditPurchases30d) {
    const key = format(new Date(tx.createdAt), 'MMM dd')
    if (key in chartDateMap) {
      chartDateMap[key].revenue += (tx.amount * AVG_CREDIT_PRICE_CENTS) / 100
    }
  }

  // Add daily costs per completed job
  for (const job of dailyReels) {
    const key = format(new Date(job.createdAt), 'MMM dd')
    if (key in chartDateMap) chartDateMap[key].cost += MODULE_AVG_COST_CENTS.reels / 100
  }
  for (const job of dailyQuotes) {
    const key = format(new Date(job.createdAt), 'MMM dd')
    if (key in chartDateMap) chartDateMap[key].cost += MODULE_AVG_COST_CENTS.quotes / 100
  }
  for (const job of dailyChallenges) {
    const key = format(new Date(job.createdAt), 'MMM dd')
    if (key in chartDateMap) {
      chartDateMap[key].cost += (job.voiceEnabled
        ? MODULE_AVG_COST_CENTS.challenges_voice
        : MODULE_AVG_COST_CENTS.challenges_no_voice) / 100
    }
  }
  for (const job of dailyGameplay) {
    const key = format(new Date(job.createdAt), 'MMM dd')
    if (key in chartDateMap) chartDateMap[key].cost += MODULE_AVG_COST_CENTS.gameplay / 100
  }
  for (const job of dailyLongForm) {
    const key = format(new Date(job.createdAt), 'MMM dd')
    if (key in chartDateMap) {
      const cost = job.estimatedCostCents
        ? job.estimatedCostCents
        : (job.durationMinutes || 10) * MODULE_AVG_COST_CENTS.longform_per_min
      chartDateMap[key].cost += cost / 100
    }
  }
  for (const job of dailyCartoon) {
    const key = format(new Date(job.createdAt), 'MMM dd')
    if (key in chartDateMap) chartDateMap[key].cost += MODULE_AVG_COST_CENTS.cartoon / 100
  }

  const revenueVsCostData = Object.entries(chartDateMap).map(([date, vals]) => ({
    date,
    revenue: Math.round(vals.revenue * 100) / 100,
    cost: Math.round(vals.cost * 100) / 100,
  }))

  // ─── Cost Breakdown by Module (all-time) ───
  const costBreakdown = [
    {
      module: 'Cartoon Studio',
      cost: allCartoon * MODULE_AVG_COST_CENTS.cartoon,
      count: allCartoon,
      color: '#10B981',
    },
    {
      module: 'Long-Form Videos',
      cost: allLongForm * avgLongFormCostCents,
      count: allLongForm,
      color: '#818CF8',
    },
    {
      module: 'Reels',
      cost: allReels * MODULE_AVG_COST_CENTS.reels,
      count: allReels,
      color: '#6366F1',
    },
    {
      module: '3D Gameplay',
      cost: allGameplay * MODULE_AVG_COST_CENTS.gameplay,
      count: allGameplay,
      color: '#EC4899',
    },
    {
      module: 'Challenges',
      cost: allChallengesNoVoice * MODULE_AVG_COST_CENTS.challenges_no_voice +
        allChallengesVoice * MODULE_AVG_COST_CENTS.challenges_voice,
      count: allChallengesNoVoice + allChallengesVoice,
      color: '#F97316',
    },
    {
      module: 'Quotes',
      cost: allQuotes * MODULE_AVG_COST_CENTS.quotes,
      count: allQuotes,
      color: '#06B6D4',
    },
  ].sort((a, b) => b.cost - a.cost)

  // ─── Subscription Revenue Breakdown ───
  const planLabels: Record<string, string> = {
    STARTER: 'Starter ($19/mo)',
    PRO: 'Pro ($49/mo)',
    BUSINESS: 'Business ($99/mo)',
    ENTERPRISE: 'Enterprise ($299/mo)',
  }
  const planColors: Record<string, string> = {
    STARTER: '#3B82F6',
    PRO: '#8B5CF6',
    BUSINESS: '#F59E0B',
    ENTERPRISE: '#EF4444',
  }
  const subscriptionBreakdown = Object.entries(PLAN_PRICES_CENTS)
    .map(([plan, priceCents]) => ({
      plan: planLabels[plan] || plan,
      subscribers: planCounts[plan] || 0,
      revenueCents: (planCounts[plan] || 0) * priceCents,
      color: planColors[plan] || '#6B7280',
    }))
    .filter((p) => p.subscribers > 0)

  // ─── Growth Indicators ───
  const totalJobs30d = completedReels30d + completedQuotes30d + completedChallengesNoVoice30d +
    completedChallengesVoice30d + completedGameplay30d + completedLongForm30d + completedCartoon30d
  const totalJobsPrev = completedReelsPrev + completedQuotesPrev + completedChallengesPrev +
    completedGameplayPrev + completedLongFormPrev + completedCartoonPrev

  const userGrowth = usersLastMonth > 0
    ? Math.round(((usersThisMonth - usersLastMonth) / usersLastMonth) * 100)
    : usersThisMonth > 0 ? 100 : 0

  const revenueGrowth = creditRevenuePrev30dCents > 0
    ? Math.round(((creditRevenue30dCents - creditRevenuePrev30dCents) / creditRevenuePrev30dCents) * 100)
    : creditRevenue30dCents > 0 ? 100 : 0

  const jobGrowth = totalJobsPrev > 0
    ? Math.round(((totalJobs30d - totalJobsPrev) / totalJobsPrev) * 100)
    : totalJobs30d > 0 ? 100 : 0

  const totalActiveSubs = activePaidSubs.length
  const churnRate = totalActiveSubs + cancelledSubs30d > 0
    ? Math.round((cancelledSubs30d / (totalActiveSubs + cancelledSubs30d)) * 100)
    : 0

  // ─── Service Status ───
  const services = SERVICES.map((svc) => ({
    key: svc.key,
    name: svc.name,
    category: svc.category,
    isConfigured: !!process.env[svc.envVar],
  }))

  return {
    // KPIs
    totalRevenue30dCents,
    mrrCents,
    totalCost30dCents,
    profitCents,
    // Charts
    revenueVsCostData,
    // Breakdowns
    subscriptionBreakdown,
    creditRevenue30dCents,
    creditPurchaseCount: creditPurchases30d.length,
    costBreakdown,
    // Growth
    userGrowth,
    revenueGrowth,
    jobGrowth,
    churnRate,
    // Services
    services,
  }
}

/* ─── Page Component ─── */

export default async function AdminFinancialsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') redirect('/dashboard')

  const data = await getFinancialData()

  const isProfit = data.profitCents >= 0

  return (
    <div>
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-white/[0.06]">
        <h1 className="text-3xl font-bold text-white tracking-tight">Platform Financials</h1>
        <p className="text-sm text-gray-500 mt-2">Revenue, costs, profit/loss analysis, and service health</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Revenue (30d) */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Revenue (30d)</span>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-400">
            ${(data.totalRevenue30dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">Subscriptions + Credits</p>
        </div>

        {/* MRR */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">MRR</span>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">
            ${(data.mrrCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">Monthly Recurring Revenue</p>
        </div>

        {/* Est. Cost (30d) */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Est. Cost (30d)</span>
            <div className="h-9 w-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-orange-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-orange-400">
            ${(data.totalCost30dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">API & infrastructure costs</p>
        </div>

        {/* Profit / Loss */}
        <div className={`rounded-xl border p-6 ${isProfit ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : 'border-red-500/20 bg-red-500/[0.03]'}`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">{isProfit ? 'Est. Profit' : 'Est. Loss'}</span>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isProfit ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              {isProfit ? (
                <PiggyBank className="h-4 w-4 text-emerald-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
            </div>
          </div>
          <p className={`text-3xl font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfit ? '+' : '-'}${(Math.abs(data.profitCents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {isProfit ? 'Platform is profitable' : 'Costs exceed revenue'}
          </p>
        </div>
      </div>

      {/* Revenue vs Cost Chart */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 mb-8">
        <h3 className="text-sm font-semibold text-white mb-4">Revenue vs Cost (30 days)</h3>
        <RevenueVsCostChart data={data.revenueVsCostData} />
      </div>

      {/* Revenue Breakdown + Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Breakdown */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="text-sm font-semibold text-white mb-5">Revenue Breakdown</h3>

          {/* Subscription Revenue */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-3">
              Subscription Revenue
            </p>
            {data.subscriptionBreakdown.length === 0 ? (
              <p className="text-xs text-gray-500">No paid subscribers yet</p>
            ) : (
              <div className="space-y-3">
                {data.subscriptionBreakdown.map((item) => (
                  <div key={item.plan} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-gray-300">{item.plan}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-white">
                        ${(item.revenueCents / 100).toLocaleString()}/mo
                      </span>
                      <span className="text-[10px] text-gray-500 ml-2">
                        {item.subscribers} sub{item.subscribers !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Credit Purchase Revenue */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-3">
              Credit Purchases (30d)
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300">{data.creditPurchaseCount} purchases</span>
              <span className="text-xs font-semibold text-white">
                ${(data.creditRevenue30dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Cost Breakdown by Module */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="text-sm font-semibold text-white mb-1">Cost Breakdown by Module</h3>
          <p className="text-[10px] text-gray-500 mb-3">Estimated all-time API costs (sorted by highest)</p>
          <CostBreakdownChart data={data.costBreakdown} />
        </div>
      </div>

      {/* Service Status */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 mb-8">
        <ServiceStatusPanel services={data.services} />
      </div>

      {/* Growth Indicators */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-white mb-4">Growth Indicators (30d vs prev 30d)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <GrowthIndicator
            label="User Growth"
            value={data.userGrowth}
            positive={data.userGrowth >= 0}
            neutral={data.userGrowth === 0}
          />
          <GrowthIndicator
            label="Revenue Growth"
            value={data.revenueGrowth}
            positive={data.revenueGrowth >= 0}
            neutral={data.revenueGrowth === 0}
          />
          <GrowthIndicator
            label="Job Growth"
            value={data.jobGrowth}
            positive={data.jobGrowth >= 0}
            neutral={data.jobGrowth === 0}
          />
          <GrowthIndicator
            label="Churn Rate"
            value={data.churnRate}
            positive={data.churnRate <= 5}
            neutral={data.churnRate === 0}
          />
        </div>
      </div>
    </div>
  )
}
