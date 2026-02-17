import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Film,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  LayoutGrid,
  List,
  Calendar,
  Timer,
} from 'lucide-react'
import { getJobStatusColor, getJobStatusLabel } from '@/lib/utils'
import { AdminUserBadge } from '@/components/admin-user-badge'
import { AdminDeleteButton } from '@/components/admin-delete-button'

interface ReelsPageProps {
  searchParams: { status?: string; page?: string }
}

export default async function ReelsPage({ searchParams }: ReelsPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'
  const statusFilter = searchParams.status || 'all'
  const page = Math.max(1, parseInt(searchParams.page || '1', 10))
  const limit = 12

  const where: Record<string, unknown> = isAdmin ? {} : { userId: session.user.id }

  if (statusFilter !== 'all') {
    const statusMap: Record<string, string[]> = {
      completed: ['COMPLETED'],
      processing: [
        'PROCESSING', 'SCRIPT_GENERATING', 'VOICE_GENERATING',
        'VIDEO_GENERATING', 'COMPOSING', 'UPLOADING', 'QUEUED',
      ],
      failed: ['FAILED'],
    }
    const statuses = statusMap[statusFilter]
    if (statuses) {
      where.status = { in: statuses }
    }
  }

  const [reels, total] = await Promise.all([
    prisma.reelJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        channelProfile: {
          select: { id: true, name: true },
        },
        ...(isAdmin && { user: { select: { id: true, name: true, email: true } } }),
      },
    }),
    prisma.reelJob.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  const statusCounts = await prisma.reelJob.groupBy({
    by: ['status'],
    where: isAdmin ? {} : { userId: session.user.id },
    _count: true,
  })

  const completedCount = statusCounts
    .filter((s) => s.status === 'COMPLETED')
    .reduce((sum, s) => sum + s._count, 0)

  const processingCount = statusCounts
    .filter((s) => s.status !== 'COMPLETED' && s.status !== 'FAILED')
    .reduce((sum, s) => sum + s._count, 0)

  const failedCount = statusCounts
    .filter((s) => s.status === 'FAILED')
    .reduce((sum, s) => sum + s._count, 0)

  const allCount = statusCounts.reduce((sum, s) => sum + s._count, 0)

  const filters = [
    { key: 'all', label: 'All', count: allCount },
    { key: 'completed', label: 'Completed', count: completedCount },
    { key: 'processing', label: 'Processing', count: processingCount },
    { key: 'failed', label: 'Failed', count: failedCount },
  ]

  function getStatusIcon(status: string) {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-400" />
      default:
        return <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />
    }
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'FAILED':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      default:
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    }
  }

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date))
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/[0.06]">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{isAdmin ? 'All Reels' : 'My Reels'}</h1>
          <p className="text-sm text-gray-500 mt-2">
            {total} reel{total !== 1 ? 's' : ''} in your library
          </p>
        </div>
        {!isAdmin && (
          <Link
            href="/reels/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition shadow-lg shadow-brand-600/20"
          >
            <PlusCircle className="h-4 w-4" />
            Create New Reel
          </Link>
        )}
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-6">
        {filters.map((filter) => (
          <Link
            key={filter.key}
            href={`/reels${filter.key !== 'all' ? `?status=${filter.key}` : ''}`}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              statusFilter === filter.key
                ? 'bg-brand-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {filter.label}
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-xs ${
                statusFilter === filter.key
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-gray-500'
              }`}
            >
              {filter.count}
            </span>
          </Link>
        ))}
      </div>

      {/* Reels Grid */}
      {reels.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-16 text-center">
          <Film className="h-16 w-16 text-gray-600 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {statusFilter === 'all'
              ? 'No reels yet'
              : `No ${statusFilter} reels`}
          </h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            {statusFilter === 'all'
              ? 'Create your first AI-powered reel and watch the magic happen. It only takes a minute to get started.'
              : `You don't have any reels with the "${statusFilter}" status.`}
          </p>
          {statusFilter === 'all' && !isAdmin && (
            <Link
              href="/reels/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <PlusCircle className="h-5 w-5" />
              Create Your First Reel
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {reels.map((reel) => (
              <Link
                key={reel.id}
                href={`/reels/${reel.id}`}
                className="group rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-brand-500/50 hover:bg-white/[0.07] transition-all"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
                  {reel.thumbnailUrl ? (
                    <img
                      src={reel.thumbnailUrl}
                      alt={reel.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Film className="h-10 w-10 text-gray-700" />
                  )}
                  {/* Duration badge */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                    <Timer className="h-3 w-3" />
                    {reel.durationSeconds}s
                  </div>
                  {/* Aspect ratio badge */}
                  <div className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-gray-300">
                    {reel.aspectRatio}
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4">
                  <h3 className="text-sm font-medium text-white truncate group-hover:text-brand-300 transition">
                    {reel.title}
                  </h3>

                  <div className="flex items-center justify-between mt-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${getStatusBadgeClass(
                        reel.status
                      )}`}
                    >
                      {getStatusIcon(reel.status)}
                      {getJobStatusLabel(reel.status)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(reel.createdAt)}
                    </span>
                    {reel.style && (
                      <span className="truncate">{reel.style}</span>
                    )}
                  </div>

                  {reel.channelProfile && (
                    <div className="mt-2 text-xs text-gray-500 truncate">
                      {reel.channelProfile.name}
                    </div>
                  )}

                  {isAdmin && (reel as Record<string, unknown>).user && (
                    <AdminUserBadge
                      name={((reel as Record<string, unknown>).user as Record<string, string>).name}
                      email={((reel as Record<string, unknown>).user as Record<string, string>).email}
                    />
                  )}
                  {isAdmin && (
                    <div className="mt-2">
                      <AdminDeleteButton jobType="reel" jobId={reel.id} />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={`/reels?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${page - 1}`}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-400 hover:bg-white/10 hover:text-white transition"
                >
                  Previous
                </Link>
              )}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => {
                    const showEllipsis = idx > 0 && p - arr[idx - 1] > 1
                    return (
                      <span key={p} className="flex items-center gap-1">
                        {showEllipsis && (
                          <span className="px-2 text-gray-600">...</span>
                        )}
                        <Link
                          href={`/reels?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${p}`}
                          className={`min-w-[36px] h-9 flex items-center justify-center rounded-lg text-sm transition ${
                            p === page
                              ? 'bg-brand-600 text-white font-medium'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {p}
                        </Link>
                      </span>
                    )
                  })}
              </div>
              {page < totalPages && (
                <Link
                  href={`/reels?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${page + 1}`}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-400 hover:bg-white/10 hover:text-white transition"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
