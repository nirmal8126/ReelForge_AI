import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow, format, subDays } from 'date-fns'
import {
  Film,
  PlusCircle,
  TrendingUp,
  Zap,
  CreditCard,
  Users,
  Quote,
  Gamepad2,
  Joystick,
  Video,
  Clapperboard,
  ImageIcon,
  CheckCircle,
  DollarSign,
  Shield,
  Globe,
  Megaphone,
  Wrench,
  Activity,
  type LucideIcon,
} from 'lucide-react'
import { DashboardBanners } from '@/components/banners/dashboard-banners'
import {
  ModuleBreakdownChart,
  CreationTimelineChart,
  SignupsChart,
  JobsPerDayChart,
  RevenuePlanChart,
} from '@/components/dashboard/dashboard-charts'

/* ─── Shared constants ─── */

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-green-500/10 text-green-400',
  FAILED: 'bg-red-500/10 text-red-400',
  QUEUED: 'bg-yellow-500/10 text-yellow-400',
}

function getStatusBadge(status: string) {
  return STATUS_BADGE[status] || 'bg-blue-500/10 text-blue-400'
}

const MODULE_META: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  reel: { icon: Film, label: 'Reel', color: 'text-brand-400' },
  quote: { icon: Quote, label: 'Quote', color: 'text-cyan-400' },
  challenge: { icon: Gamepad2, label: 'Challenge', color: 'text-orange-400' },
  gameplay: { icon: Joystick, label: 'Gameplay', color: 'text-pink-400' },
  longform: { icon: Video, label: 'Long-Form', color: 'text-indigo-400' },
  cartoon: { icon: Clapperboard, label: 'Cartoon', color: 'text-emerald-400' },
  imagestudio: { icon: ImageIcon, label: 'Image Studio', color: 'text-amber-400' },
}

/* ─── Helpers ─── */

function buildDateMap(days: number) {
  const map: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) {
    map[format(subDays(new Date(), i), 'MMM dd')] = 0
  }
  return map
}

function groupByDate(items: { createdAt: Date }[]) {
  const map: Record<string, number> = {}
  for (const item of items) {
    const key = format(new Date(item.createdAt), 'MMM dd')
    map[key] = (map[key] || 0) + 1
  }
  return map
}

/* ─── User data fetching ─── */

type ActivityItem = {
  id: string
  module: string
  title: string
  status: string
  createdAt: Date
  href: string
}

