'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { confirmAction } from '@/lib/confirm'

interface DeleteReelButtonProps {
  reelId: string
  isProcessing: boolean
}

export function DeleteReelButton({ reelId, isProcessing }: DeleteReelButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  async function onDelete() {
    const confirmed = await confirmAction({
      title: 'Delete Reel?',
      text: 'This reel will be permanently deleted. This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger',
    })
    if (!confirmed) return

    setError('')
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/reels/${reelId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to delete reel')
      }
      router.push('/reels')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete reel'
      setError(message)
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting || isProcessing}
        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Delete
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
