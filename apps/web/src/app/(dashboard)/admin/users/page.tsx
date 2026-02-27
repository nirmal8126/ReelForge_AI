'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Loader2,
  Search,
  CreditCard,
  Coins,
  Film,
  Quote,
  Gamepad2,
  Video,
  Clapperboard,
  ChevronLeft,
  ChevronRight,
  Shield,
  Pencil,
  X,
  Save,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface UserData {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  referralTier: string
  creditsBalance: number
  totalReferrals: number
  createdAt: string
  subscription: {
    plan: string
    status: string
    jobsLimit: number
    jobsUsed: number
  } | null
  _count: {
    reelJobs: number
    quoteJobs: number
    challengeJobs: number
    longFormJobs: number
    cartoonSeries: number
  }
}

const PLANS = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const

const PLAN_COLORS: Record<string, string> = {
  FREE: '#6B7280',
  STARTER: '#3B82F6',
  PRO: '#8B5CF6',
  BUSINESS: '#F59E0B',
  ENTERPRISE: '#EF4444',
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<UserData[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)

  // Edit modal state
  const [editUser, setEditUser] = useState<UserData | null>(null)
  const [editCredits, setEditCredits] = useState('')
  const [editPlan, setEditPlan] = useState('')
  const [editJobsLimit, setEditJobsLimit] = useState('')
  const [editJobsUsed, setEditJobsUsed] = useState('')
  const [saving, setSaving] = useState(false)

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
  }, [session, status, router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setUsers(data.users)
      setTotal(data.total)
      setLimit(data.limit)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    if (status !== 'loading' && (session?.user as Record<string, unknown>)?.role === 'ADMIN') {
      fetchUsers()
    }
  }, [fetchUsers, status, session])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  function openEditModal(user: UserData) {
    setEditUser(user)
    setEditCredits(String(user.creditsBalance))
    setEditPlan(user.subscription?.plan || 'FREE')
    setEditJobsLimit(String(user.subscription?.jobsLimit ?? 3))
    setEditJobsUsed(String(user.subscription?.jobsUsed ?? 0))
  }

  function closeEditModal() {
    setEditUser(null)
    setSaving(false)
  }

  async function handleSave() {
    if (!editUser) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editUser.id,
          creditsBalance: parseInt(editCredits, 10),
          plan: editPlan,
          jobsLimit: parseInt(editJobsLimit, 10),
          jobsUsed: parseInt(editJobsUsed, 10),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }
      toast.success(`${editUser.name} updated`)
      closeEditModal()
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  function getPlanColor(plan: string): string {
    return PLAN_COLORS[plan] || '#6366F1'
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date))
  }

  const totalPages = Math.ceil(total / limit)
  const totalJobs = (u: UserData) =>
    u._count.reelJobs + u._count.quoteJobs + u._count.challengeJobs + u._count.longFormJobs + u._count.cartoonSeries

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Users</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Super Admin — {total} registered user{total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="rounded-lg bg-white/5 border border-white/10 pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-500 w-64"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">User</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Plan</th>
                <th className="text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Credits</th>
                <th className="text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Usage</th>
                <th className="text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Jobs</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Joined</th>
                <th className="text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const plan = user.subscription?.plan || 'FREE'
                const planColor = getPlanColor(plan)

                return (
                  <tr
                    key={user.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition"
                  >
                    {/* User info */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500/30 to-brand-600/20 flex items-center justify-center ring-1 ring-white/[0.06] flex-shrink-0">
                          <span className="text-xs font-semibold text-brand-400">
                            {user.name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{user.name}</p>
                            {user.role === 'ADMIN' && (
                              <Shield className="h-3 w-3 text-red-400 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: planColor + '15', color: planColor }}
                      >
                        {plan}
                      </span>
                    </td>

                    {/* Credits */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-white">{user.creditsBalance}</span>
                    </td>

                    {/* Usage (jobs used / limit) */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-gray-400">
                        {user.subscription?.jobsUsed || 0}/{user.subscription?.jobsLimit || 3}
                      </span>
                    </td>

                    {/* Total jobs breakdown */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {user._count.quoteJobs > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-gray-500" title="Quotes">
                            <Quote className="h-3 w-3" />
                            {user._count.quoteJobs}
                          </span>
                        )}
                        {user._count.reelJobs > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-gray-500" title="Reels">
                            <Film className="h-3 w-3" />
                            {user._count.reelJobs}
                          </span>
                        )}
                        {user._count.longFormJobs > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-gray-500" title="Videos">
                            <Video className="h-3 w-3" />
                            {user._count.longFormJobs}
                          </span>
                        )}
                        {user._count.cartoonSeries > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-gray-500" title="Cartoon Series">
                            <Clapperboard className="h-3 w-3" />
                            {user._count.cartoonSeries}
                          </span>
                        )}
                        {user._count.challengeJobs > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-gray-500" title="Challenges">
                            <Gamepad2 className="h-3 w-3" />
                            {user._count.challengeJobs}
                          </span>
                        )}
                        {totalJobs(user) === 0 && (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </div>
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{formatDate(user.createdAt)}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEditModal(user)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {users.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {search ? `No users found for "${search}"` : 'No users found'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-400 min-w-[80px] text-center">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeEditModal}
          />
          <div className="relative bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <button
              onClick={closeEditModal}
              className="absolute top-3 right-3 text-gray-500 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Modal header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500/30 to-brand-600/20 flex items-center justify-center ring-1 ring-white/[0.06]">
                <span className="text-sm font-semibold text-brand-400">
                  {editUser.name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{editUser.name}</h3>
                <p className="text-xs text-gray-500">{editUser.email}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Credits Balance */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-yellow-400" />
                    Credits Balance
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={editCredits}
                  onChange={(e) => setEditCredits(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-500 transition"
                />
              </div>

              {/* Subscription Plan */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-blue-400" />
                    Subscription Plan
                  </span>
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {PLANS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPlan(p)}
                      className={`text-xs font-semibold py-2 rounded-lg border transition ${
                        editPlan === p
                          ? 'border-brand-500 bg-brand-500/10 text-white'
                          : 'border-white/10 bg-white/5 text-gray-500 hover:text-gray-300 hover:border-white/20'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Jobs Limit & Used */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Jobs Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editJobsLimit}
                    onChange={(e) => setEditJobsLimit(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Jobs Used
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editJobsUsed}
                    onChange={(e) => setEditJobsUsed(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/[0.06]">
              <button
                onClick={closeEditModal}
                disabled={saving}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition inline-flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
