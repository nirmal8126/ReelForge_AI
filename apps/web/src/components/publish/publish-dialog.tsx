'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Share2,
  Loader2,
  Youtube,
  Facebook,
  Instagram,
  X,
  CheckCircle2,
  XCircle,
  Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PublishDialogProps {
  jobType: string
  jobId: string
  videoUrl: string
  thumbnailUrl?: string | null
  defaultTitle?: string | null
}

interface SocialAccount {
  id: string
  platform: string
  accountId: string
  accountName: string
  accountAvatar: string | null
}

interface PublishResult {
  id: string
  status: string
  platformUrl: string | null
  errorMessage: string | null
  socialAccount: {
    platform: string
    accountName: string
  }
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  YOUTUBE: Youtube,
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
}

export function PublishDialog({ jobType, jobId, videoUrl, thumbnailUrl, defaultTitle }: PublishDialogProps) {
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState(defaultTitle || '')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [results, setResults] = useState<PublishResult[] | null>(null)

  useEffect(() => {
    if (open) {
      setLoading(true)
      setResults(null)
      setSelectedIds(new Set())
      setTitle(defaultTitle || '')
      setDescription('')

      fetch('/api/social-accounts')
        .then((res) => res.json())
        .then((data) => setAccounts(data.accounts || []))
        .catch(() => toast.error('Failed to load accounts'))
        .finally(() => setLoading(false))
    }
  }, [open, defaultTitle])

  function toggleAccount(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handlePublish() {
    if (selectedIds.size === 0) {
      toast.error('Select at least one account')
      return
    }

    setPublishing(true)
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobType,
          jobId,
          accountIds: Array.from(selectedIds),
          title: title || undefined,
          description: description || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Publish failed')
      }

      const data = await res.json()
      setResults(data.records)
      toast.success('Published successfully!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500 transition shadow-lg shadow-green-600/20"
      >
        <Upload className="h-4 w-4" />
        Publish
      </button>

      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !publishing && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0F0F14] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Share2 className="h-4.5 w-4.5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Publish to Social Media</h2>
                  <p className="text-xs text-gray-500">Select accounts and add details</p>
                </div>
              </div>
              <button
                onClick={() => !publishing && setOpen(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 text-brand-400 animate-spin" />
                </div>
              ) : results ? (
                /* Results */
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-400">Publish Results</h3>
                  {results.map((r) => {
                    const Icon = PLATFORM_ICONS[r.socialAccount.platform] || Share2
                    const isSuccess = r.status === 'PUBLISHED'
                    return (
                      <div
                        key={r.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          isSuccess
                            ? 'border-green-500/20 bg-green-500/5'
                            : 'border-red-500/20 bg-red-500/5'
                        }`}
                      >
                        <Icon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{r.socialAccount.accountName}</p>
                          {r.errorMessage && (
                            <p className="text-xs text-red-400 mt-0.5">{r.errorMessage}</p>
                          )}
                        </div>
                        {isSuccess ? (
                          <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : accounts.length === 0 ? (
                /* No accounts connected */
                <div className="text-center py-8">
                  <Share2 className="h-8 w-8 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 mb-1">No social accounts connected</p>
                  <p className="text-xs text-gray-600 mb-4">Connect your accounts to start publishing</p>
                  <Link
                    href="/social-accounts"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300"
                  >
                    Connect Accounts
                  </Link>
                </div>
              ) : (
                <>
                  {/* Account Selection */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Select Accounts</label>
                    <div className="space-y-2">
                      {accounts.map((account) => {
                        const Icon = PLATFORM_ICONS[account.platform] || Share2
                        const isSelected = selectedIds.has(account.id)
                        return (
                          <button
                            key={account.id}
                            onClick={() => toggleAccount(account.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition text-left ${
                              isSelected
                                ? 'border-brand-500/40 bg-brand-500/10'
                                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                            }`}
                          >
                            {account.accountAvatar ? (
                              <img
                                src={account.accountAvatar}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                                <Icon className="h-4 w-4 text-brand-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{account.accountName}</p>
                              <p className="text-xs text-gray-500">{account.platform}</p>
                            </div>
                            <div
                              className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition ${
                                isSelected
                                  ? 'border-brand-500 bg-brand-500'
                                  : 'border-gray-600'
                              }`}
                            >
                              {isSelected && (
                                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label htmlFor="publish-title" className="text-sm font-medium text-gray-300 mb-2 block">
                      Title
                    </label>
                    <input
                      id="publish-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter a title..."
                      maxLength={255}
                      className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 transition"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="publish-desc" className="text-sm font-medium text-gray-300 mb-2 block">
                      Description <span className="text-gray-600">(optional)</span>
                    </label>
                    <textarea
                      id="publish-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a description..."
                      rows={3}
                      maxLength={5000}
                      className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 transition resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.06]">
              {results ? (
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 transition"
                >
                  Done
                </button>
              ) : accounts.length > 0 ? (
                <>
                  <button
                    onClick={() => setOpen(false)}
                    disabled={publishing}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/[0.06] transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={publishing || selectedIds.size === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Publish to {selectedIds.size} Account{selectedIds.size !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/[0.06] transition"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
