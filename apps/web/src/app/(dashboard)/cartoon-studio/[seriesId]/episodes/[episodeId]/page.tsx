'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Play,
  MessageSquare,
  Image as ImageIcon,
} from 'lucide-react'
import { PublishDialog } from '@/components/publish/publish-dialog'

interface Scene {
  id: string
  sceneIndex: number
  description: string
  visualPrompt: string | null
  imageUrl: string | null
  narration: string | null
  dialogue: { characterName: string; text: string }[] | null
  startTime: number
  endTime: number
  status: string
}

interface Episode {
  id: string
  title: string
  synopsis: string | null
  episodeNumber: number
  prompt: string
  storyScript: string | null
  status: string
  progress: number
  currentStage: string | null
  outputUrl: string | null
  errorMessage: string | null
  durationSeconds: number | null
  scenes: Scene[]
  series: {
    name: string
    characters: { id: string; name: string; color: string | null }[]
  }
}

const STAGE_ORDER = [
  'QUEUED',
  'STORY_GENERATING',
  'IMAGE_GENERATING',
  'VOICE_GENERATING',
  'COMPOSING',
  'UPLOADING',
  'COMPLETED',
]

const STAGE_LABELS: Record<string, string> = {
  QUEUED: 'Queued',
  STORY_GENERATING: 'Writing Story',
  IMAGE_GENERATING: 'Generating Images',
  VOICE_GENERATING: 'Generating Voices',
  COMPOSING: 'Composing Video',
  UPLOADING: 'Uploading',
  COMPLETED: 'Complete',
  FAILED: 'Failed',
}

