import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Film, PlusCircle, TrendingUp, Zap, CreditCard, Users } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [subscription, recentReels, totalReels] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: session.user.id } }),
    prisma.reelJob.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.reelJob.count({ where: { userId: session.user.id } }),
  ])

  const jobsUsed = subscription?.jobsUsed || 0
  const jobsLimit = subscription?.jobsLimit || 3
  const usagePercent = jobsLimit > 0 ? Math.round((jobsUsed / jobsLimit) * 100) : 0

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-white/[0.06]">
        <h1 className="text-3xl font-bold text-white tracking-tight">Welcome back, {session.user.name?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500 mt-2">Here&apos;s your content creation overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Reels This Month</span>
            <Film className="h-5 w-5 text-brand-400" />
          </div>
          <p className="text-3xl font-bold text-white">{jobsUsed}</p>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{jobsUsed} / {jobsLimit} used</span>
              <span>{usagePercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-brand-500 transition-all"
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Total Reels</span>
            <TrendingUp className="h-5 w-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">{totalReels}</p>
          <p className="mt-2 text-xs text-gray-500">All time</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Credits</span>
            <Zap className="h-5 w-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-white">{session.user.creditsBalance || 0}</p>
          <p className="mt-2 text-xs text-gray-500">Available balance</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Current Plan</span>
            <CreditCard className="h-5 w-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-white capitalize">{subscription?.plan?.toLowerCase() || 'Free'}</p>
          <Link href="/billing" className="mt-2 text-xs text-brand-400 hover:text-brand-300">
            Upgrade plan
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          href="/reels/new"
          className="flex items-center gap-4 rounded-xl border border-brand-500/30 bg-brand-500/10 p-6 hover:bg-brand-500/20 transition group"
        >
          <div className="h-12 w-12 rounded-xl bg-brand-500 flex items-center justify-center group-hover:scale-110 transition">
            <PlusCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Create New Reel</h3>
            <p className="text-sm text-gray-400">Generate an AI-powered video reel</p>
          </div>
        </Link>

        <Link
          href="/profiles"
          className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition"
        >
          <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Users className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Channel Profiles</h3>
            <p className="text-sm text-gray-400">Manage your brand consistency</p>
          </div>
        </Link>
      </div>

      {/* Recent Reels */}
      <div className="rounded-xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Recent Reels</h2>
          <Link href="/reels" className="text-sm text-brand-400 hover:text-brand-300">View all</Link>
        </div>
        {recentReels.length === 0 ? (
          <div className="p-12 text-center">
            <Film className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No reels yet</h3>
            <p className="text-gray-400 mb-6">Create your first AI-powered reel to get started</p>
            <Link href="/reels/new" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition">
              <PlusCircle className="h-4 w-4" />
              Create First Reel
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {recentReels.map((reel) => (
              <Link key={reel.id} href={`/reels/${reel.id}`} className="flex items-center gap-4 p-4 hover:bg-white/5 transition">
                <div className="h-10 w-10 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Film className="h-5 w-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{reel.title}</p>
                  <p className="text-xs text-gray-400">{reel.durationSeconds}s &middot; {reel.style || 'Default'}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  reel.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                  reel.status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                  'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {reel.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
