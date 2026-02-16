import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Video,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Clock,
  Youtube,
} from 'lucide-react'
import { getJobStatusColor, getJobStatusLabel } from '@/lib/utils'

interface LongFormPageProps {
  searchParams: { status?: string; page?: string }
}

export default async function LongFormPage({ searchParams }: LongFormPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const statusFilter = searchParams.status || 'all'
  const page = Math.max(1, parseInt(searchParams.page || '1', 10))
  const limit = 12

  const where: Record<string, unknown> = { userId: session.user.id }

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

  const [jobs, total] = await Promise.all([
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
      },
    }),
    prisma.longFormJob.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  const statusCounts = await prisma.longFormJob.groupBy({
    by: ['status'],
    where: { userId: session.user.id },
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Long-Form Videos</h1>
          <p className="text-gray-400 mt-1">
            {total} video{total !== 1 ? 's' : ''} in your library (5-30 minutes)
          </p>
        </div>
        <Link
          href="/long-form/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition"
        >
          <PlusCircle className="h-4 w-4" />
          Create Long-Form Video
        </Link>
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-6">
        {filters.map((filter) => (
          <Link
            key={filter.key}
            href={`/long-form${filter.key !== 'all' ? `?status=${filter.key}` : ''}`}
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

      {/* Videos Grid */}
      {jobs.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-16 text-center">
          <Video className="h-16 w-16 text-gray-600 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {statusFilter === 'all'
              ? 'No long-form videos yet'
              : `No ${statusFilter} videos`}
          </h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            {statusFilter === 'all'
              ? 'Create your first AI-powered long-form video (5-30 minutes) with hybrid generation for cost-effective quality.'
              : `You don't have any videos with the "${statusFilter}" status.`}
          </p>
          {statusFilter === 'all' && (
            <Link
              href="/long-form/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <PlusCircle className="h-5 w-5" />
              Create Your First Long-Form Video
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/long-form/${job.id}`}
                className="group rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-brand-500/50 hover:bg-white/[0.07] transition-all"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
                  {job.thumbnailUrl ? (
                    <img
                      src={job.thumbnailUrl}
                      alt={job.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Video className="h-10 w-10 text-gray-700" />
                  )}
                  {/* Duration badge */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                    <Clock className="h-3 w-3" />
                    {job.durationMinutes}min
                  </div>
                  {/* Aspect ratio badge */}
                  <div className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-gray-300">
                    {job.aspectRatio}
                  </div>
                  {/* YouTube badge */}
                  {job.youtubeVideoId && (
                    <div className="absolute top-2 right-2 rounded bg-red-600/90 px-1.5 py-0.5 text-xs text-white flex items-center gap-1">
                      <Youtube className="h-3 w-3" />
                      Published
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4">
                  <h3 className="text-sm font-medium text-white truncate group-hover:text-brand-300 transition">
                    {job.title}
                  </h3>

                  <div className="flex items-center justify-between mt-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${getStatusBadgeClass(
                        job.status
                      )}`}
                    >
                      {getStatusIcon(job.status)}
                      {getJobStatusLabel(job.status)}
                    </span>
                  </div>

                  {/* Progress bar for processing jobs */}
                  {job.status !== 'COMPLETED' && job.status !== 'FAILED' && (
                    <div className="mt-3">
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{job.progress}% complete</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(job.createdAt)}
                    </span>
                    <span className="truncate">
                      {job._count.segments} segments
                    </span>
                  </div>

                  {job.channelProfile && (
                    <div className="mt-2 text-xs text-gray-500 truncate">
                      {job.channelProfile.name}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="text-gray-500">
                      {job.creditsCost} credits
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className="text-gray-500">
                      {Math.round((job.aiClipRatio || 0.3) * 100)}% AI
                    </span>
                  </div>
                </div>
              </Link>
            ))}
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
                        {showEllipsis && (
                          <span className="px-2 text-gray-600">...</span>
                        )}
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
