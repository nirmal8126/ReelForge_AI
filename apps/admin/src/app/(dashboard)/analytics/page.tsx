import { prisma } from '@reelforge/db'
import { DollarSign, TrendingUp, BarChart3, Film, Palette, Music } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getAnalyticsData() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    activeSubscriptions,
    totalRevenueSubs,
    recentJobs,
    allJobs,
    completedJobs,
  ] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: 'ACTIVE', plan: { not: 'FREE' } },
      select: { plan: true },
    }),
    prisma.subscription.groupBy({
      by: ['plan'],
      where: { status: 'ACTIVE', plan: { not: 'FREE' } },
      _count: true,
    }),
    prisma.reelJob.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.reelJob.count(),
    prisma.reelJob.findMany({
      where: { status: 'COMPLETED' },
      select: {
        style: true,
        musicGenre: true,
        durationSeconds: true,
        aiProvider: true,
      },
    }),
  ])

  // Calculate MRR
  const planPrices: Record<string, number> = {
    STARTER: 19,
    PRO: 49,
    BUSINESS: 99,
    ENTERPRISE: 299,
  }

  const mrr = activeSubscriptions.reduce((sum, sub) => {
    return sum + (planPrices[sub.plan] || 0)
  }, 0)

  const arr = mrr * 12

  // Revenue by plan
  const revenueByPlan = totalRevenueSubs.map((item) => ({
    plan: item.plan,
    count: item._count,
    revenue: item._count * (planPrices[item.plan] || 0),
  }))

  // Top styles from completed jobs
  const styleCounts: Record<string, number> = {}
  const musicCounts: Record<string, number> = {}
  const providerCounts: Record<string, number> = {}
  const durationBuckets: Record<string, number> = {
    '15s': 0,
    '30s': 0,
    '60s': 0,
    '90s+': 0,
  }

  for (const job of completedJobs) {
    if (job.style) {
      styleCounts[job.style] = (styleCounts[job.style] || 0) + 1
    }
    if (job.musicGenre) {
      musicCounts[job.musicGenre] = (musicCounts[job.musicGenre] || 0) + 1
    }
    if (job.aiProvider) {
      providerCounts[job.aiProvider] = (providerCounts[job.aiProvider] || 0) + 1
    }
    if (job.durationSeconds <= 15) durationBuckets['15s']++
    else if (job.durationSeconds <= 30) durationBuckets['30s']++
    else if (job.durationSeconds <= 60) durationBuckets['60s']++
    else durationBuckets['90s+']++
  }

  const topStyles = Object.entries(styleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const topMusic = Object.entries(musicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const topProviders = Object.entries(providerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return {
    mrr,
    arr,
    revenueByPlan,
    recentJobs,
    totalJobs: allJobs,
    completedJobsCount: completedJobs.length,
    topStyles,
    topMusic,
    topProviders,
    durationBuckets,
  }
}

export default async function AdminAnalyticsPage() {
  const data = await getAnalyticsData()

  const revenueCards = [
    {
      label: 'Monthly Recurring Revenue',
      value: `$${data.mrr.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Annual Run Rate',
      value: `$${data.arr.toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Jobs (Last 30 Days)',
      value: data.recentJobs.toLocaleString(),
      icon: Film,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
    {
      label: 'Total Completed Reels',
      value: data.completedJobsCount.toLocaleString(),
      icon: BarChart3,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 mt-1">Platform performance and content insights</p>
      </div>

      {/* Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {revenueCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-gray-900/60 border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">{card.label}</span>
                <div
                  className={`w-9 h-9 rounded-lg ${card.bg} border ${card.border} flex items-center justify-center`}
                >
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
            </div>
          )
        })}
      </div>

      {/* Revenue by Plan */}
      <div className="bg-gray-900/60 border border-white/10 rounded-xl p-5 mb-8">
        <h2 className="text-base font-semibold text-white mb-4">Revenue by Plan</h2>
        {data.revenueByPlan.length > 0 ? (
          <div className="space-y-3">
            {data.revenueByPlan.map((item) => {
              const maxRevenue = Math.max(...data.revenueByPlan.map((r) => r.revenue))
              const percentage = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0
              return (
                <div key={item.plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">{item.plan}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {item.count} subscribers
                      </span>
                      <span className="text-sm font-medium text-white">
                        ${item.revenue.toLocaleString()}/mo
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No paid subscriptions yet</p>
        )}
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900/60 border border-white/10 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-4">Jobs Over Time</h2>
          <div className="h-48 flex items-center justify-center border border-dashed border-white/10 rounded-lg">
            <div className="text-center">
              <BarChart3 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Chart visualization</p>
              <p className="text-xs text-gray-600 mt-1">
                Integrate Recharts for time-series data
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/60 border border-white/10 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-4">Revenue Growth</h2>
          <div className="h-48 flex items-center justify-center border border-dashed border-white/10 rounded-lg">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Chart visualization</p>
              <p className="text-xs text-gray-600 mt-1">
                Integrate Recharts for revenue trends
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Popular Styles */}
        <div className="bg-gray-900/60 border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Popular Styles</h2>
          </div>
          {data.topStyles.length > 0 ? (
            <div className="space-y-2.5">
              {data.topStyles.map(([style, count], idx) => {
                const max = data.topStyles[0][1]
                const pct = max > 0 ? (count / max) * 100 : 0
                return (
                  <div key={style}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300 capitalize">
                        {style.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <span className="text-xs text-gray-500">{count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500/70 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No style data yet</p>
          )}
        </div>

        {/* Popular Music Genres */}
        <div className="bg-gray-900/60 border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-4 h-4 text-pink-400" />
            <h2 className="text-base font-semibold text-white">Music Genres</h2>
          </div>
          {data.topMusic.length > 0 ? (
            <div className="space-y-2.5">
              {data.topMusic.map(([genre, count]) => {
                const max = data.topMusic[0][1]
                const pct = max > 0 ? (count / max) * 100 : 0
                return (
                  <div key={genre}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300 capitalize">
                        {genre.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <span className="text-xs text-gray-500">{count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-pink-500/70 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No music data yet</p>
          )}
        </div>

        {/* Duration Distribution */}
        <div className="bg-gray-900/60 border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Film className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Duration Distribution</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(data.durationBuckets).map(([bucket, count]) => {
              const maxCount = Math.max(...Object.values(data.durationBuckets))
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <div key={bucket}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">{bucket}</span>
                    <span className="text-xs text-gray-500">{count} reels</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500/70 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* AI Providers */}
          {data.topProviders.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/10">
              <h3 className="text-sm font-medium text-gray-400 mb-3">AI Providers</h3>
              <div className="flex flex-wrap gap-2">
                {data.topProviders.map(([provider, count]) => (
                  <span
                    key={provider}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800/50 border border-white/5 text-xs text-gray-300"
                  >
                    {provider}
                    <span className="text-gray-500">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
