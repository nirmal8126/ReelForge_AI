import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  Trash2,
  Film,
  Clock,
  Monitor,
  Mic,
  Palette,
  User,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  FileText,
  Zap,
} from 'lucide-react'
import { PublishDialog } from '@/components/publish/publish-dialog'
import { getJobStatusLabel, getJobStatusColor } from '@/lib/utils'
import { DeleteReelButton } from './delete-button'
import { RetryButton } from './retry-button'
import { AutoRefresh } from './auto-refresh'

interface ReelDetailPageProps {
  params: { id: string }
}

export default async function ReelDetailPage({ params }: ReelDetailPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const reel = await prisma.reelJob.findUnique({
    where: { id: params.id },
    include: {
      channelProfile: {
        select: { id: true, name: true, niche: true, platform: true },
      },
    },
  })

  const isAdmin = session.user.role === 'ADMIN'
  if (!reel || (!isAdmin && reel.userId !== session.user.id)) {
    redirect('/reels')
  }

  const isCompleted = reel.status === 'COMPLETED'
  const isFailed = reel.status === 'FAILED'
  const isProcessing = !isCompleted && !isFailed

  // Use API endpoint for local file:// URLs
  const videoUrl = reel.outputUrl?.startsWith('file://')
    ? `/api/reels/${reel.id}/video`
    : reel.outputUrl

  // Define the pipeline stages for the status timeline
  const stages = [
    { key: 'QUEUED', label: 'Queued', icon: Clock },
    { key: 'SCRIPT_GENERATING', label: 'Script Generation', icon: FileText },
    { key: 'VOICE_GENERATING', label: 'Voice Generation', icon: Mic },
    { key: 'VIDEO_GENERATING', label: 'Video Generation', icon: Film },
    { key: 'COMPOSING', label: 'Composing', icon: Zap },
    { key: 'UPLOADING', label: 'Uploading', icon: Monitor },
    { key: 'COMPLETED', label: 'Completed', icon: CheckCircle2 },
  ]

  const stageOrder = stages.map((s) => s.key)
  const currentIndex = stageOrder.indexOf(reel.status)

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

  return (
    <div>
      <AutoRefresh enabled={isProcessing} />

      {/* Back navigation */}
      <Link
        href="/reels"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Reels
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-white/[0.06]">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-white tracking-tight truncate">{reel.title}</h1>
          <div className="flex items-center gap-4 mt-2">
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${getJobStatusColor(
                reel.status
              )}`}
            >
              {isCompleted && <CheckCircle2 className="h-4 w-4" />}
              {isFailed && <XCircle className="h-4 w-4" />}
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {getJobStatusLabel(reel.status)}
            </span>
            <span className="text-sm text-gray-500">
              Created {formatDateTime(reel.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          {isCompleted && videoUrl && (
            <>
              <PublishDialog
                jobType="reel"
                jobId={reel.id}
                videoUrl={videoUrl}
                thumbnailUrl={reel.thumbnailUrl}
                defaultTitle={reel.title}
              />
              <a
                href={videoUrl}
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
          {isFailed && <RetryButton reelId={reel.id} />}
          <DeleteReelButton reelId={reel.id} isProcessing={isProcessing} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Preview */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            {isCompleted && videoUrl ? (
              <div className="aspect-video bg-black">
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full"
                  poster={reel.thumbnailUrl || undefined}
                />
              </div>
            ) : (
              <div className="aspect-video bg-gray-900 flex flex-col items-center justify-center">
                {isFailed ? (
                  <>
                    <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
                    <p className="text-red-400 font-medium">Generation Failed</p>
                    {reel.errorMessage && (
                      <p className="text-sm text-red-400/70 mt-2 max-w-md text-center">
                        {reel.errorMessage}
                      </p>
                    )}
                    <div className="mt-4">
                      <RetryButton reelId={reel.id} />
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-12 w-12 text-brand-400 animate-spin mb-4" />
                    <p className="text-gray-400 font-medium">
                      {getJobStatusLabel(reel.status)}...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      This may take a few minutes
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Script */}
          {reel.script && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-400" />
                Generated Script
              </h2>
              <div className="bg-black/30 rounded-lg p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
                {reel.script}
              </div>
            </div>
          )}

          {/* Prompt */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Prompt
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed">{reel.prompt}</p>
          </div>
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
                  <Clock className="h-4 w-4" />
                  Duration
                </dt>
                <dd className="text-sm text-white">{reel.durationSeconds}s</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Monitor className="h-4 w-4" />
                  Aspect Ratio
                </dt>
                <dd className="text-sm text-white">{reel.aspectRatio}</dd>
              </div>

              {reel.style && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <Palette className="h-4 w-4" />
                    Style
                  </dt>
                  <dd className="text-sm text-white capitalize">{reel.style}</dd>
                </div>
              )}

              {reel.voiceId && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <Mic className="h-4 w-4" />
                    Voice
                  </dt>
                  <dd className="text-sm text-white">{reel.voiceId}</dd>
                </div>
              )}

              {reel.channelProfile && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <User className="h-4 w-4" />
                    Profile
                  </dt>
                  <dd className="text-sm text-white">{reel.channelProfile.name}</dd>
                </div>
              )}

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Calendar className="h-4 w-4" />
                  Created
                </dt>
                <dd className="text-sm text-white">{formatDateTime(reel.createdAt)}</dd>
              </div>

              {reel.completedAt && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed
                  </dt>
                  <dd className="text-sm text-white">{formatDateTime(reel.completedAt)}</dd>
                </div>
              )}

              {reel.processingTimeMs && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <Zap className="h-4 w-4" />
                    Proc. Time
                  </dt>
                  <dd className="text-sm text-white">
                    {(reel.processingTimeMs / 1000).toFixed(1)}s
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
