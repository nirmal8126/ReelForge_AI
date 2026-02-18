import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Joystick,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Zap,
  Download,
  Clock,
  Monitor,
  Palette,
  Gauge,
  Music,
  Film,
} from 'lucide-react'
import { PublishDialog } from '@/components/publish/publish-dialog'
import { getJobStatusLabel, getJobStatusColor } from '@/lib/utils'
import { DeleteGameplayButton } from './delete-button'
import { AutoRefresh } from './auto-refresh'

interface GameplayDetailPageProps {
  params: { id: string }
}

const TEMPLATE_LABELS: Record<string, string> = {
  ENDLESS_RUNNER: 'Endless Runner',
  BALL_MAZE: 'Ball Maze',
  OBSTACLE_TOWER: 'Obstacle Tower',
  COLOR_SWITCH: 'Color Switch',
}

export default async function GameplayDetailPage({ params }: GameplayDetailPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const job = await prisma.gameplayJob.findUnique({
    where: { id: params.id },
  })

  const isAdmin = session.user.role === 'ADMIN'
  if (!job || (!isAdmin && job.userId !== session.user.id)) {
    redirect('/gameplay')
  }

  const isCompleted = job.status === 'COMPLETED'
  const isFailed = job.status === 'FAILED'
  const isProcessing = !isCompleted && !isFailed

  function formatDateTime(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(date))
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

  return (
    <div>
      <AutoRefresh enabled={isProcessing} intervalMs={3000} />

      {/* Back navigation */}
      <Link
        href="/gameplay"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Gameplay Videos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-white/[0.06]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {job.gameTitle || TEMPLATE_LABELS[job.template] || 'Gameplay Video'}
            </h1>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-white/10 text-gray-300">
              {TEMPLATE_LABELS[job.template]}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded capitalize"
              style={{
                backgroundColor: getDifficultyColor(job.difficulty) + '20',
                color: getDifficultyColor(job.difficulty),
              }}
            >
              {job.difficulty}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-white/10 text-gray-300 capitalize">
              {job.theme}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${getJobStatusColor(job.status)}`}
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
          <DeleteGameplayButton jobId={job.id} isProcessing={isProcessing} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Player or Processing State */}
          {isCompleted && job.outputUrl ? (
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="aspect-[9/16] max-h-[600px] bg-black flex items-center justify-center">
                {job.outputUrl.startsWith('file://') ? (
                  <div className="text-center p-6">
                    <Joystick className="h-12 w-12 text-brand-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-300 mb-1">Video saved locally (DEV MODE)</p>
                    <p className="text-xs text-gray-500 break-all">{job.outputUrl}</p>
                  </div>
                ) : (
                  <video
                    src={job.outputUrl}
                    controls
                    className="w-full h-full object-contain"
                    poster={job.thumbnailUrl || undefined}
                  />
                )}
              </div>
              {!job.outputUrl.startsWith('file://') && (
                <div className="p-4 border-t border-white/10 flex items-center gap-3">
                  <PublishDialog
                    jobType="gameplay"
                    jobId={job.id}
                    videoUrl={job.outputUrl}
                    thumbnailUrl={job.thumbnailUrl}
                    defaultTitle={job.gameTitle || TEMPLATE_LABELS[job.template] || 'Gameplay Video'}
                  />
                  <a
                    href={job.outputUrl}
                    download
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition"
                  >
                    <Download className="h-4 w-4" />
                    Download Video
                  </a>
                </div>
              )}
            </div>
          ) : !isCompleted && (
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
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
                  </>
                ) : (
                  <>
                    <Loader2 className="h-12 w-12 text-brand-400 animate-spin mb-4" />
                    <p className="text-gray-400 font-medium">
                      {job.currentStage || getJobStatusLabel(job.status) + '...'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Generating {job.duration}s gameplay video at 30fps
                    </p>
                    {job.progress > 0 && (
                      <div className="mt-4 w-64">
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all duration-500"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <p className="text-xs text-gray-500">
                            {getJobStatusLabel(job.status)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {job.progress}%
                          </p>
                        </div>
                      </div>
                    )}
                    {job.totalFrames && (
                      <p className="text-xs text-gray-600 mt-2">
                        {job.totalFrames} frames to render
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — Details */}
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
            <dl className="space-y-4">
              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Joystick className="h-4 w-4" />
                  Template
                </dt>
                <dd className="text-sm text-white">
                  {TEMPLATE_LABELS[job.template]}
                </dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Palette className="h-4 w-4" />
                  Theme
                </dt>
                <dd className="text-sm text-white capitalize">{job.theme}</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Gauge className="h-4 w-4" />
                  Difficulty
                </dt>
                <dd
                  className="text-sm font-medium capitalize"
                  style={{ color: getDifficultyColor(job.difficulty) }}
                >
                  {job.difficulty}
                </dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Clock className="h-4 w-4" />
                  Duration
                </dt>
                <dd className="text-sm text-white">{job.duration}s</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Monitor className="h-4 w-4" />
                  Aspect Ratio
                </dt>
                <dd className="text-sm text-white">{job.aspectRatio}</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Music className="h-4 w-4" />
                  Music
                </dt>
                <dd className="text-sm text-white capitalize">{job.musicStyle}</dd>
              </div>

              {job.totalFrames && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <Film className="h-4 w-4" />
                    Frames
                  </dt>
                  <dd className="text-sm text-white">{job.totalFrames}</dd>
                </div>
              )}

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

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Zap className="h-4 w-4" />
                  Cost
                </dt>
                <dd className="text-sm text-white">{job.creditsCost} credits</dd>
              </div>
            </dl>
          </div>

          {job.ctaText && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">CTA Text</h3>
              <p className="text-sm text-brand-400">{job.ctaText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
