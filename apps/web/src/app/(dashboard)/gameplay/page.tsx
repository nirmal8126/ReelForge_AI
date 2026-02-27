import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Joystick,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Play,
  Clock,
  Monitor,
} from 'lucide-react'
import { getJobStatusLabel } from '@/lib/utils'
import { Pagination } from '@/components/pagination'
import { AdminUserBadge } from '@/components/admin-user-badge'
import { AdminDeleteButton } from '@/components/admin-delete-button'

interface GameplayPageProps {
  searchParams: { status?: string; page?: string }
}

const TEMPLATE_LABELS: Record<string, string> = {
  ENDLESS_RUNNER: 'Endless Runner',
  BALL_MAZE: 'Ball Maze',
  OBSTACLE_TOWER: 'Obstacle Tower',
  COLOR_SWITCH: 'Color Switch',
}

const TEMPLATE_EMOJIS: Record<string, string> = {
  ENDLESS_RUNNER: '🏃',
  BALL_MAZE: '🔵',
  OBSTACLE_TOWER: '🏗️',
  COLOR_SWITCH: '🌈',
}

export default async function GameplayPage({ searchParams }: GameplayPageProps) {
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
      processing: ['QUEUED', 'CONFIG_GENERATING', 'RENDERING', 'ENCODING', 'UPLOADING'],
      failed: ['FAILED'],
    }
    const statuses = statusMap[statusFilter]
    if (statuses) {
      where.status = { in: statuses }
    }
  }

  const [jobs, total] = await Promise.all([
    prisma.gameplayJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: isAdmin ? { select: { id: true, name: true, email: true } } : false },
    }),
    prisma.gameplayJob.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  // Status counts
  const statusCounts = await prisma.gameplayJob.groupBy({
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

  function getDifficultyColor(difficulty: string): string {
    const colors: Record<string, string> = {
      easy: '#22C55E',
      medium: '#F59E0B',
      hard: '#EF4444',
      insane: '#7C3AED',
    }
    return colors[difficulty] || '#6366F1'
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
      <div className="flex items-center justify-between mb-6 pb-5 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{isAdmin ? 'All Gameplay Videos' : '3D Gameplay Videos'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} video{total !== 1 ? 's' : ''} generated
          </p>
        </div>
        {!isAdmin && (
          <Link
            href="/gameplay/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition shadow-lg shadow-brand-600/20"
          >
            <PlusCircle className="h-4 w-4" />
            Create Video
          </Link>
        )}
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-5">
        {filters.map((filter) => (
          <Link
            key={filter.key}
            href={`/gameplay${filter.key !== 'all' ? `?status=${filter.key}` : ''}`}
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

      {/* Grid */}
      {jobs.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-16 text-center">
          <Joystick className="h-16 w-16 text-gray-600 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {statusFilter === 'all' ? 'No gameplay videos yet' : `No ${statusFilter} videos`}
          </h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            {statusFilter === 'all'
              ? 'Create your first 3D gameplay video. Generate satisfying animated content for Shorts, Reels & TikTok!'
              : `You don't have any videos with the "${statusFilter}" status.`}
          </p>
          {statusFilter === 'all' && !isAdmin && (
            <Link
              href="/gameplay/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <PlusCircle className="h-5 w-5" />
              Create Your First Video
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/gameplay/${job.id}`}
                className="group rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-brand-500/50 hover:bg-white/[0.07] transition-all"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[4/3] bg-gray-900 flex items-center justify-center overflow-hidden">
                  {job.status === 'COMPLETED' && job.thumbnailUrl ? (
                    <div className="w-full h-full relative">
                      <img src={job.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/60 transition">
                          <Play className="h-5 w-5 text-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : job.status === 'COMPLETED' ? (
                    <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition">
                        <Play className="h-5 w-5 text-white ml-0.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl">{TEMPLATE_EMOJIS[job.template] || '🎮'}</span>
                      {job.status !== 'FAILED' && (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 text-brand-400 animate-spin" />
                          <span className="text-xs text-brand-400">{getJobStatusLabel(job.status)}...</span>
                        </div>
                      )}
                      {job.status === 'FAILED' && (
                        <span className="text-xs text-red-400">Failed</span>
                      )}
                    </div>
                  )}

                  {/* Top badges */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="rounded-md px-2 py-0.5 text-xs font-medium text-white bg-black/50 backdrop-blur-sm">
                      {TEMPLATE_LABELS[job.template]}
                    </span>
                  </div>
                  <span
                    className="absolute top-2 right-2 rounded-md px-2 py-0.5 text-xs font-medium capitalize backdrop-blur-sm"
                    style={{
                      backgroundColor: getDifficultyColor(job.difficulty) + '30',
                      color: getDifficultyColor(job.difficulty),
                    }}
                  >
                    {job.difficulty}
                  </span>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5">
                    <div className="flex items-center gap-3 text-xs text-gray-300">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {job.duration}s
                      </span>
                      <span className="flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        {job.aspectRatio}
                      </span>
                      <span className="capitalize">{job.theme}</span>
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${getStatusBadgeClass(job.status)}`}
                    >
                      {getStatusIcon(job.status)}
                      {getJobStatusLabel(job.status)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      {formatDate(job.createdAt)}
                    </span>
                  </div>
                  {job.gameTitle && (
                    <p className="text-xs text-gray-400 mt-1.5 truncate">{job.gameTitle}</p>
                  )}
                  {isAdmin && job.user && (
                    <AdminUserBadge
                      name={job.user.name || ''}
                      email={job.user.email || ''}
                    />
                  )}
                  {isAdmin && (
                    <div className="mt-2">
                      <AdminDeleteButton jobType="gameplay" jobId={job.id} />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            basePath="/gameplay"
            searchParams={statusFilter !== 'all' ? { status: statusFilter } : {}}
          />
        </>
      )}
    </div>
  )
}
