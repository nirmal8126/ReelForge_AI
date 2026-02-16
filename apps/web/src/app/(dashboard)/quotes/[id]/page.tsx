import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  Quote,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Zap,
  Image as ImageIcon,
  Video,
  Mic,
  Palette,
  Type,
  Monitor,
  RefreshCw,
} from 'lucide-react'
import { getJobStatusLabel, getJobStatusColor } from '@/lib/utils'
import { DeleteQuoteButton } from './delete-button'
import { AutoRefresh } from './auto-refresh'
import { RetryButton } from './retry-button'

interface QuoteDetailPageProps {
  params: { id: string }
}

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const quote = await prisma.quoteJob.findUnique({
    where: { id: params.id },
  })

  if (!quote || quote.userId !== session.user.id) {
    redirect('/quotes')
  }

  const isCompleted = quote.status === 'COMPLETED'
  const isFailed = quote.status === 'FAILED'
  const isProcessing = !isCompleted && !isFailed

  // Use API endpoints for local file:// URLs
  const imageUrl = quote.imageUrl?.startsWith('file://')
    ? `/api/quotes/${quote.id}/image`
    : quote.imageUrl

  const videoUrl = quote.videoUrl?.startsWith('file://')
    ? `/api/quotes/${quote.id}/video`
    : quote.videoUrl

  // Pipeline stages for quote generation
  const stages = [
    { key: 'QUEUED', label: 'Queued', icon: Clock },
    { key: 'TEXT_GENERATING', label: 'Generating Quote', icon: Quote },
    { key: 'IMAGE_GENERATING', label: 'Creating Background', icon: ImageIcon },
    { key: 'VOICE_GENERATING', label: 'Recording Voice', icon: Mic },
    { key: 'COMPOSING', label: 'Composing', icon: Zap },
    { key: 'UPLOADING', label: 'Uploading', icon: Monitor },
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

  return (
    <div>
      <AutoRefresh enabled={isProcessing} />

      {/* Back navigation */}
      <Link
        href="/quotes"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Quotes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-white/[0.06]">
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
          {isFailed && <RetryButton quoteId={quote.id} />}
          <DeleteQuoteButton quoteId={quote.id} isProcessing={isProcessing} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content - 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image + Video Preview */}
          {isCompleted ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Image Preview */}
              {imageUrl && (
                <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="relative aspect-square bg-black">
                    <img
                      src={imageUrl}
                      alt="Quote"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" /> Image (PNG)
                    </span>
                    <a
                      href={imageUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400 hover:text-green-300 transition"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  </div>
                </div>
              )}

              {/* Video Preview */}
              {videoUrl && (
                <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="relative aspect-square bg-black">
                    <video
                      src={videoUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Video className="h-3.5 w-3.5" /> Video (MP4)
                    </span>
                    <a
                      href={videoUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400 hover:text-green-300 transition"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
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

          {/* Quote Text */}
          {quote.quoteText && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Quote className="h-5 w-5 text-brand-400" />
                Generated Quote
              </h2>
              <blockquote className="bg-black/30 rounded-lg p-5">
                <p className="text-lg text-gray-200 italic leading-relaxed">
                  &ldquo;{quote.quoteText}&rdquo;
                </p>
                {quote.author && (
                  <footer className="mt-3 text-sm text-gray-400">
                    &mdash; {quote.author}
                  </footer>
                )}
              </blockquote>
            </div>
          )}

          {/* Prompt */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Prompt
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed">{quote.prompt}</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Pipeline */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Generation Pipeline</h2>
            <div className="space-y-0">
              {stages.map((stage, idx) => {
                const status = getStageStatus(stage.key)
                const Icon = stage.icon
                const isLast = idx === stages.length - 1

                return (
                  <div key={stage.key} className="relative flex gap-3">
                    {/* Connector line */}
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

                    {/* Icon */}
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

                    {/* Label */}
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
                  <Type className="h-4 w-4" />
                  Font
                </dt>
                <dd className="text-sm text-white capitalize">{quote.fontStyle}</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Palette className="h-4 w-4" />
                  Background
                </dt>
                <dd className="text-sm text-white capitalize">{quote.bgType}</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Monitor className="h-4 w-4" />
                  Aspect Ratio
                </dt>
                <dd className="text-sm text-white">{quote.aspectRatio}</dd>
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
                <dd className="text-sm text-white">{quote.creditsCost} credit</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
