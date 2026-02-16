import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  PlusCircle,
  Settings,
  Users,
  Film,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Play,
} from 'lucide-react'
import WeeklyPlanner from './weekly-planner'

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  QUEUED: { color: 'text-gray-400', icon: Clock, label: 'Queued' },
  STORY_GENERATING: { color: 'text-blue-400', icon: Loader2, label: 'Writing Story' },
  IMAGE_GENERATING: { color: 'text-purple-400', icon: Loader2, label: 'Generating Images' },
  VOICE_GENERATING: { color: 'text-yellow-400', icon: Loader2, label: 'Generating Voices' },
  COMPOSING: { color: 'text-orange-400', icon: Loader2, label: 'Composing Video' },
  UPLOADING: { color: 'text-cyan-400', icon: Loader2, label: 'Uploading' },
  COMPLETED: { color: 'text-green-400', icon: CheckCircle2, label: 'Completed' },
  FAILED: { color: 'text-red-400', icon: XCircle, label: 'Failed' },
}

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { seriesId } = await params

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
    include: {
      characters: { orderBy: { createdAt: 'asc' } },
      episodes: {
        orderBy: { episodeNumber: 'desc' },
        include: { _count: { select: { scenes: true } } },
      },
    },
  })

  if (!series) notFound()

  return (
    <div>
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-white/[0.06]">
        <Link
          href="/cartoon-studio"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cartoon Studio
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white tracking-tight">{series.name}</h1>
          <div className="flex items-center gap-3">
            <WeeklyPlanner seriesId={seriesId} />
            <Link
              href={`/cartoon-studio/${seriesId}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition flex-shrink-0"
            >
              <Settings className="h-4 w-4" />
              Edit Series
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Series Details */}
        <div className="space-y-6">
          {/* Series Info */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Series Info</h2>
            {series.description && (
              <p className="text-gray-400 text-sm mb-4">{series.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {series.artStyle && (
                <span className="bg-white/10 px-2.5 py-1 rounded-md">{series.artStyle}</span>
              )}
              {series.targetAudience && (
                <span className="bg-white/10 px-2.5 py-1 rounded-md">{series.targetAudience}</span>
              )}
              <span className="bg-white/10 px-2.5 py-1 rounded-md">{series.aspectRatio}</span>
              <span className="bg-white/10 px-2.5 py-1 rounded-md">{series.language.toUpperCase()}</span>
            </div>
          </div>

          {/* Characters */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-gray-400" />
              Characters ({series.characters.length})
            </h2>

            {series.characters.length === 0 ? (
              <p className="text-gray-500 text-sm">No characters yet. Add characters from Edit Series.</p>
            ) : (
              <div className="space-y-2">
                {series.characters.map((char) => (
                  <div
                    key={char.id}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: char.color || '#6366F1' }}
                    >
                      {char.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white">{char.name}</span>
                      {char.personality && (
                        <p className="text-[10px] text-gray-500 truncate">{char.personality}</p>
                      )}
                    </div>
                    {char.voiceId && (
                      <span className="text-[10px] text-brand-400 flex-shrink-0">Voice set</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Episodes */}
        <div className="space-y-6">
          {/* Episodes List */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Film className="h-5 w-5 text-gray-400" />
                Episodes ({series.episodes.length})
              </h2>
              <Link
                href={`/cartoon-studio/${seriesId}/episodes/new`}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition"
              >
                <PlusCircle className="h-4 w-4" />
                New Episode
              </Link>
            </div>

            {series.episodes.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
                <Film className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No episodes yet</p>
                <p className="text-gray-600 text-xs mt-1">Create your first episode to start generating content</p>
              </div>
            ) : (
              <div className="space-y-2">
                {series.episodes.map((ep) => {
                  const statusCfg = STATUS_CONFIG[ep.status] || STATUS_CONFIG.QUEUED
                  const StatusIcon = statusCfg.icon
                  const isProcessing = !['COMPLETED', 'FAILED'].includes(ep.status)

                  return (
                    <Link
                      key={ep.id}
                      href={`/cartoon-studio/${seriesId}/episodes/${ep.id}`}
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition group"
                    >
                      <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-sm font-bold text-gray-400 flex-shrink-0">
                        {ep.episodeNumber}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-white truncate group-hover:text-brand-400 transition">
                          {ep.title}
                        </h3>
                        {ep.synopsis && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{ep.synopsis}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isProcessing && ep.progress > 0 && (
                          <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full transition-all"
                              style={{ width: `${ep.progress}%` }}
                            />
                          </div>
                        )}
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusCfg.color}`}>
                          <StatusIcon className={`h-3.5 w-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                          {statusCfg.label}
                        </span>
                        {ep.status === 'COMPLETED' && (
                          <Play className="h-4 w-4 text-green-400" />
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
