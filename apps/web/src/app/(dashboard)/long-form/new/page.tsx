'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, Mic, Send, ArrowLeft, ArrowRight, Loader2, Zap, Check,
  LayoutList, GripVertical, Trash2, Plus, Pencil, ChevronDown, ChevronUp,
  Clock, Eye, Wand2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { SUPPORTED_LANGUAGES, NICHE_PRESETS, VIDEO_STYLES, LANGUAGE_VOICE_MAP } from '@/lib/constants'
import { MusicSelector } from '@/components/ui/music-selector'

const NICHE_ORDER = ['motivation', 'tech', 'finance', 'fitness', 'education', 'business', 'health', 'cooking', 'gaming', 'travel', 'beauty', 'comedy'] as const
const NICHES = NICHE_ORDER.map(id => ({
  id,
  name: NICHE_PRESETS[id].name,
  color: NICHE_PRESETS[id].primaryColor,
}))

const VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah - Professional Female' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam - Professional Male' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte - Energetic Female' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill - Energetic Male' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice - Calm Female' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger - Calm Male' },
  { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Emily - Casual Female' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will - Casual Male' },
]

const DURATIONS = [
  { value: 5, label: '5 min', desc: 'Quick overview' },
  { value: 10, label: '10 min', desc: 'Standard video' },
  { value: 15, label: '15 min', desc: 'Detailed guide' },
  { value: 20, label: '20 min', desc: 'Deep dive' },
  { value: 30, label: '30 min', desc: 'Documentary' },
]

const ASPECTS = [
  { value: '16:9', label: '16:9', desc: 'YouTube · Desktop · TV' },
  { value: '9:16', label: '9:16', desc: 'Reels · Shorts · TikTok' },
  { value: '1:1', label: '1:1', desc: 'Instagram Feed · Facebook' },
]

interface Profile {
  id: string
  name: string
  niche: string
  primaryColor: string
  tone: string
  defaultVoiceId: string | null
  defaultLanguage: string | null
}

interface OutlineSegment {
  title: string
  description: string
  talkingPoints: string[]
  durationSeconds: number
  visualSuggestion: string
}

