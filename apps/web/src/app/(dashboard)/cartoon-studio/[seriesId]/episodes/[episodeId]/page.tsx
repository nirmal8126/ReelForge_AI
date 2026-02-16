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
      <div className="mb-6">
        <Link
          href={`/cartoon-studio/${seriesId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {episode.series.name}
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Ep. {episode.episodeNumber}: {episode.title}
            </h1>
            {episode.synopsis && (
              <p className="text-gray-400 text-sm mt-1">{episode.synopsis}</p>
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

      {/* Progress Pipeline */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 font-medium uppercase">Pipeline Status</span>
          {isProcessing && (
            <span className="text-xs text-brand-400">{episode.progress}%</span>
          )}
        </div>
        {isProcessing && (
          <div className="w-full h-1.5 rounded-full bg-white/10 mb-4 overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${episode.progress}%` }}
            />
          </div>
        )}
        <div className="flex items-center gap-1">
          {STAGE_ORDER.map((stage, i) => {
            const isActive = episode.status === stage
            const isDone = currentIdx > i || episode.status === 'COMPLETED'
            const isFailed = episode.status === 'FAILED' && currentIdx === i

            return (
              <div key={stage} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-1.5 text-[10px] font-medium ${
                  isDone ? 'text-green-400' :
                  isActive ? 'text-brand-400' :
                  isFailed ? 'text-red-400' : 'text-gray-600'
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isActive ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isFailed ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden md:inline">{STAGE_LABELS[stage]}</span>
                </div>
                {i < STAGE_ORDER.length - 1 && (
                  <div className={`flex-1 h-px ${isDone ? 'bg-green-400/30' : 'bg-white/10'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {episode.status === 'FAILED' && episode.errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 mb-6">
          <p className="text-sm text-red-400 font-medium mb-1">Generation Failed</p>
          <p className="text-xs text-red-300/70">{episode.errorMessage}</p>
        </div>
      )}

      {/* Video Preview */}
      {episode.status === 'COMPLETED' && episode.outputUrl && (
        <div className="rounded-xl border border-white/10 bg-black overflow-hidden mb-6">
          <video
            src={episode.outputUrl}
            controls
            className="w-full max-h-[500px]"
            playsInline
          />
        </div>
      )}

      {/* Scenes */}
      {episode.scenes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Scenes ({episode.scenes.length})
          </h2>
          <div className="space-y-3">
            {episode.scenes.map((scene) => (
              <div
                key={scene.id}
                className="rounded-lg border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Scene image thumbnail */}
                  <div className="w-24 h-16 rounded-lg bg-white/5 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {scene.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-gray-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-400">
                        Scene {scene.sceneIndex + 1}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {Math.round(scene.endTime - scene.startTime)}s
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
                      <div className="space-y-1">
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
        </section>
      )}
    </div>
  )
}
