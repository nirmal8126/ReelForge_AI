'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Tv,
  Search,
  Loader2,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmAction } from '@/lib/confirm'

interface ChannelProfile {
  id: string
  name: string
  platform: string
  niche: string
  tone: string
  primaryColor: string
  isDefault: boolean
  consistencyScore: number
  defaultLanguage: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
  }
  _count: {
    reelJobs: number
    longFormJobs: number
  }
}

const PLATFORM_LABELS: Record<string, string> = {
  YOUTUBE: 'YouTube',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  MULTI: 'Multi-platform',
}

const TONE_LABELS: Record<string, string> = {
  PROFESSIONAL: 'Professional',
  CASUAL: 'Casual',
  ENERGETIC: 'Energetic',
  CALM: 'Calm',
  HUMOROUS: 'Humorous',
  INSPIRATIONAL: 'Inspirational',
}

export default function AdminChannelsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profiles, setProfiles] = useState<ChannelProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Auth guard
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      router.push('/login')
      return
    }
    if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
      router.push('/dashboard')
      toast.error('Super Admin access required')
    }
  }, [session, status, router])

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/channels?${params}`)
      const data = await res.json()
      setProfiles(data.profiles || [])
      setTotalPages(data.totalPages || 1)
      setTotal(data.total || 0)
    } catch {
      toast.error('Failed to load channels')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  function handleSearch() {
    setPage(1)
    setSearch(searchInput.trim())
  }

  async function handleDelete(profile: ChannelProfile) {
    const confirmed = await confirmAction({
      title: `Delete "${profile.name}"?`,
      text: `This will permanently remove ${profile.user.name || profile.user.email}'s channel profile. This cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
    })
    if (!confirmed) return

    setDeleting(profile.id)
    try {
      const res = await fetch(`/api/admin/channels?id=${profile.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      toast.success('Channel profile deleted')
      fetchProfiles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Tv className="h-6 w-6 text-brand-400" />
            Channel Profiles
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View and manage all users&apos; channel profiles ({total} total)
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name, niche, owner..."
            className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition"
        >
          Search
        </button>
        {search && (
          <button
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setPage(1)
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <Tv className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {search ? 'No channel profiles match your search' : 'No channel profiles found'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Channel</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Owner</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Platform</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Niche</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Tone</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Reels</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Videos</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Score</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-white/[0.02] transition">
                    {/* Channel */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: profile.primaryColor + '20' }}
                        >
                          <Tv className="h-4 w-4" style={{ color: profile.primaryColor }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{profile.name}</p>
                          {profile.isDefault && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400">
                              Default
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-3 w-3 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-xs text-white">{profile.user.name || '—'}</p>
                          <p className="text-[10px] text-gray-500">{profile.user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Platform */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-300">
                        {PLATFORM_LABELS[profile.platform] || profile.platform}
                      </span>
                    </td>

                    {/* Niche */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-300">{profile.niche}</span>
                    </td>

                    {/* Tone */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">
                        {TONE_LABELS[profile.tone] || profile.tone}
                      </span>
                    </td>

                    {/* Reels count */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-white">{profile._count.reelJobs}</span>
                    </td>

                    {/* Videos count */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-white">{profile._count.longFormJobs}</span>
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-white/10">
                          <div
                            className="h-1.5 rounded-full bg-brand-500"
                            style={{ width: `${profile.consistencyScore}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400">{profile.consistencyScore}%</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(profile)}
                        disabled={deleting === profile.id}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                      >
                        {deleting === profile.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages} ({total} profiles)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
