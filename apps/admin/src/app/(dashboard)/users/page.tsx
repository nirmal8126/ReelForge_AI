import { prisma } from '@reelforge/db'
import { format } from 'date-fns'
import { Search, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface UsersPageProps {
  searchParams: { q?: string }
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const search = searchParams.q || ''

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : undefined,
    include: {
      subscription: { select: { plan: true, status: true } },
      _count: { select: { reelJobs: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const planBadge: Record<string, string> = {
    FREE: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    STARTER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    PRO: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    BUSINESS: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    ENTERPRISE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-gray-400 mt-1">
            {users.length.toLocaleString()} total users
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <form method="GET" className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900/60 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-colors text-sm"
          />
        </form>
      </div>

      {/* Table */}
      <div className="bg-gray-900/60 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  User
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Email
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Plan
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Reels
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Credits
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-medium text-brand-400">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-300">{user.email}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        planBadge[user.subscription?.plan || 'FREE'] || planBadge.FREE
                      }`}
                    >
                      {user.subscription?.plan || 'FREE'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-300">{user._count.reelJobs}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-300">{user.creditsBalance}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-500">
                      {format(new Date(user.createdAt), 'MMM d, yyyy')}
                    </span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      {search ? `No users matching "${search}"` : 'No users found'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
