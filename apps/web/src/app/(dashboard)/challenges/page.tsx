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
  Clock,
  Play,
  Timer,
  HelpCircle,
} from 'lucide-react'
import { getJobStatusLabel } from '@/lib/utils'
import { Pagination } from '@/components/pagination'
import { AdminUserBadge } from '@/components/admin-user-badge'
import { AdminDeleteButton } from '@/components/admin-delete-button'

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

const CHALLENGE_TYPE_COLORS: Record<string, string> = {
  emoji_guess: '#F59E0B',
  riddle: '#8B5CF6',
  math: '#3B82F6',
  gk_quiz: '#10B981',
  would_you_rather: '#EC4899',
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
  const limit = 15

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

  const userWhere = isAdmin ? {} : { userId: session.user.id }

  const [challenges, total, statusCounts] = await Promise.all([
    prisma.challengeJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: isAdmin ? { select: { id: true, name: true, email: true } } : false },
    }),
    prisma.challengeJob.count({ where }),
    prisma.challengeJob.groupBy({
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

  function getDifficultyColor(difficulty: string): string {
    const colors: Record<string, string> = {
      easy: '#22C55E',
      medium: '#F59E0B',
      hard: '#EF4444',
      impossible: '#7C3AED',
    }
    return colors[difficulty] || '#6366F1'
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-5 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{isAdmin ? 'All Challenges' : 'My Challenges'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} challenge{total !== 1 ? 's' : ''} generated
          </p>
        </div>
        {!isAdmin && (
          <Link
            href="/challenges/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition shadow-lg shadow-brand-600/20"
          >
            <PlusCircle className="h-4 w-4" />
            New Challenge
          </Link>
        )}
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-5">
        {filters.map((filter) => (
          <Link
            key={filter.key}
            href={`/challenges${filter.key !== 'all' ? `?status=${filter.key}` : ''}`}
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

      {/* Challenges Grid */}
      {challenges.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-16 text-center">
          <Gamepad2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {statusFilter === 'all' ? 'No challenges yet' : `No ${statusFilter} challenges`}
          </h3>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto text-sm">
            {statusFilter === 'all'
              ? 'Create your first AI-powered challenge video.'
              : `No challenges with "${statusFilter}" status.`}
          </p>
          {statusFilter === 'all' && !isAdmin && (
            <Link
              href="/challenges/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <PlusCircle className="h-4 w-4" />
              Create First Challenge
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {challenges.map((challenge) => {
              const typeColor = CHALLENGE_TYPE_COLORS[challenge.challengeType] || '#6366F1'
              const diffColor = getDifficultyColor(challenge.difficulty)

              return (
                <Link
                  key={challenge.id}
                  href={`/challenges/${challenge.id}`}
                  className="group relative rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden hover:border-brand-500/40 hover:bg-white/[0.06] transition-all"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[16/10] bg-gray-900 flex items-center justify-center">
                    {challenge.status === 'COMPLETED' && challenge.outputUrl ? (
                      <>
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center">
                          <span className="text-4xl">{CHALLENGE_TYPE_EMOJIS[challenge.challengeType] || '🎮'}</span>
                        </div>
                        {/* Play overlay on hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Play className="h-8 w-8 text-white/80" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-4xl">{CHALLENGE_TYPE_EMOJIS[challenge.challengeType] || '🎮'}</span>
                        {challenge.status !== 'COMPLETED' && challenge.status !== 'FAILED' && (
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 text-brand-400 animate-spin" />
                            <span className="text-[11px] text-brand-400">{getJobStatusLabel(challenge.status)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Type badge */}
                    <div className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-gray-300">
                      {CHALLENGE_TYPE_LABELS[challenge.challengeType]}
                    </div>
                    {/* Difficulty badge */}
                    <span
                      className="absolute top-1.5 right-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium capitalize"
                      style={{
                        backgroundColor: diffColor + '25',
                        color: diffColor,
                      }}
                    >
                      {challenge.difficulty}
                    </span>
                    {/* Bottom info */}
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-2 text-[11px] text-gray-300">
                      <span className="flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5">
                        <HelpCircle className="h-3 w-3" />
                        {challenge.numQuestions}Q
                      </span>
                      <span className="flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5">
                        <Timer className="h-3 w-3" />
                        {challenge.timerSeconds}s
                      </span>
                    </div>
                    {/* Status overlay for non-completed */}
                    {challenge.status === 'FAILED' && (
                      <div className="absolute bottom-1.5 right-1.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${getStatusBadgeClass(challenge.status)}`}
                        >
                          {getStatusIcon(challenge.status)}
                          Failed
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-3">
                    {/* Title + completed check */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-white truncate group-hover:text-brand-300 transition flex-1 capitalize">
                        {challenge.category} {CHALLENGE_TYPE_LABELS[challenge.challengeType]}
                      </h3>
                      {challenge.status === 'COMPLETED' && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* Meta row: type pill + difficulty + language */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: typeColor + '18',
                          color: typeColor,
                        }}
                      >
                        {CHALLENGE_TYPE_LABELS[challenge.challengeType]}
                      </span>
                      {challenge.language && (
                        <span className="text-[11px] text-gray-500 uppercase tracking-wide">
                          {challenge.language}
                        </span>
                      )}
                    </div>

                    {/* Footer: category + time */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.05]">
                      <span className="text-[11px] text-gray-500 capitalize truncate max-w-[60%]">
                        {challenge.category}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Clock className="h-3 w-3" />
                        {timeAgo(challenge.createdAt)}
                      </span>
                    </div>

                    {isAdmin && challenge.user && (
                      <AdminUserBadge
                        name={challenge.user.name || ''}
                        email={challenge.user.email || ''}
                      />
                    )}
                    {isAdmin && (
                      <div className="mt-2">
                        <AdminDeleteButton jobType="challenge" jobId={challenge.id} />
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            basePath="/challenges"
            searchParams={statusFilter !== 'all' ? { status: statusFilter } : {}}
          />
        </>
      )}
    </div>
  )
}
