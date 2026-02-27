import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Quote,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react'
import { getJobStatusLabel } from '@/lib/utils'
import { AdminUserBadge } from '@/components/admin-user-badge'
import { AdminDeleteButton } from '@/components/admin-delete-button'
import { QUOTE_CATEGORIES } from '@/lib/constants'

interface QuotesPageProps {
  searchParams: { status?: string; page?: string }
}

const CATEGORY_COLOR_MAP: Record<string, string> = Object.fromEntries(
  QUOTE_CATEGORIES.map((c) => [c.id, c.color])
)

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
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
      processing: ['QUEUED', 'TEXT_GENERATING'],
      failed: ['FAILED'],
    }
    const statuses = statusMap[statusFilter]
    if (statuses) {
      where.status = { in: statuses }
    }
  }

  const userWhere = isAdmin ? {} : { userId: session.user.id }

  const [quotes, total, statusCounts] = await Promise.all([
    prisma.quoteJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: isAdmin ? { select: { id: true, name: true, email: true } } : false },
    }),
    prisma.quoteJob.count({ where }),
    prisma.quoteJob.groupBy({
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

  function getCatLabel(id: string) {
    return QUOTE_CATEGORIES.find((c) => c.id === id)?.name || id
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-5 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{isAdmin ? 'All Quotes' : 'My Quotes'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} quote{total !== 1 ? 's' : ''} generated
          </p>
        </div>
        {!isAdmin && (
          <Link
            href="/quotes/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition shadow-lg shadow-brand-600/20"
          >
            <PlusCircle className="h-4 w-4" />
            New Quote
          </Link>
        )}
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-5">
        {filters.map((filter) => (
          <Link
            key={filter.key}
            href={`/quotes${filter.key !== 'all' ? `?status=${filter.key}` : ''}`}
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

      {/* Quotes List */}
      {quotes.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-16 text-center">
          <Quote className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {statusFilter === 'all' ? 'No quotes yet' : `No ${statusFilter} quotes`}
          </h3>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto text-sm">
            {statusFilter === 'all'
              ? 'Create your first AI-powered quote with just a topic.'
              : `No quotes with "${statusFilter}" status.`}
          </p>
          {statusFilter === 'all' && !isAdmin && (
            <Link
              href="/quotes/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <PlusCircle className="h-4 w-4" />
              Create First Quote
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {quotes.map((quote) => {
              const catColor = CATEGORY_COLOR_MAP[quote.category] || '#6366F1'

              return (
                <Link
                  key={quote.id}
                  href={`/quotes/${quote.id}`}
                  className="group relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 hover:border-brand-500/40 hover:bg-white/[0.06] transition-all"
                >
                  {/* Category accent bar */}
                  <div
                    className="absolute top-0 left-4 right-4 h-[2px] rounded-b"
                    style={{ backgroundColor: catColor }}
                  />

                  {/* Top row: category + status + time */}
                  <div className="flex items-center justify-between mb-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: catColor + '18',
                        color: catColor,
                      }}
                    >
                      {getCatLabel(quote.category)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${getStatusBadgeClass(quote.status)}`}
                      >
                        {getStatusIcon(quote.status)}
                        {getJobStatusLabel(quote.status)}
                      </span>
                    </div>
                  </div>

                  {/* Quote text */}
                  {quote.quoteText ? (
                    <p className="text-sm text-gray-200 leading-relaxed line-clamp-3 group-hover:text-white transition">
                      &ldquo;{quote.quoteText}&rdquo;
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 line-clamp-2">{quote.prompt}</p>
                  )}

                  {/* Author */}
                  {quote.author && (
                    <p className="text-xs text-gray-500 mt-1.5">&mdash; {quote.author}</p>
                  )}

                  {/* Footer: time + language */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/[0.05]">
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Clock className="h-3 w-3" />
                      {timeAgo(quote.createdAt)}
                    </span>
                    <span className="text-[11px] text-gray-500 uppercase tracking-wide">
                      {quote.language}
                    </span>
                  </div>

                  {isAdmin && quote.user && (
                    <AdminUserBadge
                      name={quote.user.name || ''}
                      email={quote.user.email || ''}
                    />
                  )}
                  {isAdmin && (
                    <div className="mt-2">
                      <AdminDeleteButton jobType="quote" jobId={quote.id} />
                    </div>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={`/quotes?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${page - 1}`}
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
                          href={`/quotes?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${p}`}
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
                  href={`/quotes?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}page=${page + 1}`}
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
