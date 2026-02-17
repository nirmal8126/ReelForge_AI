import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Gamepad2,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Play,
  Timer,
  HelpCircle,
  Zap,
} from 'lucide-react'
import { getJobStatusColor, getJobStatusLabel } from '@/lib/utils'
import { AdminUserBadge } from '@/components/admin-user-badge'

interface ChallengesPageProps {
  searchParams: { status?: string; page?: string }
}

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  emoji_guess: 'Emoji Guess',
  riddle: 'Riddle',
  math: 'Math',
  gk_quiz: 'GK Quiz',
  would_you_rather: 'Would You Rather',
}

const CHALLENGE_TYPE_EMOJIS: Record<string, string> = {
  emoji_guess: '😄',
  riddle: '🧩',
  math: '🔢',
  gk_quiz: '📚',
  would_you_rather: '🤔',
}

export default async function ChallengesPage({ searchParams }: ChallengesPageProps) {
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
      processing: ['QUEUED', 'CONTENT_GENERATING', 'COMPOSING', 'UPLOADING'],
      failed: ['FAILED'],
    }
    const statuses = statusMap[statusFilter]
    if (statuses) {
      where.status = { in: statuses }
    }
  }

  const [challenges, total] = await Promise.all([
    prisma.challengeJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      ...(isAdmin && { include: { user: { select: { id: true, name: true, email: true } } } }),
    }),
    prisma.challengeJob.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  // Status counts for filter badges
  const statusCounts = await prisma.challengeJob.groupBy({
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
      impossible: '#7C3AED',
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
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/[0.06]">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{isAdmin ? 'All Challenges' : 'My Challenges'}</h1>
          <p className="text-sm text-gray-500 mt-2">
            {total} challenge{total !== 1 ? 's' : ''} in your library
          </p>
        </div>
        <Link
          href="/challenges/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition shadow-lg shadow-brand-600/20"
        >
          <PlusCircle className="h-4 w-4" />
          Create Challenge
        </Link>
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-6">
        {filters.map((filter) => (
          <Link
            key={filter.key}
            href={`/challenges${filter.key !== 'all' ? `?status=${filter.key}` : ''}`}
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

      {/* Challenges Grid */}
      {challenges.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-16 text-center">
          <Gamepad2 className="h-16 w-16 text-gray-600 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {statusFilter === 'all' ? 'No challenges yet' : `No ${statusFilter} challenges`}
          </h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            {statusFilter === 'all'
              ? 'Create your first AI-powered challenge video. Engage your audience with interactive quizzes and games!'
              : `You don't have any challenges with the "${statusFilter}" status.`}
          </p>
          {statusFilter === 'all' && (
            <Link
              href="/challenges/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <PlusCircle className="h-5 w-5" />
              Create Your First Challenge
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {challenges.map((challenge) => (
              <Link
                key={challenge.id}
                href={`/challenges/${challenge.id}`}
                className="group rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-brand-500/50 hover:bg-white/[0.07] transition-all"
              >
                {/* Thumbnail / Preview */}
                <div className="relative aspect-[4/3] bg-gray-900 flex items-center justify-center overflow-hidden">
                  {challenge.status === 'COMPLETED' && challenge.outputUrl ? (
                    <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition">
                        <Play className="h-5 w-5 text-white ml-0.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl">{CHALLENGE_TYPE_EMOJIS[challenge.challengeType] || '🎮'}</span>
                      {challenge.status !== 'COMPLETED' && challenge.status !== 'FAILED' && (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 text-brand-400 animate-spin" />
                          <span className="text-xs text-brand-400">{getJobStatusLabel(challenge.status)}...</span>
                        </div>
                      )}
                      {challenge.status === 'FAILED' && (
                        <span className="text-xs text-red-400">Failed</span>
                      )}
                    </div>
                  )}

                  {/* Top badges */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="rounded-md px-2 py-0.5 text-xs font-medium text-white bg-black/50 backdrop-blur-sm">
                      {CHALLENGE_TYPE_LABELS[challenge.challengeType]}
                    </span>
                  </div>
                  <span
                    className="absolute top-2 right-2 rounded-md px-2 py-0.5 text-xs font-medium capitalize backdrop-blur-sm"
                    style={{
                      backgroundColor: getDifficultyColor(challenge.difficulty) + '30',
                      color: getDifficultyColor(challenge.difficulty),
                    }}
                  >
                    {challenge.difficulty}
                  </span>

                  {/* Bottom info overlay */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5">
                    <div className="flex items-center gap-3 text-xs text-gray-300">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="h-3 w-3" />
                        {challenge.numQuestions}Q
                      </span>
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {challenge.timerSeconds}s
                      </span>
                      <span className="capitalize">{challenge.category}</span>
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                        challenge.status
                      )}`}
                    >
                      {getStatusIcon(challenge.status)}
                      {getJobStatusLabel(challenge.status)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      {formatDate(challenge.createdAt)}
                    </span>
                  </div>

                  {isAdmin && (challenge as Record<string, unknown>).user && (
                    <AdminUserBadge
                      name={((challenge as Record<string, unknown>).user as Record<string, string>).name}
                      email={((challenge as Record<string, unknown>).user as Record<string, string>).email}
                    />
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
                  href={`/challenges?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${page - 1}`}
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
                          href={`/challenges?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${p}`}
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
                  href={`/challenges?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${page + 1}`}
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
