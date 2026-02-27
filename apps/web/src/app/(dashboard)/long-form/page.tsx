import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Video,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Timer,
  Play,
} from 'lucide-react'
import { getJobStatusLabel } from '@/lib/utils'
import { AdminUserBadge } from '@/components/admin-user-badge'
import { AdminDeleteButton } from '@/components/admin-delete-button'
import { NICHE_PRESETS, VIDEO_STYLES } from '@/lib/constants'

interface LongFormPageProps {
  searchParams: { status?: string; page?: string }
}

const STYLE_COLOR_MAP: Record<string, string> = Object.fromEntries([
  ...Object.entries(NICHE_PRESETS).map(([key, val]) => [key, val.primaryColor]),
  ...VIDEO_STYLES.map((s) => [s.id, s.color]),
])

export default async function LongFormPage({ searchParams }: LongFormPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'
  const statusFilter = searchParams.status || 'all'
  const page = Math.max(1, parseInt(searchParams.page || '1', 10))
  const limit = 15

  const where: Record<string, unknown> = isAdmin ? {} : { userId: session.user.id }

  if (statusFilter !== 'all') {
    const statusMap: Record<string, string[]> = {
      completed: ['COMPLETED'],
      processing: [
        'QUEUED', 'PLANNING', 'SCRIPT_GENERATING', 'VOICE_GENERATING',
        'VIDEO_GENERATING', 'COMPOSING', 'UPLOADING', 'PUBLISHING',
      ],
      failed: ['FAILED'],
    }
    const statuses = statusMap[statusFilter]
    if (statuses) {
      where.status = { in: statuses }
    }
  }

  const userWhere = isAdmin ? {} : { userId: session.user.id }

  const [jobs, total, statusCounts] = await Promise.all([
    prisma.longFormJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        channelProfile: {
          select: { id: true, name: true },
        },
        _count: {
          select: { segments: true },
        },
        user: isAdmin ? { select: { id: true, name: true, email: true } } : false,
      },
    }),
    prisma.longFormJob.count({ where }),
    prisma.longFormJob.groupBy({
      by: ['status'],
      where: userWhere,
      _count: true,
    }),
  ])

  const totalPages = Math.ceil(total / limit)

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
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
      case 'FAILED':
        return <XCircle className="h-3.5 w-3.5 text-red-400" />
      default:
        return <Loader2 className="h-3.5 w-3.5 text-yellow-400 animate-spin" />
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

  function timeAgo(date: Date) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(date))
  }

  function getStyleLabel(style: string) {
    const vs = VIDEO_STYLES.find((s) => s.id === style)
    if (vs) return vs.name
    const preset = NICHE_PRESETS[style as keyof typeof NICHE_PRESETS]
    return preset?.name || style
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-5 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{isAdmin ? 'All Long-Form Videos' : 'My Videos'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} video{total !== 1 ? 's' : ''} generated
          </p>
        </div>
        {!isAdmin && (
          <Link
            href="/long-form/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition shadow-lg shadow-brand-600/20"
          >
            <PlusCircle className="h-4 w-4" />
            New Video
          </Link>
        )}
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-5">
        {filters.map((filter) => (
          <Link
            key={filter.key}
            href={`/long-form${filter.key !== 'all' ? `?status=${filter.key}` : ''}`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === filter.key
                ? 'bg-brand-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {filter.label}
            <span
              className={`inline-flex items-center justify-center min-w-[18px] h-4 rounded-full px-1 text-[10px] ${
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

      {/* Videos Grid */}
      {jobs.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-16 text-center">
          <Video className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {statusFilter === 'all' ? 'No videos yet' : `No ${statusFilter} videos`}
          </h3>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto text-sm">
            {statusFilter === 'all'
              ? 'Create your first AI-powered long-form video with just a topic.'
              : `No videos with "${statusFilter}" status.`}
          </p>
          {statusFilter === 'all' && !isAdmin && (
            <Link
              href="/long-form/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <PlusCircle className="h-4 w-4" />
              Create First Video
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {jobs.map((job) => {
              const styleColor = STYLE_COLOR_MAP[job.style || ''] || '#6366F1'

              return (
                <Link
                  key={job.id}
                  href={`/long-form/${job.id}`}
                  className="group relative rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden hover:border-brand-500/40 hover:bg-white/[0.06] transition-all"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[16/10] bg-gray-900 flex items-center justify-center">
                    {job.thumbnailUrl ? (
                      <img
                        src={job.thumbnailUrl}
                        alt={job.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Video className="h-8 w-8 text-gray-700" />
                    )}
                    {/* Play overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Play className="h-8 w-8 text-white/80" />
                    </div>
                    {/* Duration badge */}
                    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white font-medium">
                      <Timer className="h-3 w-3" />
                      {job.durationMinutes}min
                    </div>
                    {/* Aspect ratio badge */}
                    <div className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-gray-300">
                      {job.aspectRatio}
                    </div>
                    {/* Status overlay for non-completed */}
                    {job.status !== 'COMPLETED' && (
                      <div className="absolute top-1.5 right-1.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${getStatusBadgeClass(job.status)}`}
                        >
                          {getStatusIcon(job.status)}
                          {getJobStatusLabel(job.status)}
                        </span>
                      </div>
                    )}
                    {/* Progress bar for processing jobs */}
                    {job.status !== 'COMPLETED' && job.status !== 'FAILED' && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                        <div
                          className="h-full bg-brand-500 transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-3">
                    {/* Title + completed check */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-white truncate group-hover:text-brand-300 transition flex-1">
                        {job.title}
                      </h3>
                      {job.status === 'COMPLETED' && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* Meta row: style + segments + language */}
                    <div className="flex items-center gap-2 mt-1.5">
                      {job.style && (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: styleColor + '18',
                            color: styleColor,
                          }}
                        >
                          {getStyleLabel(job.style)}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-500">
                        {job._count.segments} segments
                      </span>
                      {job.language && (
                        <span className="text-[11px] text-gray-500 uppercase tracking-wide">
                          {job.language}
                        </span>
                      )}
                    </div>

                    {/* Footer: channel + time */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.05]">
                      <span className="text-[11px] text-gray-500 truncate max-w-[60%]">
                        {job.channelProfile?.name || 'No channel'}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Clock className="h-3 w-3" />
                        {timeAgo(job.createdAt)}
                      </span>
                    </div>

                    {isAdmin && job.user && (
                      <AdminUserBadge
                        name={job.user.name || ''}
                        email={job.user.email || ''}
                      />
                    )}
                    {isAdmin && (
                      <div className="mt-2">
                        <AdminDeleteButton jobType="longForm" jobId={job.id} />
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={`/long-form?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${page - 1}`}
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
                        {showEllipsis && <span className="px-2 text-gray-600">...</span>}
                        <Link
                          href={`/long-form?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${p}`}
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
                  href={`/long-form?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${page + 1}`}
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
