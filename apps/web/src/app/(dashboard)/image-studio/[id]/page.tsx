import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  ImagePlus,
  Clock,
  Monitor,
  Mic,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  FileText,
  Zap,
  Images,
  Film,
  Sparkles,
  Languages,
  Layers,
  CreditCard,
} from 'lucide-react'
import { PublishDialog } from '@/components/publish/publish-dialog'
import { getJobStatusLabel, getJobStatusColor } from '@/lib/utils'
import { DeleteImageStudioButton } from './delete-button'
import { RetryButton } from './retry-button'
import { AutoRefresh } from './auto-refresh'
import { CopyHashtags } from '@/components/copy-hashtags'

interface ImageStudioDetailPageProps {
  params: { id: string }
}

export default async function ImageStudioDetailPage({ params }: ImageStudioDetailPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const job = await prisma.imageStudioJob.findUnique({
    where: { id: params.id },
  })

  const isAdmin = session.user.role === 'ADMIN'
  if (!job || (!isAdmin && job.userId !== session.user.id)) {
    redirect('/image-studio')
  }

  const isCompleted = job.status === 'COMPLETED'
  const isFailed = job.status === 'FAILED'
  const isProcessing = !isCompleted && !isFailed
  const isVideoMode = job.mode === 'video'

  // Use API endpoint for local file:// URLs
  const outputUrl = job.outputUrl?.startsWith('file://')
    ? `/api/image-studio/${job.id}/output`
    : job.outputUrl

  const rawImageUrls = Array.isArray(job.imageUrls) ? (job.imageUrls as string[]) : []
  // Convert file:// URLs to API-served URLs
  const imageUrls = rawImageUrls.map((url, idx) =>
    url.startsWith('file://')
      ? `/api/image-studio/${job.id}/images?index=${idx}`
      : url
  )

  // Define pipeline stages based on mode
  const videoStages = [
    { key: 'QUEUED', label: 'Queued', icon: Clock },
    { key: 'ANALYZING', label: 'Analyzing Images', icon: Images },
    { key: 'SCRIPT_GENERATING', label: 'Script Generation', icon: FileText },
    { key: 'VOICE_GENERATING', label: 'Voice Generation', icon: Mic },
    { key: 'COMPOSING', label: 'Composing Video', icon: Film },
    { key: 'UPLOADING', label: 'Uploading', icon: Monitor },
    { key: 'COMPLETED', label: 'Completed', icon: CheckCircle2 },
  ]

  const enhanceStages = [
    { key: 'QUEUED', label: 'Queued', icon: Clock },
    { key: 'ANALYZING', label: 'Analyzing Images', icon: Images },
    { key: 'COMPOSING', label: 'Enhancing', icon: Sparkles },
    { key: 'UPLOADING', label: 'Uploading', icon: Monitor },
    { key: 'COMPLETED', label: 'Completed', icon: CheckCircle2 },
  ]

  const stages = isVideoMode ? videoStages : enhanceStages
  const stageOrder = stages.map((s) => s.key)

  // Map the actual status to the closest stage in this mode's pipeline
  const currentIndex = (() => {
    const directIdx = stageOrder.indexOf(job.status)
    if (directIdx !== -1) return directIdx
    // If the status is not in this mode's stages, find the closest one
    const allStatuses = ['QUEUED', 'ANALYZING', 'SCRIPT_GENERATING', 'VOICE_GENERATING', 'COMPOSING', 'UPLOADING', 'COMPLETED']
    const actualIdx = allStatuses.indexOf(job.status)
    // Find the highest stage index that's at or before the actual status
    let best = 0
    for (let i = 0; i < stageOrder.length; i++) {
      if (allStatuses.indexOf(stageOrder[i]) <= actualIdx) best = i
    }
    return best
  })()

  function getStageStatus(stageKey: string) {
    if (isFailed) {
      const stageIndex = stageOrder.indexOf(stageKey)
      if (stageIndex < currentIndex) return 'completed'
      if (stageIndex === currentIndex) return 'failed'
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

  return (
    <div>
      <AutoRefresh enabled={isProcessing} />

      {/* Back navigation */}
      <Link
        href="/image-studio"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-3"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Image Studio
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white tracking-tight truncate">
            {job.title || 'Untitled'}
          </h1>
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
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
              {isVideoMode ? <Film className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isVideoMode ? 'Video' : 'Enhance'}
            </span>
            <span className="text-sm text-gray-500">
              Created {formatDateTime(job.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          {isCompleted && outputUrl && (
            <>
              <PublishDialog
                jobType="image_studio"
                jobId={job.id}
                videoUrl={outputUrl}
                thumbnailUrl={job.thumbnailUrl}
                defaultTitle={job.title || undefined}
              />
              <a
                href={outputUrl}
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
          {isFailed && <RetryButton jobId={job.id} />}
          <DeleteImageStudioButton jobId={job.id} isProcessing={isProcessing} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Output Preview */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            {isCompleted && outputUrl ? (
              isVideoMode ? (
                <div className="aspect-video bg-black">
                  <video
                    src={outputUrl}
                    controls
                    className="w-full h-full"
                    poster={job.thumbnailUrl || undefined}
                  />
                </div>
              ) : (
                <div className="aspect-video bg-black flex items-center justify-center">
                  <img
                    src={outputUrl}
                    alt={job.title || 'Enhanced image'}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )
            ) : (
              <div className="aspect-video bg-gray-900 flex flex-col items-center justify-center">
                {isFailed ? (
                  <>
                    <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
                    <p className="text-red-400 font-medium">Generation Failed</p>
                    {job.errorMessage && (
                      <p className="text-sm text-red-400/70 mt-2 max-w-md text-center">
                        {job.errorMessage}
                      </p>
                    )}
                    <div className="mt-4">
                      <RetryButton jobId={job.id} />
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-12 w-12 text-brand-400 animate-spin mb-4" />
                    <p className="text-gray-400 font-medium">
                      {getJobStatusLabel(job.status)}...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      This may take a few minutes
                    </p>
                    {job.progress > 0 && (
                      <div className="mt-4 w-48">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all duration-500"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-1">{job.progress}%</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Uploaded Images */}
          {imageUrls.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Images className="h-5 w-5 text-brand-400" />
                Uploaded Images ({imageUrls.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {imageUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-gray-900"
                  >
                    <img
                      src={url}
                      alt={`Image ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Script */}
          {job.script && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-400" />
                Generated Script
              </h2>
              <div className="bg-black/30 rounded-lg p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
                {job.script}
              </div>
            </div>
          )}

          {/* Prompt */}
          {job.prompt && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                Prompt
              </h2>
              <p className="text-sm text-gray-300 leading-relaxed">{job.prompt}</p>
            </div>
          )}

          {/* Hashtags */}
          {job.hashtags && <CopyHashtags hashtags={job.hashtags} />}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Timeline */}
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

          {/* Metadata */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
            <dl className="space-y-4">
              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  {isVideoMode ? <Film className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  Mode
                </dt>
                <dd className="text-sm text-white capitalize">{job.mode}</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Images className="h-4 w-4" />
                  Images
                </dt>
                <dd className="text-sm text-white">{job.imageCount}</dd>
              </div>

              {job.language && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <Languages className="h-4 w-4" />
                    Language
                  </dt>
                  <dd className="text-sm text-white uppercase">{job.language}</dd>
                </div>
              )}

              {isVideoMode && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <Mic className="h-4 w-4" />
                    Voice
                  </dt>
                  <dd className="text-sm text-white">
                    {job.voiceEnabled ? (job.voiceId || 'Enabled') : 'Disabled'}
                  </dd>
                </div>
              )}

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Monitor className="h-4 w-4" />
                  Aspect Ratio
                </dt>
                <dd className="text-sm text-white">{job.aspectRatio}</dd>
              </div>

              {isVideoMode && job.transitionStyle && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <Layers className="h-4 w-4" />
                    Transition
                  </dt>
                  <dd className="text-sm text-white capitalize">{job.transitionStyle}</dd>
                </div>
              )}

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <CreditCard className="h-4 w-4" />
                  Credits
                </dt>
                <dd className="text-sm text-white">{job.creditsCost}</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Calendar className="h-4 w-4" />
                  Created
                </dt>
                <dd className="text-sm text-white">{formatDateTime(job.createdAt)}</dd>
              </div>

              {job.completedAt && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed
                  </dt>
                  <dd className="text-sm text-white">{formatDateTime(job.completedAt)}</dd>
                </div>
              )}

              {job.processingTimeMs && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <Zap className="h-4 w-4" />
                    Proc. Time
                  </dt>
                  <dd className="text-sm text-white">
                    {(job.processingTimeMs / 1000).toFixed(1)}s
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