async function getUserData(userId: string) {
  const thirtyDaysAgo = subDays(new Date(), 30)

  const [
    subscription,
    reelCount,
    quoteCount,
    challengeCount,
    gameplayCount,
    longFormCount,
    cartoonCount,
    imageStudioCount,
    recentReels,
    recentQuotes,
    recentChallenges,
    recentGameplay,
    recentLongForm,
    recentCartoons,
    recentImageStudio,
    // Last 30 days raw data for timeline
    reels30d,
    quotes30d,
    challenges30d,
    gameplay30d,
    longForm30d,
    cartoon30d,
    imageStudio30d,
  ] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.reelJob.count({ where: { userId } }),
    prisma.quoteJob.count({ where: { userId } }),
    prisma.challengeJob.count({ where: { userId } }),
    prisma.gameplayJob.count({ where: { userId } }),
    prisma.longFormJob.count({ where: { userId } }),
    prisma.cartoonEpisode.count({ where: { series: { userId } } }),
    prisma.imageStudioJob.count({ where: { userId } }),
    prisma.reelJob.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, title: true, status: true, createdAt: true },
    }),
    prisma.quoteJob.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, quoteText: true, category: true, status: true, createdAt: true },
    }),
    prisma.challengeJob.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, challengeType: true, category: true, status: true, createdAt: true },
    }),
    prisma.gameplayJob.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, template: true, gameTitle: true, status: true, createdAt: true },
    }),
    prisma.longFormJob.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, title: true, status: true, createdAt: true },
    }),
    prisma.cartoonEpisode.findMany({
      where: { series: { userId } }, orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, title: true, status: true, createdAt: true, seriesId: true },
    }),
    prisma.imageStudioJob.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, title: true, mode: true, status: true, createdAt: true },
    }),
    // Timeline data — last 30 days (just need createdAt)
    prisma.reelJob.findMany({ where: { userId, createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.quoteJob.findMany({ where: { userId, createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.challengeJob.findMany({ where: { userId, createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.gameplayJob.findMany({ where: { userId, createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.longFormJob.findMany({ where: { userId, createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.cartoonEpisode.findMany({ where: { series: { userId }, createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.imageStudioJob.findMany({ where: { userId, createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
  ])

  const totalContent = reelCount + quoteCount + challengeCount + gameplayCount + longFormCount + cartoonCount + imageStudioCount

  // Module breakdown for pie chart
  const moduleBreakdown = [
    { name: 'Reels', value: reelCount },
    { name: 'Quotes', value: quoteCount },
    { name: 'Challenges', value: challengeCount },
    { name: 'Gameplay', value: gameplayCount },
    { name: 'Long-Form', value: longFormCount },
    { name: 'Cartoon', value: cartoonCount },
    { name: 'Image Studio', value: imageStudioCount },
  ]

  // Timeline — merge all jobs by date
  const dateMap = buildDateMap(30)
  const allJobs30d = [...reels30d, ...quotes30d, ...challenges30d, ...gameplay30d, ...longForm30d, ...cartoon30d, ...imageStudio30d]
  const grouped = groupByDate(allJobs30d)
  for (const [key, val] of Object.entries(grouped)) {
    if (key in dateMap) dateMap[key] = val
  }
  const timeline = Object.entries(dateMap).map(([date, count]) => ({ date, count }))

  // Activity feed
  const activity: ActivityItem[] = [
    ...recentReels.map((r) => ({
      id: r.id, module: 'reel', title: r.title,
      status: r.status, createdAt: r.createdAt, href: `/reels/${r.id}`,
    })),
    ...recentQuotes.map((q) => ({
      id: q.id, module: 'quote',
      title: q.quoteText?.slice(0, 60) || q.category || 'Quote',
      status: q.status, createdAt: q.createdAt, href: `/quotes/${q.id}`,
    })),
    ...recentChallenges.map((c) => ({
      id: c.id, module: 'challenge',
      title: `${c.challengeType.replace(/_/g, ' ')} — ${c.category || ''}`.trim(),
      status: c.status, createdAt: c.createdAt, href: `/challenges/${c.id}`,
    })),
    ...recentGameplay.map((g) => ({
      id: g.id, module: 'gameplay',
      title: g.gameTitle || g.template.replace(/_/g, ' '),
      status: g.status, createdAt: g.createdAt, href: `/gameplay/${g.id}`,
    })),
    ...recentLongForm.map((l) => ({
      id: l.id, module: 'longform', title: l.title,
      status: l.status, createdAt: l.createdAt, href: `/long-form/${l.id}`,
    })),
    ...recentCartoons.map((e) => ({
      id: e.id, module: 'cartoon', title: e.title,
      status: e.status, createdAt: e.createdAt,
      href: `/cartoon-studio/${e.seriesId}/episodes/${e.id}`,
    })),
    ...recentImageStudio.map((j) => ({
      id: j.id, module: 'imagestudio',
      title: j.title || `${j.mode} job`,
      status: j.status, createdAt: j.createdAt, href: `/image-studio/${j.id}`,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)

  return { subscription, totalContent, moduleBreakdown, timeline, activity }
}

/* ─── Admin data fetching ─── */

async function getAdminData() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thirtyDaysAgo = subDays(now, 30)

  const [
    totalUsers,
    paidSubs,
    todayReels, todayQuotes, todayChallenges, todayGameplay, todayLongForm, todayCartoons, todayImageStudio,
    totalReels, completedReels,
    totalQuotes, completedQuotes,
    totalChallenges, completedChallenges,
    totalGameplay, completedGameplay,
    totalLongForm, completedLongForm,
    totalCartoons, completedCartoons,
    totalImageStudio, completedImageStudio,
    recentUsers,
    latestReels, latestQuotes, latestChallenges, latestGameplay, latestLongForm, latestCartoons, latestImageStudio,
    // Time series data
    users30d,
    reels30d, quotes30d, challenges30d, gameplay30d, longForm30d, cartoon30d, imageStudio30d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.findMany({ where: { status: 'ACTIVE', plan: { not: 'FREE' } }, select: { plan: true } }),
    // Today counts
    prisma.reelJob.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.quoteJob.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.challengeJob.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.gameplayJob.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.longFormJob.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.cartoonEpisode.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.imageStudioJob.count({ where: { createdAt: { gte: startOfDay } } }),
    // Total + completed
    prisma.reelJob.count(), prisma.reelJob.count({ where: { status: 'COMPLETED' } }),
    prisma.quoteJob.count(), prisma.quoteJob.count({ where: { status: 'COMPLETED' } }),
    prisma.challengeJob.count(), prisma.challengeJob.count({ where: { status: 'COMPLETED' } }),
    prisma.gameplayJob.count(), prisma.gameplayJob.count({ where: { status: 'COMPLETED' } }),
    prisma.longFormJob.count(), prisma.longFormJob.count({ where: { status: 'COMPLETED' } }),
    prisma.cartoonEpisode.count(), prisma.cartoonEpisode.count({ where: { status: 'COMPLETED' } }),
    prisma.imageStudioJob.count(), prisma.imageStudioJob.count({ where: { status: 'COMPLETED' } }),
    // Recent users
    prisma.user.findMany({
      take: 10, orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    // Recent jobs per module
    prisma.reelJob.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, createdAt: true, user: { select: { name: true } } },
    }),
    prisma.quoteJob.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: { id: true, category: true, quoteText: true, status: true, createdAt: true, user: { select: { name: true } } },
    }),
    prisma.challengeJob.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: { id: true, challengeType: true, status: true, createdAt: true, user: { select: { name: true } } },
    }),
    prisma.gameplayJob.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: { id: true, template: true, gameTitle: true, status: true, createdAt: true, user: { select: { name: true } } },
    }),
    prisma.longFormJob.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, createdAt: true, user: { select: { name: true } } },
    }),
    prisma.cartoonEpisode.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, createdAt: true, series: { select: { user: { select: { name: true } } } } },
    }),
    prisma.imageStudioJob.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, mode: true, status: true, createdAt: true, user: { select: { name: true } } },
    }),
    // 30-day time series
    prisma.user.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.reelJob.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.quoteJob.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.challengeJob.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.gameplayJob.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.longFormJob.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.cartoonEpisode.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    prisma.imageStudioJob.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
  ])

  const planPrices: Record<string, number> = { STARTER: 19, PRO: 49, BUSINESS: 99, ENTERPRISE: 299 }
  const mrr = paidSubs.reduce((sum, s) => sum + (planPrices[s.plan] || 0), 0)

  const jobsToday = todayReels + todayQuotes + todayChallenges + todayGameplay + todayLongForm + todayCartoons + todayImageStudio
  const allTotal = totalReels + totalQuotes + totalChallenges + totalGameplay + totalLongForm + totalCartoons + totalImageStudio
  const allCompleted = completedReels + completedQuotes + completedChallenges + completedGameplay + completedLongForm + completedCartoons + completedImageStudio
  const successRate = allTotal > 0 ? Math.round((allCompleted / allTotal) * 100) : 0

  const moduleStats = [
    { key: 'reel', label: 'Reels', count: totalReels, icon: Film, color: 'text-brand-400' },
    { key: 'quote', label: 'Quotes', count: totalQuotes, icon: Quote, color: 'text-cyan-400' },
    { key: 'challenge', label: 'Challenges', count: totalChallenges, icon: Gamepad2, color: 'text-orange-400' },
    { key: 'gameplay', label: 'Gameplay', count: totalGameplay, icon: Joystick, color: 'text-pink-400' },
    { key: 'longform', label: 'Long-Form', count: totalLongForm, icon: Video, color: 'text-indigo-400' },
    { key: 'cartoon', label: 'Cartoon', count: totalCartoons, icon: Clapperboard, color: 'text-emerald-400' },
    { key: 'imagestudio', label: 'Image Studio', count: totalImageStudio, icon: ImageIcon, color: 'text-amber-400' },
  ]

  // Merge recent jobs
  type AdminJob = { id: string; module: string; title: string; userName: string; status: string; createdAt: Date }
  const recentJobs: AdminJob[] = [
    ...latestReels.map((r) => ({ id: r.id, module: 'reel', title: r.title, userName: r.user.name, status: r.status, createdAt: r.createdAt })),
    ...latestQuotes.map((q) => ({ id: q.id, module: 'quote', title: q.quoteText?.slice(0, 50) || q.category || 'Quote', userName: q.user.name, status: q.status, createdAt: q.createdAt })),
    ...latestChallenges.map((c) => ({ id: c.id, module: 'challenge', title: c.challengeType.replace(/_/g, ' '), userName: c.user.name, status: c.status, createdAt: c.createdAt })),
    ...latestGameplay.map((g) => ({ id: g.id, module: 'gameplay', title: g.gameTitle || g.template.replace(/_/g, ' '), userName: g.user.name, status: g.status, createdAt: g.createdAt })),
    ...latestLongForm.map((l) => ({ id: l.id, module: 'longform', title: l.title, userName: l.user.name, status: l.status, createdAt: l.createdAt })),
    ...latestCartoons.map((e) => ({ id: e.id, module: 'cartoon', title: e.title, userName: e.series.user.name, status: e.status, createdAt: e.createdAt })),
    ...latestImageStudio.map((j) => ({ id: j.id, module: 'imagestudio', title: j.title || `${j.mode} job`, userName: j.user.name, status: j.status, createdAt: j.createdAt })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)

  // Signups chart data
  const signupDateMap = buildDateMap(30)
  const signupGrouped = groupByDate(users30d)
  for (const [key, val] of Object.entries(signupGrouped)) {
    if (key in signupDateMap) signupDateMap[key] = val
  }
  const signupsTimeline = Object.entries(signupDateMap).map(([date, count]) => ({ date, count }))

  // Jobs per day chart data (stacked by module)
  const dateKeys = Object.keys(buildDateMap(30))
  const reelsGrouped = groupByDate(reels30d)
  const quotesGrouped = groupByDate(quotes30d)
  const challengesGrouped = groupByDate(challenges30d)
  const gameplayGrouped = groupByDate(gameplay30d)
  const longFormGrouped = groupByDate(longForm30d)
  const cartoonGrouped = groupByDate(cartoon30d)
  const imageStudioGrouped = groupByDate(imageStudio30d)

  const jobsPerDay = dateKeys.map((date) => ({
    date,
    reels: reelsGrouped[date] || 0,
    quotes: quotesGrouped[date] || 0,
    challenges: challengesGrouped[date] || 0,
    gameplay: gameplayGrouped[date] || 0,
    longform: longFormGrouped[date] || 0,
    cartoon: cartoonGrouped[date] || 0,
    imagestudio: imageStudioGrouped[date] || 0,
  }))

  // Revenue by plan
  const planCounts: Record<string, number> = {}
  for (const sub of paidSubs) {
    planCounts[sub.plan] = (planCounts[sub.plan] || 0) + 1
  }
  const planColors: Record<string, string> = { STARTER: '#3B82F6', PRO: '#8B5CF6', BUSINESS: '#F59E0B', ENTERPRISE: '#EF4444' }
  const revenuePlan = Object.entries(planPrices)
    .filter(([plan]) => planCounts[plan])
    .map(([plan, price]) => ({
      plan,
      revenue: price * (planCounts[plan] || 0),
      subscribers: planCounts[plan] || 0,
      color: planColors[plan] || '#6B7280',
    }))

  return {
    totalUsers, mrr, jobsToday, successRate,
    moduleStats, recentUsers, recentJobs,
    signupsTimeline, jobsPerDay, revenuePlan,
  }
}

/* ─── Quick actions for user dashboard ─── */

const quickActions = [
  { href: '/reels/new', icon: Film, label: 'Create Reel', desc: 'AI-powered video reel', bg: 'bg-brand-500/15', iconColor: 'text-brand-400' },
  { href: '/quotes/new', icon: Quote, label: 'Create Quote', desc: 'Beautiful text quotes', bg: 'bg-cyan-500/15', iconColor: 'text-cyan-400' },
  { href: '/challenges/new', icon: Gamepad2, label: 'Create Challenge', desc: 'Interactive challenge reels', bg: 'bg-orange-500/15', iconColor: 'text-orange-400' },
  { href: '/gameplay/new', icon: Joystick, label: 'Create Gameplay', desc: '3D gameplay videos', bg: 'bg-pink-500/15', iconColor: 'text-pink-400' },
  { href: '/long-form/new', icon: Video, label: 'Create Long-Form', desc: 'Long-format videos', bg: 'bg-indigo-500/15', iconColor: 'text-indigo-400' },
  { href: '/cartoon-studio', icon: Clapperboard, label: 'Create Cartoon', desc: 'Cartoon series episodes', bg: 'bg-emerald-500/15', iconColor: 'text-emerald-400' },
  { href: '/image-studio/new', icon: ImageIcon, label: 'Image Studio', desc: 'AI image videos', bg: 'bg-amber-500/15', iconColor: 'text-amber-400' },
]

/* ─── Admin quick links ─── */

const adminLinks = [
  { href: '/admin/users', icon: Users, label: 'Manage Users', color: 'text-blue-400', bg: 'bg-blue-500/15' },
  { href: '/admin/modules', icon: Shield, label: 'Module Settings', color: 'text-purple-400', bg: 'bg-purple-500/15' },
  { href: '/admin/financials', icon: DollarSign, label: 'Financials', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  { href: '/admin/plans', icon: CreditCard, label: 'Plans', color: 'text-green-400', bg: 'bg-green-500/15' },
  { href: '/admin/pricing', icon: Globe, label: 'Pricing Regions', color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  { href: '/admin/marketing', icon: Megaphone, label: 'Marketing', color: 'text-red-400', bg: 'bg-red-500/15' },
  { href: '/admin/settings', icon: Wrench, label: 'App Settings', color: 'text-gray-400', bg: 'bg-gray-500/15' },
]

/* ─── Page Component ─── */

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const isAdmin = (session.user as Record<string, unknown>).role === 'ADMIN'

  if (isAdmin) {
    const data = await getAdminData()

    const kpiCards = [
      { label: 'Total Users', value: data.totalUsers.toLocaleString(), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
      { label: 'Monthly Revenue', value: `$${data.mrr.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      { label: 'Jobs Today', value: data.jobsToday.toLocaleString(), icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
      { label: 'Success Rate', value: `${data.successRate}%`, icon: CheckCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    ]

    return (
      <div>
        {/* Header */}
        <div className="mb-6 pb-5 border-b border-white/[0.06]">
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Platform overview and management</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpiCards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-400">{card.label}</span>
                  <div className={`h-9 w-9 rounded-lg ${card.bg} border ${card.border} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{card.value}</p>
              </div>
            )
          })}
        </div>

        {/* Charts Row: Signups + Jobs per Day */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-sm font-semibold text-white mb-4">User Signups (30 days)</h3>
            <SignupsChart data={data.signupsTimeline} />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Jobs per Day (30 days)</h3>
            <JobsPerDayChart data={data.jobsPerDay} />
          </div>
        </div>

        {/* Revenue by Plan + Module Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Revenue by Plan</h3>
            <RevenuePlanChart data={data.revenuePlan} />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-sm font-semibold text-white mb-5">Content by Module</h3>
            <div className="grid grid-cols-4 gap-3">
              {data.moduleStats.map((mod) => {
                const Icon = mod.icon
                return (
                  <div key={mod.key} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <Icon className={`h-4 w-4 mx-auto mb-1.5 ${mod.color}`} />
                    <p className="text-lg font-bold text-white">{mod.count.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{mod.label}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Two columns: Recent Signups + Recent Jobs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Signups */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-white">Recent Signups</h2>
              <Link href="/admin/users" className="text-xs text-brand-400 hover:text-brand-300">View all</Link>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {data.recentUsers.length === 0 ? (
                <div className="py-10 text-center">
                  <Users className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No users yet</p>
                </div>
              ) : (
                data.recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="h-8 w-8 rounded-full bg-brand-500/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-brand-400">
                        {user.name?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{user.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                    </div>
                    <span className="text-[11px] text-gray-600 flex-shrink-0">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-white">Recent Jobs</h2>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {data.recentJobs.length === 0 ? (
                <div className="py-10 text-center">
                  <Activity className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No jobs yet</p>
                </div>
              ) : (
                data.recentJobs.map((job) => {
                  const meta = MODULE_META[job.module]
                  const Icon = meta?.icon || Film
                  return (
                    <div key={`${job.module}-${job.id}`} className="flex items-center gap-3 px-6 py-3">
                      <div className="h-8 w-8 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                        <Icon className={`h-4 w-4 ${meta?.color || 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{job.title}</p>
                        <p className="text-[11px] text-gray-500 truncate">{job.userName} &middot; {meta?.label}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusBadge(job.status)}`}>
                        {job.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-gray-600 flex-shrink-0">
                        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Admin Quick Links */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-4">Quick Access</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {adminLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition group"
                >
                  <div className={`h-10 w-10 rounded-lg ${link.bg} flex items-center justify-center group-hover:scale-105 transition`}>
                    <Icon className={`h-5 w-5 ${link.color}`} />
                  </div>
                  <span className="text-sm font-medium text-white">{link.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  /* ─── User Dashboard ─── */

  const data = await getUserData(session.user.id)
  const jobsUsed = data.subscription?.jobsUsed || 0
  const jobsLimit = data.subscription?.jobsLimit || 3
  const usagePercent = jobsLimit > 0 ? Math.round((jobsUsed / jobsLimit) * 100) : 0

  return (
    <div>
      <DashboardBanners placement="DASHBOARD_TOP" />

      {/* Header */}
      <div className="mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Welcome back, {session.user.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here&apos;s your content creation overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Jobs This Month</span>
            <Activity className="h-5 w-5 text-brand-400" />
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

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Total Content</span>
            <TrendingUp className="h-5 w-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">{data.totalContent}</p>
          <p className="mt-2 text-xs text-gray-500">Across all modules</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Credits</span>
            <Zap className="h-5 w-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-white">{session.user.creditsBalance || 0}</p>
          <p className="mt-2 text-xs text-gray-500">Available balance</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Current Plan</span>
            <CreditCard className="h-5 w-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-white capitalize">
            {data.subscription?.plan?.toLowerCase() || 'Free'}
          </p>
          <Link href="/billing" className="mt-2 inline-block text-xs text-brand-400 hover:text-brand-300">
            Upgrade plan
          </Link>
        </div>
      </div>

      {/* Charts Row: Module Breakdown + Creation Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Content by Module</h3>
          <ModuleBreakdownChart data={data.moduleBreakdown} />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Creation Activity (30 days)</h3>
          <CreationTimelineChart data={data.timeline} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-white mb-4">Create Content</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition group"
              >
                <div className={`h-10 w-10 rounded-lg ${action.bg} flex items-center justify-center group-hover:scale-110 transition flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${action.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white">{action.label}</h3>
                  <p className="text-xs text-gray-500 truncate">{action.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
        </div>
        {data.activity.length === 0 ? (
          <div className="py-12 text-center">
            <PlusCircle className="h-10 w-10 text-gray-700 mx-auto mb-3" />
            <h3 className="text-base font-medium text-white mb-1">No content yet</h3>
            <p className="text-sm text-gray-500 mb-5">Create your first piece of content to get started</p>
            <Link
              href="/reels/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <PlusCircle className="h-4 w-4" />
              Create First Reel
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {data.activity.map((item) => {
              const meta = MODULE_META[item.module]
              const Icon = meta?.icon || Film
              return (
                <Link
                  key={`${item.module}-${item.id}`}
                  href={item.href}
                  className="flex items-center gap-4 px-6 py-3 hover:bg-white/[0.02] transition"
                >
                  <div className="h-9 w-9 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Icon className={`h-4 w-4 ${meta?.color || 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.title}</p>
                    <p className="text-[11px] text-gray-500">{meta?.label}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusBadge(item.status)}`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-gray-600 flex-shrink-0">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <DashboardBanners placement="DASHBOARD_BOTTOM" />
    </div>
  )
}
