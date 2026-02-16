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
  Calendar,
  Image as ImageIcon,
  Video,
} from 'lucide-react'
import { getJobStatusColor, getJobStatusLabel } from '@/lib/utils'

interface QuotesPageProps {
  searchParams: { status?: string; page?: string }
}

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
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
        'QUEUED', 'TEXT_GENERATING', 'IMAGE_GENERATING',
        'VOICE_GENERATING', 'COMPOSING', 'UPLOADING',
      ],
      failed: ['FAILED'],
    }
    const statuses = statusMap[statusFilter]
    if (statuses) {
      where.status = { in: statuses }
    }
  }

  const [quotes, total] = await Promise.all([
    prisma.quoteJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.quoteJob.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  // Status counts for filter badges
  const statusCounts = await prisma.quoteJob.groupBy({
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

  // Helper functions
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

  function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      motivational: '#F59E0B',
      love: '#EC4899',
      funny: '#F97316',
      wisdom: '#8B5CF6',
      success: '#10B981',
      life: '#22C55E',
      friendship: '#3B82F6',
      islamic: '#059669',
      shayari: '#E11D48',
      custom: '#6366F1',
    }
    return colors[category] || '#6366F1'
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
          <h1 className="text-3xl font-bold text-white tracking-tight">My Quotes</h1>
          <p className="text-sm text-gray-500 mt-2">
            {total} quote{total !== 1 ? 's' : ''} in your library
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition shadow-lg shadow-brand-600/20"
        >
          <PlusCircle className="h-4 w-4" />
          Create Quote
        </Link>
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 mb-6">
        {filters.map((filter) => (
          <Link
            key={filter.key}
            href={`/quotes${filter.key !== 'all' ? `?status=${filter.key}` : ''}`}
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

      {/* Quotes Grid */}
      {quotes.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-16 text-center">
          <Quote className="h-16 w-16 text-gray-600 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {statusFilter === 'all' ? 'No quotes yet' : `No ${statusFilter} quotes`}
          </h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            {statusFilter === 'all'
              ? 'Create your first AI-powered quote. Generate beautiful quote images and videos with just a topic.'
              : `You don't have any quotes with the "${statusFilter}" status.`}
          </p>
          {statusFilter === 'all' && (
            <Link
              href="/quotes/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <PlusCircle className="h-5 w-5" />
              Create Your First Quote
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {quotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/quotes/${quote.id}`}
                className="group rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-brand-500/50 hover:bg-white/[0.07] transition-all"
              >
                {/* Thumbnail / Preview */}
                <div className="relative aspect-square bg-gray-900 flex items-center justify-center overflow-hidden">
                  {quote.imageUrl ? (
                    <img
                      src={quote.imageUrl.startsWith('file://') ? `/api/quotes/${quote.id}/image` : quote.imageUrl}
                      alt="Quote"
                      className="w-full h-full object-cover"
                    />
                  ) : quote.quoteText ? (
                    // Show quote text as preview when no image yet
                    <div className="p-6 flex items-center justify-center h-full bg-gradient-to-br from-gray-800 to-gray-900">
                      <p className="text-sm text-gray-300 text-center line-clamp-4 italic">
                        &ldquo;{quote.quoteText}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <Quote className="h-10 w-10 text-gray-700" />
                  )}
                  {/* Category badge */}
                  <div
                    className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-xs text-white font-medium"
                    style={{ backgroundColor: getCategoryColor(quote.category) + '33' }}
                  >
                    <span style={{ color: getCategoryColor(quote.category) }}>
                      {quote.category}
                    </span>
                  </div>
                  {/* Media indicators */}
                  {quote.status === 'COMPLETED' && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                      {quote.imageUrl && (
                        <div className="rounded bg-black/70 p-1">
                          <ImageIcon className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {quote.videoUrl && (
                        <div className="rounded bg-black/70 p-1">
                          <Video className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4">
                  <p className="text-sm text-white line-clamp-2 group-hover:text-brand-300 transition">
                    {quote.quoteText || quote.prompt}
                  </p>
                  {quote.author && (
                    <p className="text-xs text-gray-500 mt-1">— {quote.author}</p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${getStatusBadgeClass(
                        quote.status
                      )}`}
                    >
                      {getStatusIcon(quote.status)}
                      {getJobStatusLabel(quote.status)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(quote.createdAt)}
                    </span>
                    <span>{quote.aspectRatio}</span>
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
                        {showEllipsis && (
                          <span className="px-2 text-gray-600">...</span>
                        )}
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