export default function EpisodeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const seriesId = params.seriesId as string
  const episodeId = params.episodeId as string

  const [episode, setEpisode] = useState<Episode | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const fetchEpisode = useCallback(async () => {
    try {
      const res = await fetch(`/api/cartoon-studio/series/${seriesId}/episodes/${episodeId}`)
      const data = await res.json()
      if (data.episode) setEpisode(data.episode)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [seriesId, episodeId])

  useEffect(() => {
    fetchEpisode()
  }, [fetchEpisode])

  // Poll while processing
  useEffect(() => {
    if (!episode) return
    if (['COMPLETED', 'FAILED'].includes(episode.status)) return

    const interval = setInterval(fetchEpisode, 5000)
    return () => clearInterval(interval)
  }, [episode?.status, fetchEpisode])

  async function handleRetry() {
    setRetrying(true)
    try {
      const res = await fetch(`/api/cartoon-studio/series/${seriesId}/episodes/${episodeId}`, {
        method: 'POST',
      })
      if (res.ok) {
        toast.success('Episode retry queued')
        fetchEpisode()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Retry failed')
      }
    } catch {
      toast.error('Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  if (!episode) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Episode not found</p>
      </div>
    )
  }

  const isProcessing = !['COMPLETED', 'FAILED'].includes(episode.status)
  const currentIdx = STAGE_ORDER.indexOf(episode.status)
  const charMap = new Map(
    episode.series.characters.map((c) => [c.name, c])
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-white/[0.06]">
        <Link
          href={`/cartoon-studio/${seriesId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {episode.series.name}
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Ep. {episode.episodeNumber}: {episode.title}
            </h1>
            {episode.synopsis && (
              <p className="text-sm text-gray-500 mt-2">{episode.synopsis}</p>
            )}
          </div>
          {episode.status === 'FAILED' && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600/20 border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-600/30 transition disabled:opacity-50"
            >
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Retry
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — Scenes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scenes */}
          {episode.scenes.length > 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white mb-4">
                Scenes ({episode.scenes.length})
              </h2>
              <div className="space-y-3">
                {episode.scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start gap-4">
                      {/* Scene image thumbnail */}
                      <div className="w-28 h-20 rounded-lg bg-white/5 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {scene.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-gray-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-brand-400">
                            Scene {scene.sceneIndex + 1}
                          </span>
                          <span className="text-[10px] text-gray-600">
                            {Math.round(scene.endTime - scene.startTime)}s
                          </span>
                          <span className={`text-[10px] font-medium ${
                            scene.status === 'COMPLETED' ? 'text-green-400' :
                            scene.status === 'PROCESSING' ? 'text-yellow-400' :
                            scene.status === 'FAILED' ? 'text-red-400' : 'text-gray-600'
                          }`}>
                            {scene.status === 'COMPLETED' ? 'Done' :
                             scene.status === 'PROCESSING' ? 'Processing' :
                             scene.status === 'FAILED' ? 'Failed' : 'Pending'}
                          </span>
                        </div>

                        <p className="text-sm text-gray-300 mb-2">{scene.description}</p>

                        {/* Narration */}
                        {scene.narration && (
                          <p className="text-xs text-gray-500 italic mb-2">
                            <span className="text-gray-600">Narrator:</span> {scene.narration}
                          </p>
                        )}

                        {/* Dialogue */}
                        {scene.dialogue && Array.isArray(scene.dialogue) && scene.dialogue.length > 0 && (
                          <div className="space-y-1 mt-2 pt-2 border-t border-white/5">
                            {scene.dialogue.map((line: { characterName: string; text: string }, i: number) => {
                              const char = charMap.get(line.characterName)
                              return (
                                <div key={i} className="flex items-start gap-2 text-xs">
                                  <span
                                    className="font-medium flex-shrink-0"
                                    style={{ color: char?.color || '#9CA3AF' }}
                                  >
                                    {line.characterName}:
                                  </span>
                                  <span className="text-gray-400">{line.text}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <MessageSquare className="h-8 w-8 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No scenes generated yet</p>
              <p className="text-gray-600 text-xs mt-1">Scenes will appear here once the story is generated</p>
            </div>
          )}

          {/* Story Script */}
          {episode.storyScript && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Story Script</h2>
              <div className="bg-black/30 rounded-lg p-4 max-h-80 overflow-y-auto">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {episode.storyScript}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Pipeline + Preview */}
        <div className="space-y-6">
          {/* Video Preview */}
          {episode.status === 'COMPLETED' && episode.outputUrl && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black overflow-hidden">
                <video
                  src={episode.outputUrl}
                  controls
                  className="w-full"
                  playsInline
                />
              </div>
              <PublishDialog
                jobType="cartoon"
                jobId={episodeId}
                videoUrl={episode.outputUrl}
                defaultTitle={`${episode.series.name} - Ep. ${episode.episodeNumber}: ${episode.title}`}
              />
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Loader2 className="h-4 w-4 text-brand-400 animate-spin" />
                <span className="text-sm font-medium text-white">Processing...</span>
                <span className="text-xs text-brand-400 ml-auto">{episode.progress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-500"
                  style={{ width: `${episode.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {episode.status === 'FAILED' && episode.errorMessage && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-400 font-medium mb-1">Generation Failed</p>
              <p className="text-xs text-red-300/70">{episode.errorMessage}</p>
            </div>
          )}

          {/* Pipeline Status */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Pipeline</h2>
            <div className="space-y-0">
              {STAGE_ORDER.map((stage, i) => {
                const isActive = episode.status === stage
                const isDone = currentIdx > i || episode.status === 'COMPLETED'
                const isFailed = episode.status === 'FAILED' && currentIdx === i
                const isLast = i === STAGE_ORDER.length - 1

                return (
                  <div key={stage} className="relative flex gap-3">
                    {/* Connector line */}
                    {!isLast && (
                      <div
                        className={`absolute left-[11px] top-[24px] w-0.5 h-[calc(100%-4px)] ${
                          isDone ? 'bg-green-500/40' :
                          isActive ? 'bg-brand-500/40' :
                          isFailed ? 'bg-red-500/40' : 'bg-white/10'
                        }`}
                      />
                    )}

                    {/* Icon */}
                    <div
                      className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 ${
                        isDone ? 'bg-green-500/20 text-green-400' :
                        isActive ? 'bg-brand-500/20 text-brand-400' :
                        isFailed ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-600'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : isActive ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isFailed ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* Label */}
                    <div className="pb-4">
                      <p className={`text-xs font-medium ${
                        isDone ? 'text-green-400' :
                        isActive ? 'text-brand-400' :
                        isFailed ? 'text-red-400' : 'text-gray-600'
                      }`}>
                        {STAGE_LABELS[stage]}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Episode Details */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className={`font-medium ${
                  episode.status === 'COMPLETED' ? 'text-green-400' :
                  episode.status === 'FAILED' ? 'text-red-400' :
                  'text-brand-400'
                }`}>
                  {STAGE_LABELS[episode.status] || episode.status}
                </dd>
              </div>
              {episode.durationSeconds && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Duration</dt>
                  <dd className="text-white">{Math.floor(episode.durationSeconds / 60)}m {episode.durationSeconds % 60}s</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Scenes</dt>
                <dd className="text-white">{episode.scenes.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Episode</dt>
                <dd className="text-white">#{episode.episodeNumber}</dd>
              </div>
            </dl>
          </div>

          {/* Prompt */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Prompt</h2>
            <p className="text-sm text-gray-300 leading-relaxed">{episode.prompt}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
