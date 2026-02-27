'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, Mic, Clock, Monitor, Send,
  ArrowLeft, ArrowRight, Check, Loader2, Film, Wand2,
  FileText, Ratio,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { SUPPORTED_LANGUAGES, LANGUAGE_VOICE_MAP, NICHE_PRESETS } from '@/lib/constants'

const NICHE_ORDER = ['motivation', 'tech', 'finance', 'fitness', 'education', 'business', 'health', 'cooking', 'gaming', 'travel', 'beauty', 'comedy'] as const
const NICHES = NICHE_ORDER.map(id => ({
  id,
  name: NICHE_PRESETS[id].name,
  color: NICHE_PRESETS[id].primaryColor,
}))

const STYLES = [
  { id: 'cinematic', name: 'Cinematic', color: '#1E293B', desc: 'Movie-like visuals' },
  { id: 'minimal', name: 'Minimal', color: '#F8FAFC', desc: 'Clean & simple' },
  { id: 'energetic', name: 'Energetic', color: '#EF4444', desc: 'High energy vibes' },
  { id: 'dark', name: 'Dark Mode', color: '#0F172A', desc: 'Sleek dark aesthetic' },
  { id: 'neon', name: 'Neon', color: '#A855F7', desc: 'Glowing neon effects' },
  { id: 'warm', name: 'Warm', color: '#F59E0B', desc: 'Warm golden tones' },
  { id: 'corporate', name: 'Corporate', color: '#3B82F6', desc: 'Professional look' },
  { id: 'retro', name: 'Retro', color: '#D97706', desc: 'Vintage vibes' },
  { id: 'nature', name: 'Nature', color: '#22C55E', desc: 'Earthy organic feel' },
  { id: 'urban', name: 'Urban', color: '#64748B', desc: 'City streetwear' },
  { id: 'luxury', name: 'Luxury', color: '#A16207', desc: 'Premium gold & black' },
  { id: 'playful', name: 'Playful', color: '#EC4899', desc: 'Fun & colorful' },
]

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
  { value: 5, label: '5s', desc: 'Ultra short' },
  { value: 10, label: '10s', desc: 'Quick clip' },
  { value: 15, label: '15s', desc: 'Quick hook' },
  { value: 30, label: '30s', desc: 'Standard reel' },
  { value: 60, label: '60s', desc: 'Deep dive' },
]