export default function CreateLongFormPage() {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [generatingOutline, setGeneratingOutline] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [niche, setNiche] = useState('')
  const [generatingIdea, setGeneratingIdea] = useState(false)
  const [estimatedCost, setEstimatedCost] = useState({ credits: 5, cents: 280 })
  const [outline, setOutline] = useState<{ segments: OutlineSegment[] } | null>(null)
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null)
  const [expandedSegment, setExpandedSegment] = useState<number | null>(null)

  const [form, setForm] = useState({
    title: '',
    prompt: '',
    durationMinutes: 5,
    style: 'cinematic',
    language: 'hi',
    voiceId: VOICES[0].id,
    aspectRatio: '16:9',
    bgMusicTrack: 'none',
    bgMusicVolume: 15,
    aiClipRatio: 0.3,
    useStockFootage: true,
    useStaticVisuals: true,
    publishToYouTube: false,
    channelProfileId: '',
  })

  useEffect(() => {
    fetch('/api/profiles')
      .then(r => r.json())
      .then(data => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const creditsCost =
      form.durationMinutes <= 5 ? 3 :
      form.durationMinutes <= 10 ? 5 :
      form.durationMinutes <= 15 ? 7 :
      form.durationMinutes <= 20 ? 9 : 12

    const segmentCount = Math.ceil((form.durationMinutes * 60) / 30)
    const aiSegments = Math.ceil(segmentCount * form.aiClipRatio)
    const estimatedCostCents = Math.ceil(
      (aiSegments * 40) + (form.durationMinutes * 3) + 10
    )

    setEstimatedCost({ credits: creditsCost, cents: estimatedCostCents })
  }, [form.durationMinutes, form.aiClipRatio])

  // ---------------------------------------------------------------------------
  // Generate Idea
  // ---------------------------------------------------------------------------
  const handleGenerateIdea = async () => {
    setGeneratingIdea(true)
    try {
      const selectedProfile = profiles.find(p => p.id === form.channelProfileId)
      const res = await fetch('/api/generate-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'long-form',
          niche: niche || undefined,
          language: form.language,
          channelProfile: selectedProfile
            ? { name: selectedProfile.name, niche: selectedProfile.niche, tone: selectedProfile.tone }
            : undefined,
        }),
      })
      const data = await res.json()
      if (data.title && data.prompt) {
        setForm(prev => ({ ...prev, title: data.title, prompt: data.prompt }))
        toast.success('Idea generated!')
      } else {
        toast.error(data.error || 'Failed to generate idea')
      }
    } catch {
      toast.error('Failed to generate idea')
    } finally {
      setGeneratingIdea(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Generate Outline (Plan Mode)
  // ---------------------------------------------------------------------------
  const handleGenerateOutline = async () => {
    if (!form.prompt || form.prompt.length < 10) {
      toast.error('Please enter at least 10 characters for your prompt')
      return
    }

    setGeneratingOutline(true)
    try {
      const selectedProfile = profiles.find(p => p.id === form.channelProfileId)
      const res = await fetch('/api/long-form/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: form.prompt,
          title: form.title || undefined,
          durationMinutes: form.durationMinutes,
          language: form.language,
          niche: selectedProfile?.niche,
          tone: selectedProfile?.tone,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate outline')
        return
      }

      setOutline(data.outline)
      setStep(2)
      toast.success(`Outline generated with ${data.outline.segments.length} segments!`)
    } catch {
      toast.error('Failed to generate outline')
    } finally {
      setGeneratingOutline(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Outline Editing
  // ---------------------------------------------------------------------------
  const moveSegment = (index: number, direction: 'up' | 'down') => {
    if (!outline) return
    const newSegments = [...outline.segments]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newSegments.length) return
    ;[newSegments[index], newSegments[targetIndex]] = [newSegments[targetIndex], newSegments[index]]
    setOutline({ segments: newSegments })
  }

  const deleteSegment = (index: number) => {
    if (!outline || outline.segments.length <= 2) {
      toast.error('Minimum 2 segments required')
      return
    }
    const newSegments = outline.segments.filter((_, i) => i !== index)
    setOutline({ segments: newSegments })
    setEditingSegmentIndex(null)
  }

  const updateSegment = (index: number, updates: Partial<OutlineSegment>) => {
    if (!outline) return
    const newSegments = [...outline.segments]
    newSegments[index] = { ...newSegments[index], ...updates }
    setOutline({ segments: newSegments })
  }

  const addSegment = () => {
    if (!outline) return
    const avgDuration = Math.round(
      outline.segments.reduce((sum, s) => sum + s.durationSeconds, 0) / outline.segments.length
    )
    const newSegment: OutlineSegment = {
      title: 'New Segment',
      description: 'Add your description here',
      talkingPoints: ['Point 1', 'Point 2'],
      durationSeconds: avgDuration,
      visualSuggestion: 'Stock footage or AI clip',
    }
    setOutline({ segments: [...outline.segments, newSegment] })
    setEditingSegmentIndex(outline.segments.length)
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/long-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || form.prompt.substring(0, 80),
          prompt: form.prompt,
          durationMinutes: form.durationMinutes,
          style: form.style,
          language: form.language,
          voiceId: form.voiceId,
          aspectRatio: form.aspectRatio,
          bgMusicTrack: form.bgMusicTrack !== 'none' ? form.bgMusicTrack : undefined,
          bgMusicVolume: form.bgMusicTrack !== 'none' ? form.bgMusicVolume : undefined,
          aiClipRatio: form.aiClipRatio,
          useStockFootage: form.useStockFootage,
          useStaticVisuals: form.useStaticVisuals,
          publishToYouTube: form.publishToYouTube,
          channelProfileId: form.channelProfileId || undefined,
          outline: outline || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create long-form job')
        return
      }

      toast.success('Long-form video job submitted!')
      router.push(`/long-form/${data.job.id}`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { num: 1, label: 'Topic & Prompt', icon: Sparkles },
    { num: 2, label: 'Plan & Outline', icon: LayoutList },
    { num: 3, label: 'Settings & Style', icon: Zap },
    { num: 4, label: 'Voice & Options', icon: Mic },
    { num: 5, label: 'Review & Generate', icon: Send },
  ]

  const totalOutlineDuration = outline
    ? outline.segments.reduce((sum, s) => sum + s.durationSeconds, 0)
    : 0

  return (
    <div className="mx-auto" style={{ maxWidth: step === 1 ? '100%' : '56rem' }}>
      <Link href="/long-form" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to Videos
      </Link>
      <div className="mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="text-2xl font-bold text-white tracking-tight">Create Long-Form Video</h1>
        <p className="text-sm text-gray-500 mt-1">AI-powered video generation with plan preview</p>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <button
              onClick={() => s.num <= step && setStep(s.num)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition w-full ${
                s.num === step
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : s.num < step
                  ? 'bg-green-500/10 text-green-400 cursor-pointer'
                  : 'bg-white/5 text-gray-500'
              }`}
            >
              <s.icon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden lg:inline truncate">{s.label}</span>
            </button>
            {i < steps.length - 1 && <div className="w-4 h-px bg-white/10 flex-shrink-0 mx-1" />}
          </div>
        ))}
      </div>

      {/* ================================================================== */}
      {/* Step 1: Topic & Prompt                                             */}
      {/* ================================================================== */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Left: Preferences ── */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white mb-0.5">Preferences</h3>
                <p className="text-xs text-gray-500">Choose a profile or niche and language</p>
              </div>

              {/* Channel Profile */}
              {profiles.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Channel Profile</label>
                  <select
                    value={form.channelProfileId}
                    onChange={e => {
                      const profileId = e.target.value
                      const profile = profiles.find(p => p.id === profileId)
                      const updates: Record<string, any> = { channelProfileId: profileId }
                      if (profile) {
                        if (profile.defaultLanguage) updates.language = profile.defaultLanguage
                        if (profile.defaultVoiceId) updates.voiceId = profile.defaultVoiceId
                        setNiche('')
                      }
                      setForm(prev => ({ ...prev, ...updates }))
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:ring focus:ring-brand-500/20 transition"
                  >
                    <option value="">No profile (use defaults)</option>
                    {profiles.map(profile => (
                      <option key={profile.id} value={profile.id}>{profile.name} ({profile.niche})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Niche Selection */}
              {!form.channelProfileId && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Niche</label>
                  <div className="flex flex-wrap gap-2">
                    {NICHES.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setNiche(niche === n.id ? '' : n.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition border ${
                          niche === n.id
                            ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: n.color }} />
                        {n.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Language */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Language</label>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setForm({ ...form, language: lang.code })}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        form.language === lang.code
                          ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                      }`}
                    >
                      <span className="text-sm">{lang.flag}</span>
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Idea */}
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3.5 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-300">Need inspiration?</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.channelProfileId
                      ? 'Generate an idea based on your channel profile'
                      : niche
                      ? `Generate an idea for ${NICHE_PRESETS[niche as keyof typeof NICHE_PRESETS]?.name || niche}`
                      : 'Select a niche above, or generate a random idea'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateIdea}
                  disabled={generatingIdea}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:from-purple-500 hover:to-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingIdea ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Wand2 className="h-4 w-4" /> Generate Idea</>
                  )}
                </button>
              </div>
            </div>

            {/* ── Right: Content ── */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 flex flex-col">
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-white mb-0.5">Content</h3>
                <p className="text-xs text-gray-500">Enter your video title, describe the topic, and pick a duration</p>
              </div>

              {/* Title */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Video Title (optional)</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., How to Build a Successful YouTube Channel"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring focus:ring-brand-500/20 transition"
                />
              </div>

              {/* Prompt */}
              <div className="flex-1 flex flex-col mb-4">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Video Topic / Prompt <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.prompt}
                  onChange={e => setForm({ ...form, prompt: e.target.value })}
                  placeholder="Describe the topic for your long-form video. Be specific about the key points you want to cover..."
                  className="w-full flex-1 min-h-[160px] rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring focus:ring-brand-500/20 transition resize-none"
                />
                <p className="text-xs text-gray-500 mt-1.5">{form.prompt.length} / 2000 characters</p>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Duration</label>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {DURATIONS.map(duration => (
                    <button
                      key={duration.value}
                      onClick={() => setForm({ ...form, durationMinutes: duration.value })}
                      className={`rounded-lg border p-2.5 text-center transition ${
                        form.durationMinutes === duration.value
                          ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <div className="text-sm font-semibold">{duration.label}</div>
                      <div className="text-[10px] mt-0.5">{duration.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleGenerateOutline}
              disabled={form.prompt.length < 10 || generatingOutline}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingOutline ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Outline...
                </>
              ) : (
                <>
                  <LayoutList className="h-4 w-4" />
                  Generate Plan
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Step 2: Plan & Outline (THE NEW PLAN MODE)                         */}
      {/* ================================================================== */}
      {step === 2 && outline && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Video Outline</h2>
              <p className="text-sm text-gray-400 mt-1">
                {outline.segments.length} segments &middot;{' '}
                {Math.round(totalOutlineDuration / 60)} min total &middot;{' '}
                Edit, reorder, or remove segments before generating
              </p>
            </div>
            <button
              onClick={handleGenerateOutline}
              disabled={generatingOutline}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
            >
              {generatingOutline ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Regenerate
            </button>
          </div>

          {/* Segments List */}
          <div className="space-y-3">
            {outline.segments.map((segment, idx) => {
              const isEditing = editingSegmentIndex === idx
              const isExpanded = expandedSegment === idx

              return (
                <div
                  key={idx}
                  className={`rounded-xl border transition ${
                    isEditing
                      ? 'border-brand-500/50 bg-brand-500/5'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  {/* Segment Header */}
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveSegment(idx, 'up')}
                        disabled={idx === 0}
                        className="text-gray-500 hover:text-white disabled:opacity-20 transition"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveSegment(idx, 'down')}
                        disabled={idx === outline.segments.length - 1}
                        className="text-gray-500 hover:text-white disabled:opacity-20 transition"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 text-sm font-bold flex-shrink-0">
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={segment.title}
                          onChange={e => updateSegment(idx, { title: e.target.value })}
                          className="w-full bg-transparent border-b border-brand-500 text-white font-medium focus:outline-none pb-1"
                          autoFocus
                        />
                      ) : (
                        <h3 className="text-sm font-medium text-white truncate">{segment.title}</h3>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{segment.description}</p>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {isEditing ? (
                        <input
                          type="number"
                          value={segment.durationSeconds}
                          onChange={e => updateSegment(idx, { durationSeconds: parseInt(e.target.value) || 30 })}
                          className="w-14 bg-transparent border-b border-brand-500 text-white text-center focus:outline-none"
                          min={10}
                          max={600}
                        />
                      ) : (
                        <span>{segment.durationSeconds}s</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setExpandedSegment(isExpanded ? null : idx)}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingSegmentIndex(isEditing ? null : idx)}
                        className={`p-1.5 rounded-lg transition ${
                          isEditing
                            ? 'text-brand-400 bg-brand-500/20'
                            : 'text-gray-500 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteSegment(idx)}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {(isExpanded || isEditing) && (
                    <div className="border-t border-white/5 p-4 space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Description</label>
                        {isEditing ? (
                          <textarea
                            value={segment.description}
                            onChange={e => updateSegment(idx, { description: e.target.value })}
                            rows={2}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                          />
                        ) : (
                          <p className="text-sm text-gray-300">{segment.description}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Talking Points</label>
                        <ul className="space-y-1">
                          {segment.talkingPoints.map((point, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-2">
                              <span className="text-brand-400 mt-0.5">•</span>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={point}
                                  onChange={e => {
                                    const newPoints = [...segment.talkingPoints]
                                    newPoints[pIdx] = e.target.value
                                    updateSegment(idx, { talkingPoints: newPoints })
                                  }}
                                  className="flex-1 bg-transparent border-b border-white/10 text-sm text-white focus:border-brand-500 focus:outline-none pb-0.5"
                                />
                              ) : (
                                <span className="text-sm text-gray-300">{point}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Visual Suggestion</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={segment.visualSuggestion}
                            onChange={e => updateSegment(idx, { visualSuggestion: e.target.value })}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                          />
                        ) : (
                          <p className="text-sm text-gray-400 italic">{segment.visualSuggestion}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add Segment Button */}
          <button
            onClick={addSegment}
            className="w-full rounded-xl border border-dashed border-white/20 p-4 text-center text-sm text-gray-400 hover:border-brand-500/50 hover:text-brand-400 hover:bg-brand-500/5 transition"
          >
            <Plus className="h-4 w-4 inline mr-2" />
            Add Segment
          </button>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              Approve Plan
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Step 3: Settings & Style                                           */}
      {/* ================================================================== */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-3">
              {ASPECTS.map(aspect => (
                <button
                  key={aspect.value}
                  onClick={() => setForm({ ...form, aspectRatio: aspect.value })}
                  className={`rounded-lg border p-4 text-center transition ${
                    form.aspectRatio === aspect.value
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <div className="text-lg font-semibold">{aspect.label}</div>
                  <div className="text-xs mt-1">{aspect.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Background Music */}
          <MusicSelector
            value={form.bgMusicTrack}
            volume={form.bgMusicVolume}
            onTrackChange={(t) => setForm({ ...form, bgMusicTrack: t })}
            onVolumeChange={(v) => setForm({ ...form, bgMusicVolume: v })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">Visual Style</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {VIDEO_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setForm({ ...form, style: style.id })}
                  className={`rounded-xl border p-4 text-left transition ${
                    form.style === style.id
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg mb-3" style={{ backgroundColor: style.color }} />
                  <p className="text-sm font-medium text-white">{style.name}</p>
                  <p className="text-xs text-gray-400">{style.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => setStep(4)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition">
              Next Step <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Step 4: Voice & Options                                            */}
      {/* ================================================================== */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">AI Voice</label>
            {(() => {
              const availableVoices = LANGUAGE_VOICE_MAP[form.language] || []
              const filteredVoices = VOICES.filter(v => availableVoices.includes(v.id))

              if (filteredVoices.length === 0) {
                return (
                  <>
                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 mb-4">
                      <p className="text-sm text-yellow-400">
                        Voices for {SUPPORTED_LANGUAGES.find(l => l.code === form.language)?.name} coming soon!
                        Using English voices as temporary fallback.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {VOICES.map((voice) => (
                        <button
                          key={voice.id}
                          onClick={() => setForm({ ...form, voiceId: voice.id })}
                          className={`flex items-center gap-3 rounded-lg border p-4 text-left transition ${
                            form.voiceId === voice.id
                              ? 'border-brand-500 bg-brand-500/10'
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <Mic className={`h-5 w-5 flex-shrink-0 ${form.voiceId === voice.id ? 'text-brand-400' : 'text-gray-500'}`} />
                          <span className="text-sm text-white">{voice.name}</span>
                          {form.voiceId === voice.id && <Check className="h-4 w-4 text-brand-400 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </>
                )
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredVoices.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setForm({ ...form, voiceId: voice.id })}
                      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition ${
                        form.voiceId === voice.id
                          ? 'border-brand-500 bg-brand-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <Mic className={`h-5 w-5 flex-shrink-0 ${form.voiceId === voice.id ? 'text-brand-400' : 'text-gray-500'}`} />
                      <span className="text-sm text-white">{voice.name}</span>
                      {form.voiceId === voice.id && <Check className="h-4 w-4 text-brand-400 ml-auto" />}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(3)} className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => setStep(5)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition">
              Review <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Step 5: Review & Generate                                          */}
      {/* ================================================================== */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Video Summary</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Title</dt><dd className="text-white mt-1">{form.title || form.prompt.substring(0, 50) + '...'}</dd></div>
              <div><dt className="text-gray-500">Duration</dt><dd className="text-white mt-1">{form.durationMinutes} minutes</dd></div>
              <div><dt className="text-gray-500">Segments</dt><dd className="text-white mt-1">{outline?.segments.length || '—'} segments</dd></div>
              <div><dt className="text-gray-500">AI Clip Ratio</dt><dd className="text-white mt-1">{Math.round(form.aiClipRatio * 100)}%</dd></div>
              <div><dt className="text-gray-500">Aspect Ratio</dt><dd className="text-white mt-1">{form.aspectRatio}</dd></div>
              <div><dt className="text-gray-500">Style</dt><dd className="text-white mt-1 capitalize">{form.style}</dd></div>
              <div><dt className="text-gray-500">Language</dt><dd className="text-white mt-1">{SUPPORTED_LANGUAGES.find(l => l.code === form.language)?.name}</dd></div>
              <div><dt className="text-gray-500">Voice</dt><dd className="text-white mt-1">{VOICES.find(v => v.id === form.voiceId)?.name}</dd></div>
            </dl>
          </div>

          {/* Outline Preview */}
          {outline && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Approved Outline</h3>
              <div className="space-y-2">
                {outline.segments.map((seg, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 rounded bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-white flex-1 truncate">{seg.title}</span>
                    <span className="text-gray-500 text-xs flex-shrink-0">{seg.durationSeconds}s</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Cost Estimate</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-brand-400">{estimatedCost.credits} Credits</div>
                <div className="text-xs text-gray-400 mt-1">Deducted on completion</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-400">${(estimatedCost.cents / 100).toFixed(2)}</div>
                <div className="text-xs text-gray-400 mt-1">Estimated API cost</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(4)} className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                <><Send className="h-4 w-4" /> Generate Video</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
