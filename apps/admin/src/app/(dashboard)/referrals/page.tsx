import { prisma } from '@reelforge/db'
import { format, formatDistanceToNow } from 'date-fns'
import { Gift, Users, TrendingUp, Coins } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminReferralsPage() {
  const [referrals, totalReferrals, completedReferrals, totalCreditsAwarded] =
    await Promise.all([
      prisma.referral.findMany({
        include: {
          referrer: { select: { name: true, email: true } },
          referred: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.referral.count(),
      prisma.referral.count({
        where: { status: { in: ['COMPLETED', 'PAID'] } },
      }),
      prisma.referral.aggregate({
        _sum: { referrerRewardCredits: true },
      }),
    ])

  const conversionRate =
    totalReferrals > 0
      ? Math.round((completedReferrals / totalReferrals) * 100)
      : 0

  const creditsAwarded = totalCreditsAwarded._sum.referrerRewardCredits || 0

  const statusBadge: Record<string, string> = {
    PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    PAID: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  }

  const statCards = [
    {
      label: 'Total Referrals',
      value: totalReferrals.toLocaleString(),
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Conversion Rate',
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Credits Awarded',
      value: creditsAwarded.toLocaleString(),
      icon: Coins,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Referrals</h1>
        <p className="text-gray-400 mt-1">Referral program overview and activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => {
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

      {/* Recent Referrals Table */}
      <div className="bg-gray-900/60 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Recent Referrals</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Referrer
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Referred User
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Code
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Credits Reward
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Cash Reward
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {referrals.map((ref) => (
                <tr key={ref.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{ref.referrer.name}</p>
                      <p className="text-xs text-gray-500">{ref.referrer.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-300">{ref.referred.name}</p>
                      <p className="text-xs text-gray-500">{ref.referred.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-mono text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded">
                      {ref.referralCodeUsed}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        statusBadge[ref.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}
                    >
                      {ref.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-300">
                      {ref.referrerRewardCredits > 0
                        ? `+${ref.referrerRewardCredits}`
                        : '--'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-300">
                      {ref.referrerRewardCashCents > 0
                        ? `$${(ref.referrerRewardCashCents / 100).toFixed(2)}`
                        : '--'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(ref.createdAt), { addSuffix: true })}
                    </span>
                  </td>
                </tr>
              ))}
              {referrals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <Gift className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No referrals yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
