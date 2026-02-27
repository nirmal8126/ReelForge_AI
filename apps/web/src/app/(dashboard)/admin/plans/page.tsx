'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  CreditCard,
  Loader2,
  Users,
  Save,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PlanData {
  key: string
  name: string
  price: number
  jobsLimit: number
  profilesLimit: number
  subscribers: number
}

export default function AdminPlansPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [plans, setPlans] = useState<PlanData[]>([])
  const [loading, setLoading] = useState(true)
  const [editValues, setEditValues] = useState<Record<string, number>>({})
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
    fetchPlans()
  }, [session, status, router])

  async function fetchPlans() {
    try {
      const res = await fetch('/api/admin/plans')
      if (!res.ok) {
        if (res.status === 403) {
          router.push('/dashboard')
          toast.error('Super Admin access required')
          return
        }
        throw new Error('Failed to load')
      }
      const data = await res.json()
      setPlans(data.plans)
      const initial: Record<string, number> = {}
      for (const p of data.plans) {
        initial[p.key] = p.jobsLimit
      }
      setEditValues(initial)
    } catch {
      toast.error('Failed to load plans')
    } finally {
      setLoading(false)
    }
  }

  async function savePlan(planKey: string) {
    const newLimit = editValues[planKey]
    const current = plans.find((p) => p.key === planKey)
    if (!current || newLimit === current.jobsLimit) return

    setSaving(planKey)
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, jobsLimit: newLimit }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const data = await res.json()

      setPlans((prev) =>
        prev.map((p) =>
          p.key === planKey ? { ...p, jobsLimit: data.jobsLimit } : p
        )
      )
      toast.success(`${current.name} plan updated — ${data.updated} subscriber(s) affected`)
    } catch {
      toast.error('Failed to update plan')
    } finally {
      setSaving(null)
    }
  }

  function getPlanColor(key: string): string {
    const colors: Record<string, string> = {
      FREE: '#6B7280',
      STARTER: '#3B82F6',
      PRO: '#8B5CF6',
      BUSINESS: '#F59E0B',
      ENTERPRISE: '#EF4444',
    }
    return colors[key] || '#6366F1'
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
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Plans Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Super Admin — Manage subscription plan job quotas across all modules</p>
          </div>
        </div>
      </div>

      {/* Plans List */}
      <div className="space-y-4">
        {plans.map((plan) => {
          const color = getPlanColor(plan.key)
          const hasChanges = editValues[plan.key] !== plan.jobsLimit
          const isSaving = saving === plan.key

          return (
            <div
              key={plan.key}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-center gap-4">
                {/* Plan badge + name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                    style={{ backgroundColor: color + '20', color }}
                  >
                    {plan.name[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{plan.name}</h3>
                    <p className="text-xs text-gray-500">
                      ${(plan.price / 100).toFixed(0)}/mo
                    </p>
                  </div>
                </div>

                {/* Subscriber count */}
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Users className="h-3.5 w-3.5" />
                  <span>{plan.subscribers} subscriber{plan.subscribers !== 1 ? 's' : ''}</span>
                </div>

                {/* Jobs Limit Editor */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Jobs/mo:</label>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={editValues[plan.key] ?? plan.jobsLimit}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [plan.key]: parseInt(e.target.value) || 0,
                      }))
                    }
                    disabled={isSaving}
                    className="rounded-md bg-white/10 border border-white/10 px-2 py-1 text-sm text-white outline-none focus:border-brand-500 w-20 text-center"
                  />
                </div>

                {/* Save button */}
                <button
                  onClick={() => savePlan(plan.key)}
                  disabled={!hasChanges || isSaving}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition ${
                    hasChanges
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

              {/* Profiles limit info */}
              <div className="mt-3 text-xs text-gray-500">
                Profiles: {plan.profilesLimit === -1 ? 'Unlimited' : plan.profilesLimit}
              </div>
            </div>
          )
        })}
      </div>

      {/* Module Credit Costs Reference */}
      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">Credit Cost per Module (when over quota)</h3>
        </div>
        <div className="px-5 py-3 space-y-1.5">
          {[
            { name: 'Reels', cost: '1-3', detail: '5-15s = 1, 30s = 2, 60s = 3' },
            { name: 'Quotes', cost: '1', detail: 'Flat rate' },
            { name: 'Challenges', cost: '1-3', detail: '5+ questions +1, voice +1' },
            { name: 'Gameplay', cost: '1-3', detail: '15s = 1, 30s = 2, 45-60s = 3' },
            { name: 'Long-Form', cost: '3-12', detail: '5min = 3, 10min = 5, 15min = 7, 20min = 9, 30min = 12' },
            { name: 'Cartoon Studio', cost: '5', detail: 'Flat rate per episode' },
          ].map((m) => (
            <div key={m.name} className="flex items-center gap-3 text-xs">
              <span className="w-28 text-gray-400 font-medium">{m.name}</span>
              <span className="text-yellow-400 font-semibold w-12">{m.cost} cr</span>
              <span className="text-gray-600">{m.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400 font-medium">How it works:</span> Each job (from any module) uses
          1 slot from the monthly quota. Changing the jobs limit will update the quota for{' '}
          <span className="text-white">all existing subscribers</span> on that plan. When users exceed
          their quota, credits are deducted based on the module&apos;s cost above.
        </p>
      </div>
    </div>
  )
}
