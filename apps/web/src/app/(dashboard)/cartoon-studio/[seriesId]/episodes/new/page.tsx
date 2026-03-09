'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { ArrowLeft, Loader2, Sparkles, CreditCard, Wand2, RefreshCw } from 'lucide-react'
import { getCartoonCreditCost } from '@/lib/credit-cost'

const CREDITS_PER_EPISODE = getCartoonCreditCost()

export default function NewEpisodePage() {
  const router = useRouter()
  const params = useParams()
  const seriesId = params.seriesId as string

  const [seriesName, setSeriesName] = useState('')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [hint, setHint] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/cartoon-studio/series/${seriesId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.series) setSeriesName(data.series.name)
      })
      .finally(() => setLoading(false))
  }, [seriesId])

  async function handleGenerateIdea() {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/cartoon-studio/series/${seriesId}/generate-ideas?count=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hint: hint.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate idea')
        return
      }
      if (data.ideas && data.ideas.length > 0) {
        const idea = data.ideas[0]
        setTitle(idea.title)
        setPrompt(idea.prompt)
        setSynopsis(idea.synopsis)
        toast.success('Episode idea generated!')
      }
    } catch {
      toast.error('Failed to generate idea')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSubmit() {
    const newErrors: Record<string, string> = {}
    if (!title.trim()) newErrors.title = 'Episode title is required'
    if (prompt.trim().length < 10) newErrors.prompt = 'Prompt must be at least 10 characters'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/cartoon-studio/series/${seriesId}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, prompt, synopsis: synopsis || undefined }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 402) {
          toast.error(`Insufficient credits. Need ${CREDITS_PER_EPISODE}, have ${data.balance}`)
        } else {
          toast.error(data.error || 'Failed to create episode')
        }
        return
      }

      toast.success('Episode queued for generation!')
      router.push(`/cartoon-studio/${seriesId}/episodes/${data.episode.id}`)
    } catch {
      toast.error('Failed to create episode')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 pb-5 border-b border-white/[0.06]">
        <Link
          href={`/cartoon-studio/${seriesId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {seriesName || 'Series'}
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">New Episode</h1>
        <p className="text-sm text-gray-500 mt-1">
          Describe the episode story or let AI generate an idea for you
        </p>
      </div>

      <div className="space-y-5">
        {/* AI Idea Generator */}
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wand2 className="h-4 w-4 text-brand-400" />
            <span className="text-sm font-medium text-brand-300">AI Idea Generator</span>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            No idea what to write? Let AI suggest an episode based on your series and characters.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Optional theme hint (e.g., friendship, adventure, cooking)..."
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
            />
            <button
              onClick={handleGenerateIdea}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50 flex-shrink-0"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isGenerating ? 'Generating...' : 'Generate Idea'}
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-300 mb-1.5 block">Episode Title <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErrors((prev) => ({ ...prev, title: '' })) }}
            placeholder="e.g., The Missing Treasure"
            className={`w-full rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none ${
              errors.title ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-brand-500'
            }`}
          />
          {errors.title && <p className="text-xs text-red-400 mt-1.5">{errors.title}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-300 mb-1.5 block">Story Prompt <span className="text-red-400">*</span></label>
          <textarea
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setErrors((prev) => ({ ...prev, prompt: '' })) }}
            placeholder="Describe what happens in this episode. The AI will expand this into a full story with scenes and dialogue for your characters. Be specific about the plot, key events, and lessons."
            rows={6}
            className={`w-full rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none resize-none ${
              errors.prompt ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-brand-500'
            }`}
          />
          {errors.prompt ? (
            <p className="text-xs text-red-400 mt-1.5">{errors.prompt}</p>
          ) : (
            <p className="text-[10px] text-gray-600 mt-1">
              {prompt.length}/3000 characters — more detail produces better stories
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-300 mb-1.5 block">
            Synopsis <span className="text-gray-600">(optional)</span>
          </label>
          <textarea
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            placeholder="One-line summary for your reference"
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none resize-none"
          />
        </div>

        {/* Cost info */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <CreditCard className="h-4 w-4 text-brand-400" />
            <span>Cost: <strong className="text-white">{CREDITS_PER_EPISODE} credits</strong> or 1 job from your monthly quota</span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">
            Includes AI story generation, multi-voice dialogue, scene images, and video composition
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Episode
          </button>
        </div>
      </div>
    </div>
  )
}
