import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import { Gift, Users, DollarSign, TrendingUp, Trophy, ArrowUpRight, Sparkles, Clock } from 'lucide-react'
import { ReferralActions } from '@/components/referrals/referral-actions'

export default async function ReferralsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      referralCode: true,
      referralTier: true,
      totalReferrals: true,
      creditsBalance: true,
      cashPendingCents: true,
      cashWithdrawnCents: true,
    },
  })

  const referrals = await prisma.referral.findMany({
    where: { referrerUserId: session.user.id },
    include: {
      referred: { select: { name: true, email: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL}/register?ref=${user?.referralCode}`
  const totalReferrals = user?.totalReferrals || 0
  const totalCashCents = Number(user?.cashPendingCents || 0) + Number(user?.cashWithdrawnCents || 0)

  const tierInfo = {
    FREE: { name: 'Free', credits: 5, cash: '0%', color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/20' },
    AFFILIATE: { name: 'Affiliate', credits: 10, cash: '30%', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
    PARTNER: { name: 'Partner', credits: 20, cash: '40% + 10% recurring', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  }

  const currentTier = tierInfo[user?.referralTier as keyof typeof tierInfo] || tierInfo.FREE

  // Milestones
  const milestones = [
    { target: 1, reward: '10 bonus credits', icon: Sparkles },
    { target: 5, reward: '25 credits', icon: Gift },
    { target: 10, reward: '50 credits + Affiliate unlock', icon: TrendingUp },
    { target: 25, reward: '100 credits', icon: Trophy },
    { target: 50, reward: 'Partner tier invite', icon: ArrowUpRight },
  ]

  // Progress percentage to next milestone
  const nextMilestone = milestones.find((m) => totalReferrals < m.target)
  const prevMilestoneTarget = milestones[milestones.indexOf(nextMilestone!) - 1]?.target || 0
  const progressPercent = nextMilestone
    ? Math.round(((totalReferrals - prevMilestoneTarget) / (nextMilestone.target - prevMilestoneTarget)) * 100)
    : 100

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Referral Program</h1>
        <p className="text-gray-400 mt-1">Earn credits and cash by inviting friends</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Referrals</span>
            <div className="h-9 w-9 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Users className="h-4.5 w-4.5 text-brand-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{totalReferrals}</p>
          <p className="text-xs text-gray-500 mt-1">Total signups</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tier</span>
            <div className={`h-9 w-9 rounded-lg ${currentTier.bg} flex items-center justify-center`}>
              <Trophy className={`h-4.5 w-4.5 ${currentTier.color}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${currentTier.color}`}>{currentTier.name}</p>
          <p className="text-xs text-gray-500 mt-1">{currentTier.credits} credits/referral</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Credits</span>
            <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Gift className="h-4.5 w-4.5 text-yellow-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{user?.creditsBalance || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Available balance</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Cash</span>
            <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <DollarSign className="h-4.5 w-4.5 text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">${(totalCashCents / 100).toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Total earned</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Invite & Share */}
        <div className="space-y-6">
          {/* Referral Link & Share */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-9 w-9 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <Users className="h-4.5 w-4.5 text-brand-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Invite Friends</h2>
                <p className="text-xs text-gray-500">Share your link and earn rewards</p>
              </div>
            </div>
            <ReferralActions referralLink={referralLink} referralCode={user?.referralCode || ''} />
          </div>

          {/* How it Works */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-5">How It Works</h2>
            <div className="space-y-4">
              {[
                { step: '1', title: 'Share your link', desc: 'Send your unique referral link to friends' },
                { step: '2', title: 'They sign up', desc: 'Your friend creates an account using your link' },
                { step: '3', title: 'You earn rewards', desc: `Get ${currentTier.credits} credits per referral${currentTier.cash !== '0%' ? ` + ${currentTier.cash} cash` : ''}` },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-brand-400">{item.step}</span>
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier Progression */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-5">Tier Progression</h2>
            <div className="space-y-3">
              {Object.entries(tierInfo).map(([key, tier]) => {
                const isActive = (user?.referralTier || 'FREE') === key
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between rounded-lg border p-4 transition ${
                      isActive
                        ? `${tier.bg} ${tier.border}`
                        : 'border-white/5 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        isActive ? tier.bg : 'bg-white/5'
                      }`}>
                        <Trophy className={`h-4 w-4 ${isActive ? tier.color : 'text-gray-600'}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                          {tier.name}
                          {isActive && <span className="ml-2 text-xs font-normal text-gray-500">Current</span>}
                        </p>
                        <p className="text-xs text-gray-500">{tier.credits} credits/referral {tier.cash !== '0%' ? `+ ${tier.cash} cash` : ''}</p>
                      </div>
                    </div>
                    {isActive && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${tier.bg} ${tier.color}`}>
                        Active
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT — Milestones & History */}
        <div className="space-y-6">
          {/* Milestones */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Milestones</h2>
              {nextMilestone && (
                <span className="text-xs text-gray-500">
                  {totalReferrals}/{nextMilestone.target} to next
                </span>
              )}
            </div>

            {/* Progress Bar */}
            {nextMilestone && (
              <div className="mb-6">
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all"
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {nextMilestone.target - totalReferrals} more referral{nextMilestone.target - totalReferrals !== 1 ? 's' : ''} to unlock: <span className="text-brand-400">{nextMilestone.reward}</span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              {milestones.map((m) => {
                const achieved = totalReferrals >= m.target
                const Icon = m.icon
                return (
                  <div
                    key={m.target}
                    className={`flex items-center gap-4 rounded-lg p-3 transition ${
                      achieved ? 'bg-green-500/5' : ''
                    }`}
                  >
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      achieved ? 'bg-green-500/10' : 'bg-white/5'
                    }`}>
                      {achieved ? (
                        <svg className="h-4.5 w-4.5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      ) : (
                        <Icon className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${achieved ? 'text-white' : 'text-gray-400'}`}>
                        {m.target} referral{m.target > 1 ? 's' : ''}
                      </p>
                      <p className={`text-xs truncate ${achieved ? 'text-green-400' : 'text-gray-600'}`}>
                        {m.reward}
                      </p>
                    </div>
                    {achieved && (
                      <span className="text-xs font-medium text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full flex-shrink-0">
                        Unlocked
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Referral History */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-semibold text-white">Referral History</h2>
                {referrals.length > 0 && (
                  <span className="text-xs font-medium text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                    {referrals.length}
                  </span>
                )}
              </div>
            </div>

            {referrals.length === 0 ? (
              <div className="p-12 text-center">
                <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-7 w-7 text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-400 mb-1">No referrals yet</p>
                <p className="text-xs text-gray-600">Share your link to start earning rewards</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {referrals.map((ref) => (
                  <div key={ref.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-brand-400">
                          {(ref.referred.name || ref.referred.email || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{ref.referred.name || 'Unknown'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="truncate">{ref.referred.email}</span>
                          <span className="flex-shrink-0">
                            <Clock className="inline h-3 w-3 mr-0.5 -mt-px" />
                            {formatDate(ref.referred.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span className="text-xs font-medium text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">
                        +{ref.referrerRewardCredits} cr
                      </span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        ref.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                        ref.status === 'PAID' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {ref.status === 'COMPLETED' ? 'Completed' :
                         ref.status === 'PAID' ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
