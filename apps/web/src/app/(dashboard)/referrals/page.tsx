import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import { Gift, Users, DollarSign, Copy, Share2 } from 'lucide-react'
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

  const tierInfo = {
    FREE: { name: 'Free', credits: 5, cash: '0%' },
    AFFILIATE: { name: 'Affiliate', credits: 10, cash: '30%' },
    PARTNER: { name: 'Partner', credits: 20, cash: '40% + 10% recurring' },
  }

  const currentTier = tierInfo[user?.referralTier as keyof typeof tierInfo] || tierInfo.FREE

  // Milestones
  const milestones = [
    { target: 1, reward: '10 bonus credits', achieved: (user?.totalReferrals || 0) >= 1 },
    { target: 5, reward: '25 credits', achieved: (user?.totalReferrals || 0) >= 5 },
    { target: 10, reward: '50 credits + Affiliate unlock', achieved: (user?.totalReferrals || 0) >= 10 },
    { target: 25, reward: '100 credits', achieved: (user?.totalReferrals || 0) >= 25 },
    { target: 50, reward: 'Partner tier invite', achieved: (user?.totalReferrals || 0) >= 50 },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Referral Program</h1>
        <p className="text-gray-400 mt-1">Earn credits and cash by inviting friends</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Total Referrals</span>
            <Users className="h-5 w-5 text-brand-400" />
          </div>
          <p className="text-3xl font-bold text-white">{user?.totalReferrals || 0}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Current Tier</span>
            <Gift className="h-5 w-5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white">{currentTier.name}</p>
          <p className="text-xs text-gray-400 mt-1">{currentTier.credits} credits/referral</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Credits Earned</span>
            <Gift className="h-5 w-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-white">{user?.creditsBalance || 0}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Cash Earned</span>
            <DollarSign className="h-5 w-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">${((Number(user?.cashPendingCents || 0) + Number(user?.cashWithdrawnCents || 0)) / 100).toFixed(2)}</p>
        </div>
      </div>

      {/* Referral Link */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Your Referral Link</h2>
        <ReferralActions referralLink={referralLink} referralCode={user?.referralCode || ''} />
      </div>

      {/* Milestones */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Milestones</h2>
        <div className="space-y-3">
          {milestones.map((m) => (
            <div key={m.target} className="flex items-center gap-4">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                m.achieved ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-500'
              }`}>
                {m.achieved ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                ) : (
                  <span className="text-xs font-bold">{m.target}</span>
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${m.achieved ? 'text-white' : 'text-gray-400'}`}>
                  {m.target} referral{m.target > 1 ? 's' : ''}
                </p>
              </div>
              <span className={`text-xs ${m.achieved ? 'text-green-400' : 'text-gray-500'}`}>{m.reward}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Referral History */}
      <div className="rounded-xl border border-white/10 bg-white/5">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Referral History</h2>
        </div>
        {referrals.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No referrals yet. Share your link to get started!</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {referrals.map((ref) => (
              <div key={ref.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-white">{ref.referred.name}</p>
                  <p className="text-xs text-gray-400">{ref.referred.email}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    ref.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                    ref.status === 'PAID' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {ref.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    +{ref.referrerRewardCredits} credits
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
