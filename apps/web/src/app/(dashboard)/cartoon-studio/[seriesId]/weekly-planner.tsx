'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  CalendarDays,
  Loader2,
  Sparkles,
  Check,
  X,
  RefreshCw,
  Wand2,
} from 'lucide-react'

interface EpisodeIdea {
  title: string
  prompt: string
  synopsis: string
  selected: boolean
}

export default function WeeklyPlanner({ seriesId }: { seriesId: string }) {
  const router = useRouter()
  const [ideas, setIdeas] = useState<EpisodeIdea[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [hint, setHint] = useState('')
  const [showPlanner, setShowPlanner] = useState(false)

  async function handleGenerateWeek() {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/cartoon-studio/series/${seriesId}/generate-ideas?count=7`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hint: hint.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate ideas')
        return
      }
      if (data.ideas) {
        setIdeas(data.ideas.map((idea: any) => ({ ...idea, selected: true })))
        toast.success(`${data.ideas.length} episode ideas generated!`)
      }
    } catch {
      toast.error('Failed to generate ideas')
    } finally {
      setIsGenerating(false)
    }
  }

  function toggleIdea(index: number) {
    setIdeas((prev) =>
      prev.map((idea, i) => (i === index ? { ...idea, selected: !idea.selected } : idea))
    )
  }

  async function handleCreateSelected() {
    const selected = ideas.filter((i) => i.selected)
    if (selected.length === 0) {
      toast.error('Select at least one episode to create')
      return
    }

    setIsCreating(true)
    let created = 0
    let failed = 0

    for (const idea of selected) {
      try {
        const res = await fetch(`/api/cartoon-studio/series/${seriesId}/episodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: idea.title,
            prompt: idea.prompt,
            synopsis: idea.synopsis,
          }),
        })
        if (res.ok) {
          created++
        } else {
          const data = await res.json()
          if (res.status === 402) {
            toast.error(`Insufficient credits after ${created} episodes`)
            break
          }
          failed++
        }
      } catch {
        failed++
      }
    }

    setIsCreating(false)

    if (created > 0) {
      toast.success(`${created} episode${created > 1 ? 's' : ''} queued for generation!`)
      setIdeas([])
      setShowPlanner(false)
      router.refresh()
    }
    if (failed > 0) {
      toast.error(`${failed} episode${failed > 1 ? 's' : ''} failed to create`)
    }
  }

  const selectedCount = ideas.filter((i) => i.selected).length

  if (!showPlanner) {
    return (
      <button
        onClick={() => setShowPlanner(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-sm font-medium text-brand-300 hover:bg-brand-500/20 transition"
      >
        <CalendarDays className="h-4 w-4" />
        Plan Week
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-brand-400" />
          <h3 className="text-sm font-semibold text-brand-300">Weekly Episode Planner</h3>
        </div>
        <button
          onClick={() => { setShowPlanner(false); setIdeas([]) }}
          className="text-gray-500 hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Generate 7 episode ideas for the week. Pick the ones you like and create them all at once.
      </p>

      {ideas.length === 0 ? (
        <div className="space-y-3">
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Optional theme hint (e.g., school, nature, festivals)..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={handleGenerateWeek}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50 w-full justify-center"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {isGenerating ? 'Generating 7 Ideas...' : 'Generate Weekly Ideas'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Idea cards */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {ideas.map((idea, i) => (
              <div
                key={i}
                onClick={() => toggleIdea(i)}
                className={`rounded-lg border p-3 cursor-pointer transition ${
                  idea.selected
                    ? 'border-brand-500/50 bg-brand-500/10'
                    : 'border-white/10 bg-white/5 opacity-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-5 w-5 rounded flex items-center justify-center flex-shrink-0 transition ${
                      idea.selected
                        ? 'bg-brand-500 text-white'
                        : 'bg-white/10 text-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white">{idea.title}</h4>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{idea.prompt}</p>
                    {idea.synopsis && (
                      <p className="text-[10px] text-gray-500 mt-1 italic">{idea.synopsis}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {selectedCount} of {ideas.length} selected
              </span>
              <span className="text-xs text-gray-500">
                ({selectedCount * 5} credits)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateWeek}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
              <button
                onClick={handleCreateSelected}
                disabled={isCreating || selectedCount === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
              >
                {isCreating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Create {selectedCount} Episode{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
