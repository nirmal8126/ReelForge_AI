'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Gift,
  Loader2,
  Users,
  Save,
  TrendingUp,
  Coins,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface TierConfig {
  id: string
  tier: string
  creditsPerReferral: number
  cashPercent: number
  recurringPercent: number
  updatedAt: string
}

interface ReferralStats {
  totalReferrals: number
  convertedReferrals: number
  totalCreditsRewarded: number
  usersByTier: Record<string, number>
}

export default function AdminReferralsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tiers, setTiers] = useState<TierConfig[]>([])
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editValues, setEditValues] = useState<Record<string, Partial<TierConfig>>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      router.push('/login')
      return
    }
    if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
      router.push('/dashboard')
      toast.error('Super Admin access required')
      return
    }
    fetchData()
  }, [session, status, router])

  async function fetchData() {
    try {
      const res = await fetch('/api/admin/referrals')
      if (!res.ok) {
        if (res.status === 403) {
          router.push('/dashboard')
          toast.error('Super Admin access required')
          return
        }
        throw new Error('Failed to load')
      }
      const data = await res.json()
      setTiers(data.tiers)
      setStats(data.stats)
      const initial: Record<string, Partial<TierConfig>> = {}
      for (const t of data.tiers) {
        initial[t.tier] = {
          creditsPerReferral: t.creditsPerReferral,
          cashPercent: t.cashPercent,
          recurringPercent: t.recurringPercent,
        }
      }
      setEditValues(initial)
    } catch {
      toast.error('Failed to load referral settings')
    } finally {
      setLoading(false)
    }
  }

  async function saveTier(tierKey: string) {
    const current = tiers.find((t) => t.tier === tierKey)
    const edits = editValues[tierKey]
    if (!current || !edits) return

    const hasChanges =
      edits.creditsPerReferral !== current.creditsPerReferral ||
      edits.cashPercent !== current.cashPercent ||
      edits.recurringPercent !== current.recurringPercent

    if (!hasChanges) return

    setSaving(tierKey)
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: tierKey,
          creditsPerReferral: edits.creditsPerReferral,
          cashPercent: edits.cashPercent,
          recurringPercent: edits.recurringPercent,
        }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const data = await res.json()

      setTiers((prev) =>
        prev.map((t) => (t.tier === tierKey ? { ...t, ...data.tier } : t))
      )
      toast.success(`${tierKey} tier updated`)
    } catch {
      toast.error('Failed to update tier')
    } finally {
      setSaving(null)
    }
  }

  function getTierColor(tier: string): string {
    const colors: Record<string, string> = {
      FREE: '#6B7280',
      AFFILIATE: '#3B82F6',
      PARTNER: '#F59E0B',
    }
    return colors[tier] || '#6366F1'
  }

  function getTierLabel(tier: string): string {
    const labels: Record<string, string> = {
      FREE: 'Free Tier',
      AFFILIATE: 'Affiliate Tier',
      PARTNER: 'Partner Tier',
    }
    return labels[tier] || tier
  }

  function hasChanges(tierKey: string): boolean {
    const current = tiers.find((t) => t.tier === tierKey)
    const edits = editValues[tierKey]
    if (!current || !edits) return false
    return (
      edits.creditsPerReferral !== current.creditsPerReferral ||
      edits.cashPercent !== current.cashPercent ||
      edits.recurringPercent !== current.recurringPercent
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Gift className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Referrals Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Super Admin — Configure referral rewards per tier</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Users className="h-3.5 w-3.5" />
              Total Referrals
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalReferrals}</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.convertedReferrals} converted
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Coins className="h-3.5 w-3.5" />
              Credits Rewarded
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalCreditsRewarded}</p>
            <p className="text-xs text-gray-500 mt-1">total distributed</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Conversion Rate
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.totalReferrals > 0
                ? Math.round((stats.convertedReferrals / stats.totalReferrals) * 100)
                : 0}%
            </p>
            <p className="text-xs text-gray-500 mt-1">of referrals converted</p>
          </div>
        </div>
      )}

      {/* Tier Configs */}
      <div className="space-y-4">
        {tiers.map((tier) => {
          const color = getTierColor(tier.tier)
          const edits = editValues[tier.tier] || {}
          const changed = hasChanges(tier.tier)
          const isSaving = saving === tier.tier

          return (
            <div
              key={tier.tier}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ backgroundColor: color + '20', color }}
                  >
                    {tier.tier[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{getTierLabel(tier.tier)}</h3>
                    <p className="text-xs text-gray-500">
                      {stats?.usersByTier[tier.tier] || 0} user{(stats?.usersByTier[tier.tier] || 0) !== 1 ? 's' : ''} on this tier
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => saveTier(tier.tier)}
                  disabled={!changed || isSaving}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition ${
                    changed
                      ? 'border-brand-500/30 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20'
                      : 'border-white/[0.06] bg-white/[0.02] text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </button>
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Credits / Referral</label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={edits.creditsPerReferral ?? tier.creditsPerReferral}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [tier.tier]: {
                          ...prev[tier.tier],
                          creditsPerReferral: parseInt(e.target.value) || 0,
                        },
                      }))
                    }
                    disabled={isSaving}
                    className="w-full rounded-md bg-white/10 border border-white/10 px-3 py-1.5 text-sm text-white outline-none focus:border-brand-500 text-center"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Cash Commission %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={edits.cashPercent ?? tier.cashPercent}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [tier.tier]: {
                          ...prev[tier.tier],
                          cashPercent: parseInt(e.target.value) || 0,
                        },
                      }))
                    }
                    disabled={isSaving}
                    className="w-full rounded-md bg-white/10 border border-white/10 px-3 py-1.5 text-sm text-white outline-none focus:border-brand-500 text-center"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Recurring %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={edits.recurringPercent ?? tier.recurringPercent}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [tier.tier]: {
                          ...prev[tier.tier],
                          recurringPercent: parseInt(e.target.value) || 0,
                        },
                      }))
                    }
                    disabled={isSaving}
                    className="w-full rounded-md bg-white/10 border border-white/10 px-3 py-1.5 text-sm text-white outline-none focus:border-brand-500 text-center"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Info */}
      <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400 font-medium">How it works:</span>{' '}
          <span className="text-white">Credits/Referral</span> — bonus credits given to the referrer
          when their referred user signs up.{' '}
          <span className="text-white">Cash Commission %</span> — percentage of the referred user&apos;s
          first payment sent to the referrer.{' '}
          <span className="text-white">Recurring %</span> — percentage of all future payments from the
          referred user sent to the referrer (partner only).
        </p>
      </div>
    </div>
  )
}
