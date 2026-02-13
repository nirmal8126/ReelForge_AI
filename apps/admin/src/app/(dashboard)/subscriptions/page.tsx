import { prisma } from '@reelforge/db'
import { format } from 'date-fns'
import { CreditCard } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionsPage() {
  const subscriptions = await prisma.subscription.findMany({
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Summary by plan
  const planCounts: Record<string, number> = {}
  for (const sub of subscriptions) {
    planCounts[sub.plan] = (planCounts[sub.plan] || 0) + 1
  }

  const planOrder = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']
  const planColors: Record<string, { bg: string; text: string; border: string }> = {
    FREE: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
    STARTER: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    PRO: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
    BUSINESS: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    ENTERPRISE: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  }

  const statusBadge: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    CANCELED: 'bg-red-500/10 text-red-400 border-red-500/20',
    PAST_DUE: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    TRIALING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
        <p className="text-gray-400 mt-1">
          {subscriptions.length.toLocaleString()} total subscriptions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {planOrder.map((plan) => {
          const colors = planColors[plan] || planColors.FREE
          return (
            <div
              key={plan}
              className="bg-gray-900/60 border border-white/10 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
                >
                  {plan}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">
                {(planCounts[plan] || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">subscribers</p>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-gray-900/60 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  User
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Plan
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Jobs Used / Limit
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Period End
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Stripe ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {subscriptions.map((sub) => {
                const colors = planColors[sub.plan] || planColors.FREE
                return (
                  <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{sub.user.name}</p>
                        <p className="text-xs text-gray-500">{sub.user.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
                      >
                        {sub.plan}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          statusBadge[sub.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}
                      >
                        {sub.status}
                        {sub.cancelAtPeriodEnd && (
                          <span className="ml-1 text-yellow-400">(canceling)</span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-300">
                          {sub.jobsUsed} / {sub.jobsLimit}
                        </span>
                        <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all"
                            style={{
                              width: `${Math.min((sub.jobsUsed / sub.jobsLimit) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-gray-500">
                        {sub.currentPeriodEnd
                          ? format(new Date(sub.currentPeriodEnd), 'MMM d, yyyy')
                          : '--'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-500 font-mono">
                        {sub.stripeSubscriptionId
                          ? `${sub.stripeSubscriptionId.slice(0, 20)}...`
                          : '--'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <CreditCard className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No subscriptions found</p>
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
