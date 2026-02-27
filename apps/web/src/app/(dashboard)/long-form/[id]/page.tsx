import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  Trash2,
  Video,
  Clock,
  Monitor,
  Mic,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Zap,
  Youtube,
  Calendar,
  Film,
  Layout,
  Pencil,
} from 'lucide-react'
import { PublishDialog } from '@/components/publish/publish-dialog'
import { getJobStatusLabel, getJobStatusColor } from '@/lib/utils'
import { RetryButton } from './retry-button'

interface LongFormDetailPageProps {
  params: { id: string }
}

export default async function LongFormDetailPage({ params }: LongFormDetailPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const job = await prisma.longFormJob.findUnique({
    where: { id: params.id },
    include: {
      channelProfile: {
        select: { id: true, name: true, niche: true },
      },
      segments: {
        orderBy: { segmentIndex: 'asc' },
      },
      youtubeMetadata: true,
    },
  })

  const isAdmin = session.user.role === 'ADMIN'
  if (!job || (!isAdmin && job.userId !== session.user.id)) {
    redirect('/long-form')
  }

  const isCompleted = job.status === 'COMPLETED'
  const isFailed = job.status === 'FAILED'
  const isRecomposing = job.status === 'RECOMPOSING'
  const isProcessing = !isCompleted && !isFailed

  // Define the pipeline stages for the status timeline
  const stages = [
    { key: 'QUEUED', label: 'Queued', icon: Clock },
    { key: 'PLANNING', label: 'Planning', icon: Layout },
    { key: 'SCRIPT_GENERATING', label: 'Script Generation', icon: FileText },
    { key: 'VOICE_GENERATING', label: 'Voice Generation', icon: Mic },
    { key: 'VIDEO_GENERATING', label: 'Video Generation', icon: Film },
    { key: 'COMPOSING', label: 'Composing', icon: Zap },
    { key: 'UPLOADING', label: 'Uploading', icon: Monitor },
    { key: 'PUBLISHING', label: 'Publishing', icon: Youtube },
    { key: 'COMPLETED', label: 'Completed', icon: CheckCircle2 },
  ]

  const stageOrder = stages.map((s) => s.key)
  const currentIndex = stageOrder.indexOf(job.status)

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

  function getSegmentStatusIcon(status: string) {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-400" />
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  function getSegmentVisualTypeLabel(type: string) {
    switch (type) {
      case 'AI_CLIP':
        return 'AI Clip'
      case 'STOCK_VIDEO':
        return 'Stock Footage'
      case 'STATIC_IMAGE':
        return 'Static Image'
      default:
        return 'Pending'
    }
  }

  return (
    <div>
      {/* Auto-refresh for processing jobs */}
      {isProcessing && (
        <meta httpEquiv="refresh" content="5" />
      )}

      {/* Back navigation */}
      <Link
        href="/long-form"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-3"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Long-Form Videos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white tracking-tight truncate">{job.title}</h1>
          <div className="flex items-center gap-4 mt-1">
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${getJobStatusColor(
                job.status
              )}`}
            >
              {isCompleted && <CheckCircle2 className="h-4 w-4" />}
              {isFailed && <XCircle className="h-4 w-4" />}
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {getJobStatusLabel(job.status)}
            </span>
            <span className="text-sm text-gray-500">
              Created {formatDateTime(job.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          {isCompleted && (
            <Link
              href={`/long-form/${job.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <Pencil className="h-4 w-4" />
              Edit Video
            </Link>
          )}
          {isCompleted && job.outputUrl && (
            <>
              <PublishDialog
                jobType="long_form"
                jobId={job.id}
                videoUrl={job.outputUrl}
                defaultTitle={job.title}
              />
              <a
                href={job.outputUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 transition"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            </>
          )}
          {job.youtubeVideoId && (
            <a
              href={`https://youtube.com/watch?v=${job.youtubeVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition"
            >
              <Youtube className="h-4 w-4" />
              View on YouTube
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Preview */}
          {isCompleted && job.outputUrl && (
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <video
                controls
                className="w-full aspect-video bg-black"
                src={job.outputUrl}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />
                <h3 className="text-lg font-semibold text-white">Processing...</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Overall Progress</span>
                  <span className="text-white font-medium">{job.progress}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 transition-all duration-500"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-4">
                This page will auto-refresh every 5 seconds while processing.
              </p>
            </div>
          )}

          {/* Failed State */}
          {isFailed && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-400" />
                  <h3 className="text-lg font-semibold text-white">Job Failed</h3>
                </div>
                <RetryButton jobId={job.id} />
              </div>
              {job.errorMessage && (
                <p className="text-sm text-gray-400 bg-black/30 rounded-lg p-3 font-mono">
                  {job.errorMessage}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-3">
                Retry will resume from the last completed stage — no credits wasted on work already done.
              </p>
            </div>
          )}

          {/* Pipeline Status */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Pipeline Status</h3>
            <div className="space-y-3">
              {stages.map((stage) => {
                const status = getStageStatus(stage.key)
                const StageIcon = stage.icon
                return (
                  <div
                    key={stage.key}
                    className={`flex items-center gap-3 rounded-lg p-3 transition ${
                      status === 'active'
                        ? 'bg-yellow-500/10 border border-yellow-500/20'
                        : status === 'completed'
                        ? 'bg-green-500/10 border border-green-500/20'
                        : status === 'failed'
                        ? 'bg-red-500/10 border border-red-500/20'
                        : 'bg-white/5 border border-transparent'
                    }`}
                  >
                    <StageIcon
                      className={`h-5 w-5 flex-shrink-0 ${
                        status === 'active'
                          ? 'text-yellow-400 animate-pulse'
                          : status === 'completed'
                          ? 'text-green-400'
                          : status === 'failed'
                          ? 'text-red-400'
                          : 'text-gray-600'
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        status === 'active' || status === 'completed'
                          ? 'text-white'
                          : 'text-gray-500'
                      }`}
                    >
                      {stage.label}
                    </span>
                    {status === 'active' && (
                      <Loader2 className="h-4 w-4 text-yellow-400 animate-spin ml-auto" />
                    )}
                    {status === 'completed' && (
                      <CheckCircle2 className="h-4 w-4 text-green-400 ml-auto" />
                    )}
                    {status === 'failed' && (
                      <XCircle className="h-4 w-4 text-red-400 ml-auto" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Segments */}
          {job.segments.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Segments ({job.segments.length})
              </h3>
              <div className="space-y-2">
                {job.segments.map((segment, idx) => (
                  <div
                    key={segment.id}
                    className="flex items-center gap-3 rounded-lg bg-white/5 p-3"
                  >
                    <span className="text-sm font-medium text-gray-400 w-8">
                      #{idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {segment.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {(segment.visualType as string) !== 'PENDING' && getSegmentVisualTypeLabel(segment.visualType)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getSegmentStatusIcon(segment.status)}
                      <span className="text-xs text-gray-500 w-20 text-right">
                        {Math.floor(segment.endTime - segment.startTime)}s
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Script */}
          {job.script && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Script</h3>
              <div className="bg-black/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                  {job.script}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Job Details */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Details</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Duration</dt>
                <dd className="text-white mt-1 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {job.durationMinutes} minutes
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Aspect Ratio</dt>
                <dd className="text-white mt-1 flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  {job.aspectRatio}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">AI Clip Ratio</dt>
                <dd className="text-white mt-1 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  {Math.round((job.aiClipRatio || 0.3) * 100)}%
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Language</dt>
                <dd className="text-white mt-1">{job.language}</dd>
              </div>
              {job.style && (
                <div>
                  <dt className="text-gray-500">Style</dt>
                  <dd className="text-white mt-1 capitalize">{job.style}</dd>
                </div>
              )}
              {job.channelProfile && (
                <div>
                  <dt className="text-gray-500">Channel Profile</dt>
                  <dd className="text-white mt-1">
                    <Link
                      href="/profiles"
                      className="text-brand-400 hover:text-brand-300 transition"
                    >
                      {job.channelProfile.name}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Cost Info */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Cost</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Credits Used</dt>
                <dd className="text-white mt-1 text-lg font-semibold">
                  {job.creditsCost} credits
                </dd>
              </div>
              {job.estimatedCostCents && (
                <div>
                  <dt className="text-gray-500">Estimated API Cost</dt>
                  <dd className="text-gray-400 mt-1">
                    ${(job.estimatedCostCents / 100).toFixed(2)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Processing Time */}
          {job.processingTimeMs && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Performance</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Processing Time</dt>
                  <dd className="text-white mt-1">
                    {Math.round(job.processingTimeMs / 1000 / 60)} minutes
                  </dd>
                </div>
                {job.completedAt && (
                  <div>
                    <dt className="text-gray-500">Completed At</dt>
                    <dd className="text-white mt-1">
                      {formatDateTime(job.completedAt)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
