'use client'

import { useState, useEffect } from 'react'
import { Trash2, Loader2, AlertTriangle, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface AdminDeleteButtonProps {
  jobType: 'reel' | 'quote' | 'challenge' | 'longForm' | 'cartoonSeries' | 'imageStudio' | 'gameplay'
  jobId: string
}

const JOB_TYPE_LABELS: Record<string, string> = {
  reel: 'Reel',
  quote: 'Quote',
  challenge: 'Challenge',
  longForm: 'Long-Form Video',
  cartoonSeries: 'Cartoon Series',
  imageStudio: 'Image Studio Job',
  gameplay: 'Gameplay Video',
}

export function AdminDeleteButton({ jobType, jobId }: AdminDeleteButtonProps) {
  const [deleting, setDeleting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!showModal) return
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowModal(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [showModal])

  function openModal(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShowModal(true)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType, jobId }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Job deleted successfully')
      setShowModal(false)
      router.refresh()
    } catch {
      toast.error('Failed to delete job')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-red-500/20 bg-red-500/5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete {JOB_TYPE_LABELS[jobType]}</h3>
                <p className="text-xs text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to permanently delete this {JOB_TYPE_LABELS[jobType].toLowerCase()}? All associated data and files will be removed.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition inline-flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
