import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Gamepad2,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Zap,
  Download,
  Timer,
  HelpCircle,
  BarChart3,
  Clock,
  FileText,
  Film,
  Monitor,
  Upload,
} from 'lucide-react'
import { PublishDialog } from '@/components/publish/publish-dialog'
import { getJobStatusLabel, getJobStatusColor } from '@/lib/utils'
import { DeleteChallengeButton } from './delete-button'
import { AutoRefresh } from './auto-refresh'
import { RetryButton } from './retry-button'
import { CopyHashtags } from '@/components/copy-hashtags'

interface ChallengeDetailPageProps {
  params: { id: string }
}

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  emoji_guess: 'Emoji Guess',
  riddle: 'Riddle Challenge',
  math: 'Math in 5 Seconds',
  gk_quiz: 'GK / Trivia Quiz',
  would_you_rather: 'Would You Rather',
}

export default async function ChallengeDetailPage({ params }: ChallengeDetailPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const challenge = await prisma.challengeJob.findUnique({
    where: { id: params.id },
  })

  const isAdmin = session.user.role === 'ADMIN'
  if (!challenge || (!isAdmin && challenge.userId !== session.user.id)) {
    redirect('/challenges')
  }

  const isCompleted = challenge.status === 'COMPLETED'
  const isFailed = challenge.status === 'FAILED'
  const isProcessing = !isCompleted && !isFailed

  // Resolve video URL: file:// → API proxy, cloud → direct
  const videoUrl = challenge.outputUrl
    ? challenge.outputUrl.startsWith('file://')
      ? `/api/challenges/${challenge.id}/video`
      : challenge.outputUrl
    : null

  // Parse questions
  let questions: Array<{
    hookText: string
    question: string
    answer: string
    options?: string[]
    emojis?: string
    optionA?: string
    optionB?: string
    explanation?: string
  }> = []
  if (challenge.questionsJson) {
    try {
      const parsed = JSON.parse(challenge.questionsJson)
      if (Array.isArray(parsed)) questions = parsed
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

  function getDifficultyColor(difficulty: string): string {
    const colors: Record<string, string> = {
      easy: '#22C55E',
      medium: '#F59E0B',
      hard: '#EF4444',
      impossible: '#7C3AED',
    }
    return colors[difficulty] || '#6366F1'
  }

  // Pipeline stages
  const stages = [
    { key: 'QUEUED', label: 'Queued', icon: Clock },
    { key: 'CONTENT_GENERATING', label: 'Content Generation', icon: FileText },
    { key: 'COMPOSING', label: 'Composing Video', icon: Film },
    { key: 'UPLOADING', label: 'Uploading', icon: Upload },
    { key: 'COMPLETED', label: 'Completed', icon: CheckCircle2 },
  ]

  const stageOrder = stages.map((s) => s.key)
  const currentIndex = stageOrder.indexOf(challenge.status)

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
        href="/challenges"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-3"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Challenges
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {CHALLENGE_TYPE_LABELS[challenge.challengeType] || challenge.challengeType}
            </h1>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded capitalize bg-white/10 text-gray-300">
              {challenge.category}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded capitalize"
              style={{
                backgroundColor: getDifficultyColor(challenge.difficulty) + '20',
                color: getDifficultyColor(challenge.difficulty),
              }}
            >
              {challenge.difficulty}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${getJobStatusColor(challenge.status)}`}
            >
              {isCompleted && <CheckCircle2 className="h-4 w-4" />}
              {isFailed && <XCircle className="h-4 w-4" />}
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {getJobStatusLabel(challenge.status)}
            </span>
            <span className="text-sm text-gray-500">
              Created {formatDateTime(challenge.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          {isFailed && <RetryButton challengeId={challenge.id} />}
          <DeleteChallengeButton challengeId={challenge.id} isProcessing={isProcessing} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Player or Processing State */}
          {isCompleted && videoUrl ? (
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="aspect-[9/16] max-h-[600px] bg-black flex items-center justify-center">
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  poster={challenge.thumbnailUrl || undefined}
                />
              </div>
              <div className="p-4 border-t border-white/10 flex items-center gap-3">
                <PublishDialog
                  jobType="challenge"
                  jobId={challenge.id}
                  videoUrl={videoUrl}
                  thumbnailUrl={challenge.thumbnailUrl}
                  defaultTitle={CHALLENGE_TYPE_LABELS[challenge.challengeType] || challenge.challengeType}
                />
                <a
                  href={videoUrl}
                  download
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition"
                >
                  <Download className="h-4 w-4" />
                  Download Video
                </a>
              </div>
            </div>
          ) : !isCompleted && (
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="aspect-video bg-gray-900 flex flex-col items-center justify-center">
                {isFailed ? (
                  <>
                    <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
                    <p className="text-red-400 font-medium">Generation Failed</p>
                    {challenge.errorMessage && (
                      <p className="text-sm text-red-400/70 mt-2 max-w-md text-center">
                        {challenge.errorMessage}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Loader2 className="h-12 w-12 text-brand-400 animate-spin mb-4" />
                    <p className="text-gray-400 font-medium">
                      {getJobStatusLabel(challenge.status)}...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      This usually takes less than a minute
                    </p>
                    {challenge.progress > 0 && (
                      <div className="mt-4 w-48">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all"
                            style={{ width: `${challenge.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-1">
                          {challenge.progress}%
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Generated Questions Preview */}
          {questions.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-brand-400" />
                Questions
                <span className="text-xs text-gray-500 font-normal ml-1">
                  ({questions.length} generated)
                </span>
              </h2>
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg p-4 border border-white/[0.06] bg-black/20"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-brand-400 mb-1">{q.hookText}</p>
                        {q.emojis && (
                          <p className="text-2xl mb-2">{q.emojis}</p>
                        )}
                        <p className="text-sm text-gray-200 font-medium">{q.question}</p>
                        {q.options && (
                          <div className="mt-2 space-y-1">
                            {q.options.map((opt, i) => (
                              <p key={i} className={`text-xs px-2 py-1 rounded ${opt === q.answer ? 'bg-green-500/10 text-green-400' : 'text-gray-400'}`}>
                                {['A', 'B', 'C', 'D'][i]}) {opt}
                                {opt === q.answer && ' ✓'}
                              </p>
                            ))}
                          </div>
                        )}
                        {q.optionA && q.optionB && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="text-xs px-2 py-1.5 rounded bg-green-500/10 text-green-400 text-center">A: {q.optionA}</div>
                            <div className="text-xs px-2 py-1.5 rounded bg-red-500/10 text-red-400 text-center">B: {q.optionB}</div>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">Answer:</span>
                          <span className="text-xs text-green-400 font-medium">{q.answer}</span>
                        </div>
                        {q.explanation && (
                          <p className="text-xs text-gray-500 mt-1 italic">{q.explanation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {challenge.ctaText && (
                <div className="mt-4 p-3 rounded-lg bg-brand-500/10 border border-brand-500/20">
                  <p className="text-xs text-gray-400 mb-1">CTA Text</p>
                  <p className="text-sm text-brand-400 font-medium">{challenge.ctaText}</p>
                </div>
              )}
            </div>
          )}

          {/* Hashtags */}
          {challenge.hashtags && <CopyHashtags hashtags={challenge.hashtags} />}
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
                  <Gamepad2 className="h-4 w-4" />
                  Type
                </dt>
                <dd className="text-sm text-white">
                  {CHALLENGE_TYPE_LABELS[challenge.challengeType]}
                </dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <BarChart3 className="h-4 w-4" />
                  Difficulty
                </dt>
                <dd
                  className="text-sm font-medium capitalize"
                  style={{ color: getDifficultyColor(challenge.difficulty) }}
                >
                  {challenge.difficulty}
                </dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <HelpCircle className="h-4 w-4" />
                  Questions
                </dt>
                <dd className="text-sm text-white">{challenge.numQuestions}</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Timer className="h-4 w-4" />
                  Timer
                </dt>
                <dd className="text-sm text-white">{challenge.timerSeconds}s</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Calendar className="h-4 w-4" />
                  Created
                </dt>
                <dd className="text-sm text-white">{formatDateTime(challenge.createdAt)}</dd>
              </div>

              {challenge.completedAt && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed
                  </dt>
                  <dd className="text-sm text-white">{formatDateTime(challenge.completedAt)}</dd>
                </div>
              )}

              {challenge.processingTimeMs && (
                <div className="flex items-center gap-3">
                  <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                    <Zap className="h-4 w-4" />
                    Proc. Time
                  </dt>
                  <dd className="text-sm text-white">
                    {(challenge.processingTimeMs / 1000).toFixed(1)}s
                  </dd>
                </div>
              )}

              <div className="flex items-center gap-3">
                <dt className="flex items-center gap-2 text-sm text-gray-400 w-28">
                  <Zap className="h-4 w-4" />
                  Cost
                </dt>
                <dd className="text-sm text-white">{challenge.creditsCost} credit</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
