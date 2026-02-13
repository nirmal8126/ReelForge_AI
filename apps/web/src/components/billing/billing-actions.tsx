'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface BillingActionsProps {
  currentPlan?: string
  targetPlan?: string
  hasStripeCustomer?: boolean
  buttonOnly?: boolean
  creditPackIndex?: number
  creditPurchase?: boolean
}

export function BillingActions({
  currentPlan,
  targetPlan,
  hasStripeCustomer,
  buttonOnly,
  creditPackIndex,
  creditPurchase,
}: BillingActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async (plan: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
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
        body: JSON.stringify({ packageIndex: index }),
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

  if (creditPurchase && creditPackIndex !== undefined) {
    return (
      <button
        onClick={() => handleCreditPurchase(creditPackIndex)}
        disabled={loading}
        className="mt-4 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Buy Credits'}
      </button>
    )
  }

  if (buttonOnly && targetPlan) {
    const isUpgrade = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'].indexOf(targetPlan) >
      ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'].indexOf(currentPlan || 'FREE')

    return (
      <button
        onClick={() => handleUpgrade(targetPlan)}
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
        ) : isUpgrade ? (
          'Upgrade'
        ) : (
          'Switch Plan'
        )}
      </button>
    )
  }

  // Full management section
  return (
    <div className="flex gap-3 mb-8">
      {hasStripeCustomer && (
        <button
          onClick={handleManageBilling}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition disabled:opacity-50"
        >
          <ArrowUpRight className="h-4 w-4" />
          Manage Subscription
        </button>
      )}
      {currentPlan === 'FREE' && (
        <button
          onClick={() => handleUpgrade('PRO')}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
        >
          Upgrade to Pro
        </button>
      )}
    </div>
  )
}
