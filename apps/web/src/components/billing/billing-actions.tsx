'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Loader2, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'

interface BillingActionsProps {
  currentPlan?: string
  targetPlan?: string
  hasStripeCustomer?: boolean
  buttonOnly?: boolean
  creditPackIndex?: number
  creditPurchase?: boolean
  regionId?: string
}

export function BillingActions({
  currentPlan,
  targetPlan,
  hasStripeCustomer,
  buttonOnly,
  creditPackIndex,
  creditPurchase,
  regionId,
}: BillingActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async (plan: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, regionId }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to start upgrade')
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleManageBilling = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/subscription/portal', {
        method: 'POST',
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      toast.error('Failed to open billing portal')
    } finally {
      setLoading(false)
    }
  }

  const handleCreditPurchase = async (index: number) => {
    setLoading(true)
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageIndex: index, regionId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      toast.error('Failed to start purchase')
    } finally {
      setLoading(false)
    }
  }

  // Credit purchase button
  if (creditPurchase && creditPackIndex !== undefined) {
    return (
      <button
        onClick={() => handleCreditPurchase(creditPackIndex)}
        disabled={loading}
        className="mt-3 w-full rounded-lg bg-white/10 border border-white/10 py-2 text-sm font-medium text-white hover:bg-white/20 transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Buy Now'}
      </button>
    )
  }

  // Plan upgrade/switch button (inside plan cards)
  if (buttonOnly && targetPlan) {
    const planOrder = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']
    const isUpgrade = planOrder.indexOf(targetPlan) > planOrder.indexOf(currentPlan || 'FREE')

    return (
      <button
        onClick={() => handleUpgrade(targetPlan)}
        disabled={loading}
        className={`w-full rounded-lg py-2.5 text-sm font-medium transition disabled:opacity-50 ${
          isUpgrade
            ? 'bg-brand-600 text-white hover:bg-brand-500'
            : 'bg-white/10 border border-white/10 text-gray-300 hover:bg-white/20'
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
        ) : isUpgrade ? (
          'Upgrade'
        ) : (
          'Downgrade'
        )}
      </button>
    )
  }

  // Top-level management buttons (header area)
  return (
    <div className="flex items-center gap-2.5">
      {hasStripeCustomer && (
        <button
          onClick={handleManageBilling}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition disabled:opacity-50"
        >
          <CreditCard className="h-4 w-4" />
          Manage Billing
        </button>
      )}
      {currentPlan === 'FREE' && (
        <button
          onClick={() => handleUpgrade('PRO')}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
          Upgrade to Pro
        </button>
      )}
    </div>
  )
}
