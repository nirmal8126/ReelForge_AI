import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Quote,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Zap,
  RefreshCw,
  Download,
  Clock,
  FileText,
  Image,
  Upload,
} from 'lucide-react'
import { getJobStatusLabel, getJobStatusColor } from '@/lib/utils'
import { QUOTE_CATEGORIES } from '@/lib/constants'
import { DeleteQuoteButton } from './delete-button'
import { AutoRefresh } from './auto-refresh'
import { RetryButton } from './retry-button'
import { CopyButton } from './copy-button'
import { PublishQuoteButton } from './publish-quote-button'
import { CopyHashtags } from '@/components/copy-hashtags'

interface QuoteDetailPageProps {
  params: { id: string }
}

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const quote = await prisma.quoteJob.findUnique({
    where: { id: params.id },
  })

  const isAdmin = session.user.role === 'ADMIN'
  if (!quote || (!isAdmin && quote.userId !== session.user.id)) {
    redirect('/quotes')
  }

  const isCompleted = quote.status === 'COMPLETED'
  const isFailed = quote.status === 'FAILED'
  const isProcessing = !isCompleted && !isFailed

  // Parse variations
  let variations: Array<{ quote: string; author: string }> = []
  if (quote.quoteVariations) {
    try {
      const parsed = JSON.parse(quote.quoteVariations)
      if (Array.isArray(parsed)) variations = parsed
    } catch { /* ignore */ }
  }

  function formatDateTime(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(date))
  }

  function getCategoryColor(category: string): string {
    return QUOTE_CATEGORIES.find((c) => c.id === category)?.color || '#6366F1'
  }

  // Pipeline stages
  const stages = [
    { key: 'QUEUED', label: 'Queued', icon: Clock },
    { key: 'TEXT_GENERATING', label: 'Text Generation', icon: FileText },
    { key: 'IMAGE_GENERATING', label: 'Image Generation', icon: Image },
    { key: 'UPLOADING', label: 'Uploading', icon: Upload },
    { key: 'COMPLETED', label: 'Completed', icon: CheckCircle2 },
  ]

  const stageOrder = stages.map((s) => s.key)
  const currentIndex = stageOrder.indexOf(quote.status)

  function getStageStatus(stageKey: string) {
    if (isFailed) {
      const failedIndex = stageOrder.indexOf(stageKey)
      if (failedIndex < currentIndex) return 'completed'
      if (failedIndex === currentIndex) return 'failed'
      return 'pending'
    }
    if (isCompleted) return 'completed'
    const stageIndex = stageOrder.indexOf(stageKey)
    if (stageIndex < currentIndex) return 'completed'
    if (stageIndex === currentIndex) return 'active'
    return 'pending'
  }

  return (
    <div>
      <AutoRefresh enabled={isProcessing} />

      {/* Back navigation */}
      <Link
        href="/quotes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-3"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Quotes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {quote.quoteText
                ? `\u201C${quote.quoteText.substring(0, 60)}${quote.quoteText.length > 60 ? '...' : ''}\u201D`
                : 'Quote Generation'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded"
              style={{
                backgroundColor: getCategoryColor(quote.category) + '20',
                color: getCategoryColor(quote.category),
              }}
            >
              {quote.category}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${getJobStatusColor(
                quote.status
              )}`}
            >
              {isCompleted && <CheckCircle2 className="h-4 w-4" />}
              {isFailed && <XCircle className="h-4 w-4" />}
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {getJobStatusLabel(quote.status)}
            </span>
            <span className="text-sm text-gray-500">
              Created {formatDateTime(quote.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          {isCompleted && (quote.imageUrl || quote.videoUrl) && (
            <a
              href={quote.videoUrl || quote.imageUrl!}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 transition"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          )}
          {isFailed && <RetryButton quoteId={quote.id} />}
          <DeleteQuoteButton quoteId={quote.id} isProcessing={isProcessing} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Processing / Failed state */}
          {!isCompleted && (
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="aspect-video bg-gray-900 flex flex-col items-center justify-center">
                {isFailed ? (
                  <>
                    <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
                    <p className="text-red-400 font-medium">Generation Failed</p>
                    {quote.errorMessage && (
                      <p className="text-sm text-red-400/70 mt-2 max-w-md text-center">
                        {quote.errorMessage}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Loader2 className="h-12 w-12 text-brand-400 animate-spin mb-4" />
                    <p className="text-gray-400 font-medium">
                      {getJobStatusLabel(quote.status)}...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      This usually takes less than a minute
                    </p>
                    {quote.progress > 0 && (
                      <div className="mt-4 w-48">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all"
                            style={{ width: `${quote.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-1">
                          {quote.progress}%
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Quote Variations with Copy */}
          {variations.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-brand-400" />
                Quote Variations
                <span className="text-xs text-gray-500 font-normal ml-1">
                  ({variations.length} generated)
                </span>
              </h2>
              <div className="space-y-3">
                {variations.map((variation, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg p-4 border border-white/[0.06] bg-black/20 hover:border-white/10 transition"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-gray-400">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 italic leading-relaxed">
                          &ldquo;{variation.quote}&rdquo;
                        </p>
                        {variation.author && (
                          <p className="text-xs text-gray-500 mt-1.5">
                            &mdash; {variation.author}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isCompleted && (
                          <PublishQuoteButton
                            jobId={quote.id}
                            quoteText={`"${variation.quote}" — ${variation.author || 'Unknown'}`}
                            videoUrl={quote.videoUrl || quote.imageUrl}
                            thumbnailUrl={quote.thumbnailUrl}
                          />
                        )}
                        <CopyButton text={`"${variation.quote}" — ${variation.author || 'Unknown'}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hashtags */}
          {quote.hashtags && <CopyHashtags hashtags={quote.hashtags} />}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Generation Pipeline */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Generation Pipeline</h2>
            <div className="space-y-0">
              {stages.map((stage, idx) => {
                const status = getStageStatus(stage.key)
                const Icon = stage.icon
                const isLast = idx === stages.length - 1

                return (
                  <div key={stage.key} className="relative flex gap-3">
                    {!isLast && (
                      <div
                        className={`absolute left-[15px] top-[30px] w-0.5 h-[calc(100%-6px)] ${
                          status === 'completed'
                            ? 'bg-green-500'
                            : status === 'active'
                            ? 'bg-brand-500'
                            : status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-white/10'
                        }`}
                      />
                    )}
                    <div
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
                        status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : status === 'active'
                          ? 'bg-brand-500/20 text-brand-400'
                          : status === 'failed'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-white/5 text-gray-600'
                      }`}
                    >
                      {status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : status === 'failed' ? (
                        <XCircle className="h-4 w-4" />
                      ) : status === 'active' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="pb-6">
                      <p
                        className={`text-sm font-medium ${
                          status === 'completed'
                            ? 'text-green-400'
                            : status === 'active'
                            ? 'text-brand-400'
                            : status === 'failed'
                            ? 'text-red-400'
                            : 'text-gray-600'
                        }`}
                      >
                        {stage.label}
                      </p>
                      {status === 'active' && (
                        <p className="text-xs text-gray-500 mt-0.5">In progress...</p>
                      )}
                      {status === 'failed' && (
                        <p className="text-xs text-red-400/70 mt-0.5">Error occurred</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Details */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
            <dl className="space-y-4">
              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Quote className="h-4 w-4" />
                  Category
                </dt>
                <dd className="text-sm text-white capitalize">{quote.category}</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Calendar className="h-4 w-4" />
                  Created
                </dt>
                <dd className="text-sm text-white">{formatDateTime(quote.createdAt)}</dd>
              </div>

              {quote.completedAt && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed
                  </dt>
                  <dd className="text-sm text-white">{formatDateTime(quote.completedAt)}</dd>
                </div>
              )}

              {quote.processingTimeMs && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <Zap className="h-4 w-4" />
                    Proc. Time
                  </dt>
                  <dd className="text-sm text-white">
                    {(quote.processingTimeMs / 1000).toFixed(1)}s
                  </dd>
                </div>
              )}

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Zap className="h-4 w-4" />
                  Cost
                </dt>
                <dd className={`text-sm font-medium ${quote.creditsCost === 0 ? 'text-green-400' : 'text-white'}`}>{quote.creditsCost === 0 ? 'Free' : `${quote.creditsCost} credit`}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
