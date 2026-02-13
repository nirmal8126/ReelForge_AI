import { prisma } from '@reelforge/db'
import { Users, DollarSign, Film, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export const dynamic = 'force-dynamic'

async function getDashboardData() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [
    totalUsers,
    subscriptions,
    todayJobs,
    completedJobs,
    totalJobs,
    recentUsers,
    recentJobs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.findMany({
      where: { status: 'ACTIVE', plan: { not: 'FREE' } },
      select: { plan: true },
    }),
    prisma.reelJob.count({
      where: { createdAt: { gte: startOfDay } },
    }),
    prisma.reelJob.count({
      where: { status: 'COMPLETED' },
    }),
    prisma.reelJob.count(),
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
    }),
    prisma.reelJob.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
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

  const mrr = subscriptions.reduce((sum, sub) => {
    return sum + (planPrices[sub.plan] || 0)
  }, 0)

  const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0

  return {
    totalUsers,
    mrr,
    todayJobs,
    successRate,
    recentUsers,
    recentJobs,
  }
}

const statusColors: Record<string, string> = {
  QUEUED: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  SCRIPT_GENERATING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  VOICE_GENERATING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  VIDEO_GENERATING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPOSING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  UPLOADING: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData()

  const kpiCards = [
    {
      label: 'Total Users',
      value: data.totalUsers.toLocaleString(),
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Monthly Recurring Revenue',
      value: `$${data.mrr.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Active Jobs Today',
      value: data.todayJobs.toLocaleString(),
      icon: Film,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
    {
      label: 'Success Rate',
      value: `${data.successRate}%`,
      icon: CheckCircle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of your ReelForge AI platform</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-gray-900/60 border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">{card.label}</span>
                <div className={`w-9 h-9 rounded-lg ${card.bg} border ${card.border} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
            </div>
          )
        })}
      </div>

      {/* Recent Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <div className="bg-gray-900/60 border border-white/10 rounded-xl">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-base font-semibold text-white">Recent Signups</h2>
          </div>
          <div className="divide-y divide-white/5">
            {data.recentUsers.map((user) => (
              <div key={user.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium text-brand-400">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                </span>
              </div>
            ))}
            {data.recentUsers.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">
                No users yet
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-gray-900/60 border border-white/10 rounded-xl">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-base font-semibold text-white">Recent Jobs</h2>
          </div>
          <div className="divide-y divide-white/5">
            {data.recentJobs.map((job) => (
              <div key={job.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{job.title}</p>
                  <p className="text-xs text-gray-500 truncate">{job.user.name}</p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                    statusColors[job.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  }`}
                >
                  {job.status.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                </span>
              </div>
            ))}
            {data.recentJobs.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">
                No jobs yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
