'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface RetryButtonProps {
  jobId: string
}

export function RetryButton({ jobId }: RetryButtonProps) {
  const router = useRouter()
  const [isRetrying, setIsRetrying] = useState(false)

  async function onRetry() {
    setIsRetrying(true)
    try {
      const res = await fetch(`/api/gameplay/${jobId}/retry`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to retry')
      }
      toast.success('Retrying gameplay generation...')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retry'
      toast.error(message)
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={isRetrying}
      className="inline-flex items-center gap-2 rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-sm font-medium text-brand-400 hover:bg-brand-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Retry
    </button>
  )
}