const ASPECTS = [
  { value: '9:16', label: '9:16', desc: 'Vertical (Reels)' },
  { value: '1:1', label: '1:1', desc: 'Square (Feed)' },
  { value: '16:9', label: '16:9', desc: 'Horizontal' },
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

export default function CreateReelPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedProfile = searchParams.get('profile') || ''

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [scriptVariations, setScriptVariations] = useState<string[]>([])
  const [generatingScript, setGeneratingScript] = useState(false)
  const [niche, setNiche] = useState('')
  const [generatingIdea, setGeneratingIdea] = useState(false)

  const [form, setForm] = useState({
    title: '',
    prompt: '',
    userScript: '',
    style: 'cinematic',
    language: 'hi',
    voiceId: VOICES[0].id,
    durationSeconds: 30,
    aspectRatio: '9:16',
    channelProfileId: preselectedProfile,
    selectedScript: -1, // -1 = none selected yet
  })

  useEffect(() => {
    fetch('/api/profiles')
      .then(r => r.json())
      .then(data => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Build the combined script options list: user script (if any) + AI variations
  const allScriptOptions: { label: string; text: string }[] = []
  if (form.userScript.trim().length > 10) {
    allScriptOptions.push({ label: 'Your Script', text: form.userScript.trim() })
  }
  scriptVariations.forEach((s, i) => {
    allScriptOptions.push({ label: `AI Variation ${i + 1}`, text: s })
  })

  // Get the actual selected script text
  const getSelectedScript = (): string | undefined => {
    if (form.selectedScript >= 0 && form.selectedScript < allScriptOptions.length) {
      return allScriptOptions[form.selectedScript].text
    }
    return undefined
  }

  const handleGenerateIdea = async () => {
    setGeneratingIdea(true)
    try {
      const selectedProfile = profiles.find(p => p.id === form.channelProfileId)
      const res = await fetch('/api/generate-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reel',
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

  const handleGenerateScripts = async () => {
    if (!form.prompt || form.prompt.length < 10) {
      toast.error('Please enter at least 10 characters for your prompt')
      return
    }
    setGeneratingScript(true)
    try {
      const res = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: form.prompt,
          duration: form.durationSeconds,
          language: form.language,
          tone: profiles.find(p => p.id === form.channelProfileId)?.tone || 'professional',
          niche: profiles.find(p => p.id === form.channelProfileId)?.niche || 'general',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || `Request failed with status ${res.status}`)
        return
      }
      if (data.variations && data.variations.length > 0) {
        setScriptVariations(data.variations)
        // Auto-select first option (user script if exists, else first AI variation)
        setForm(prev => ({ ...prev, selectedScript: 0 }))
        setStep(3)
        toast.success('Scripts generated!')
      } else {
        toast.error('Failed to generate scripts')
      }
    } catch {
      toast.error('Script generation failed')
    } finally {
      setGeneratingScript(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const selectedScript = getSelectedScript()
      const res = await fetch('/api/reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || form.prompt.substring(0, 80),
          prompt: form.prompt,
          script: selectedScript || undefined,
          style: form.style,
          language: form.language,
          voiceId: form.voiceId,
          durationSeconds: form.durationSeconds,
          aspectRatio: form.aspectRatio,
          channelProfileId: form.channelProfileId || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create reel')
        return
      }

      toast.success('Reel job submitted! Generation will begin shortly.')
      router.push(`/reels/${data.id}`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { num: 1, label: 'Content & Duration', icon: Sparkles },
    { num: 2, label: 'Style', icon: Monitor },
    { num: 3, label: 'Script Selection', icon: Film },
    { num: 4, label: 'Voice', icon: Mic },
    { num: 5, label: 'Review & Generate', icon: Send },
  ]

  const hasUserScript = form.userScript.trim().length > 10

  return (
    <div className="mx-auto" style={{ maxWidth: step === 1 ? '100%' : '56rem' }}>
      <div className="mb-8 pb-6 border-b border-white/[0.06]">
        <Link
          href="/reels"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Reels
        </Link>
        <h1 className="text-3xl font-bold text-white tracking-tight">Create New Reel</h1>
        <p className="text-sm text-gray-500 mt-2">AI-powered reel generation in 5 steps</p>
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

      {/* Step 1: Content & Duration */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Left: Preferences ── */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white mb-0.5">Preferences</h3>
                <p className="text-xs text-gray-500">Choose profile, language, duration & format</p>
              </div>

              {/* Channel Profile */}
              {profiles.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Channel Profile</label>
                  <select
                    value={form.channelProfileId}
                    onChange={(e) => {
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
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  >
                    <option value="">No profile — use defaults</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.niche})</option>
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

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Duration</span>
                </label>
                <div className="flex gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setForm({ ...form, durationSeconds: d.value })}
                      className={`flex-1 rounded-lg border px-2 py-2 text-center transition ${
                        form.durationSeconds === d.value
                          ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <p className="text-sm font-bold">{d.label}</p>
                      <p className="text-[10px] text-gray-500">{d.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  <span className="flex items-center gap-1.5"><Ratio className="h-3.5 w-3.5" /> Aspect Ratio</span>
                </label>
                <div className="flex gap-2">
                  {ASPECTS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setForm({ ...form, aspectRatio: a.value })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-center transition ${
                        form.aspectRatio === a.value
                          ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <p className="text-sm font-bold">{a.label}</p>
                      <p className="text-[10px] text-gray-500">{a.desc}</p>
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
                <p className="text-xs text-gray-500">Enter your reel topic and optionally your own script</p>
              </div>

              {/* Title */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Reel Title (optional)</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  placeholder="e.g. 5 AI Tools You Need in 2025"
                />
              </div>

              {/* Prompt */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">What&apos;s your reel about? *</label>
                <textarea
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  className="w-full min-h-[120px] rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                  placeholder="Describe your reel topic in detail. The more context you provide, the better the AI can generate a script."
                />
                <p className="text-xs text-gray-500 mt-1">{form.prompt.length}/10000 characters</p>
              </div>

              {/* User Script (optional) */}
              <div className="flex-1 flex flex-col">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Your Script (optional)
                  </span>
                </label>
                <textarea
                  value={form.userScript}
                  onChange={(e) => setForm({ ...form, userScript: e.target.value })}
                  className="w-full flex-1 min-h-[120px] rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                  placeholder={"Paste your own script here if you have one. It will appear as an option in Step 3 alongside AI-generated scripts.\n\nLeave empty to use only AI-generated scripts."}
                />
                {hasUserScript && (
                  <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Your script will be available in script selection
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!form.prompt || form.prompt.length < 10}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Style <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Style */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">Visual Style</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {STYLES.map((style) => (
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

          {/* Info about user script */}
          {hasUserScript && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
              <p className="text-sm text-green-400">
                You have your own script ready. You can generate AI variations too, or skip directly to script selection.
              </p>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="flex items-center gap-3">
              {/* Skip to script selection if user has their own script */}
              {hasUserScript && (
                <button
                  onClick={() => {
                    // Auto-select user script (index 0) and go to step 3
                    setForm(prev => ({ ...prev, selectedScript: 0 }))
                    setStep(3)
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition"
                >
                  <FileText className="h-4 w-4" /> Use My Script
                </button>
              )}
              <button
                onClick={handleGenerateScripts}
                disabled={generatingScript}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
              >
                {generatingScript ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating Scripts...</>
                ) : (
                  <>Generate Scripts <Sparkles className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Script Selection */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Select a Script</label>
            <p className="text-xs text-gray-500 mb-4">
              {hasUserScript && scriptVariations.length > 0
                ? 'Choose your own script or one of the AI-generated variations'
                : hasUserScript
                ? 'Your script is ready. You can also generate AI variations.'
                : 'Choose from the AI-generated script variations'}
            </p>
            <div className="space-y-4">
              {allScriptOptions.map((option, i) => (
                <button
                  key={i}
                  onClick={() => setForm({ ...form, selectedScript: i })}
                  className={`w-full rounded-xl border p-5 text-left transition ${
                    form.selectedScript === i
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-medium ${
                      option.label === 'Your Script' ? 'text-green-400' : 'text-brand-400'
                    }`}>
                      {option.label === 'Your Script' && <FileText className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />}
                      {option.label}
                    </span>
                    {form.selectedScript === i && <Check className="h-5 w-5 text-brand-400" />}
                  </div>
                  <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{option.text}</p>
                </button>
              ))}

              {/* Show message if no scripts at all */}
              {allScriptOptions.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
                  <Film className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 mb-1">No scripts available</p>
                  <p className="text-xs text-gray-500">Go back and generate AI scripts, or add your own script in Step 1.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateScripts}
                disabled={generatingScript}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition disabled:opacity-50"
              >
                {generatingScript ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Wand2 className="h-4 w-4" /> {scriptVariations.length > 0 ? 'Regenerate' : 'Generate AI Scripts'}</>
                )}
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={form.selectedScript < 0 || form.selectedScript >= allScriptOptions.length}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Voice <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Voice */}
      {step === 4 && (
        <div className="space-y-8">
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

          {/* Script preview */}
          {getSelectedScript() && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Selected Script Preview
              </p>
              <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed line-clamp-4">
                {getSelectedScript()}
              </p>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => setStep(5)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition">
              Review <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Review & Submit */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/10">
            <div className="p-5">
              <p className="text-xs text-gray-400 mb-1">Title</p>
              <p className="text-white font-medium">{form.title || form.prompt.substring(0, 80)}</p>
            </div>
            <div className="p-5">
              <p className="text-xs text-gray-400 mb-1">Prompt</p>
              <p className="text-sm text-gray-300">{form.prompt}</p>
            </div>
            {getSelectedScript() && (
              <div className="p-5">
                <p className="text-xs text-gray-400 mb-1">
                  Selected Script
                  {form.selectedScript < allScriptOptions.length && (
                    <span className="ml-2 text-gray-500">({allScriptOptions[form.selectedScript]?.label})</span>
                  )}
                </p>
                <p className="text-sm text-gray-300 whitespace-pre-line">{getSelectedScript()}</p>
              </div>
            )}
            <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Style</p>
                <p className="text-white capitalize">{form.style}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Language</p>
                <p className="text-white">{SUPPORTED_LANGUAGES.find(l => l.code === form.language)?.name || 'English'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Voice</p>
                <p className="text-white text-sm">{VOICES.find(v => v.id === form.voiceId)?.name || 'Default'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Duration</p>
                <p className="text-white">{form.durationSeconds}s</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Aspect Ratio</p>
                <p className="text-white">{form.aspectRatio}</p>
              </div>
            </div>
            {form.channelProfileId && (
              <div className="p-5">
                <p className="text-xs text-gray-400 mb-1">Channel Profile</p>
                <p className="text-white">{profiles.find(p => p.id === form.channelProfileId)?.name || 'Selected'}</p>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-brand-500/10 border border-brand-500/20 p-4">
            <p className="text-sm text-brand-400">
              <strong>Cost:</strong> {form.durationSeconds <= 15 ? '1 credit' : form.durationSeconds <= 30 ? '2 credits' : '3 credits'} or 1 job from your monthly quota.
              Estimated generation time: 2-5 minutes.
            </p>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(4)} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-sm font-semibold text-white hover:bg-brand-500 transition disabled:opacity-50 shadow-lg hover:shadow-brand-500/25"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
              ) : (
                <><Send className="h-4 w-4" /> Generate Reel</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
