'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Sparkles, Mic, Clock, Monitor, Send,
  ArrowLeft, ArrowRight, Check, Loader2, Film,
} from 'lucide-react'
import toast from 'react-hot-toast'

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

  const [form, setForm] = useState({
    title: '',
    prompt: '',
    style: 'cinematic',
    voiceId: VOICES[0].id,
    durationSeconds: 30,
    aspectRatio: '9:16',
    channelProfileId: preselectedProfile,
    selectedScript: 0,
  })

  useEffect(() => {
    fetch('/api/profiles')
      .then(r => r.json())
      .then(data => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

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
          tone: profiles.find(p => p.id === form.channelProfileId)?.tone || 'professional',
          niche: profiles.find(p => p.id === form.channelProfileId)?.niche || 'general',
        }),
      })
      const data = await res.json()
      if (data.variations && data.variations.length > 0) {
        setScriptVariations(data.variations)
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
      const res = await fetch('/api/reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || form.prompt.substring(0, 80),
          prompt: form.prompt,
          script: scriptVariations[form.selectedScript] || undefined,
          style: form.style,
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
    { num: 1, label: 'Topic & Prompt', icon: Sparkles },
    { num: 2, label: 'Style & Settings', icon: Monitor },
    { num: 3, label: 'Script Selection', icon: Film },
    { num: 4, label: 'Voice & Duration', icon: Mic },
    { num: 5, label: 'Review & Submit', icon: Send },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Create New Reel</h1>
        <p className="text-gray-400 mt-1">AI-powered reel generation in 5 steps</p>
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

      {/* Step 1: Topic & Prompt */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Reel Title (optional)</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              placeholder="e.g. 5 AI Tools You Need in 2025"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">What&apos;s your reel about? *</label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              rows={5}
              className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
              placeholder="Describe your reel topic in detail. The more context you provide, the better the AI can generate a script.&#10;&#10;Example: Create a 30-second reel about the top 5 AI tools that every content creator should be using in 2025, with emphasis on free tools that save time."
            />
            <p className="text-xs text-gray-500 mt-1">{form.prompt.length}/2000 characters</p>
          </div>

          {profiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Channel Profile (optional)</label>
              <select
                value={form.channelProfileId}
                onChange={(e) => setForm({ ...form, channelProfileId: e.target.value })}
                className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-3 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              >
                <option value="">No profile — use defaults</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.niche})</option>
                ))}
              </select>
            </div>
          )}

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

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
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
      )}

      {/* Step 3: Script Selection */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">Select a Script Variation</label>
            <div className="space-y-4">
              {scriptVariations.map((script, i) => (
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
                    <span className="text-sm font-medium text-brand-400">Variation {i + 1}</span>
                    {form.selectedScript === i && <Check className="h-5 w-5 text-brand-400" />}
                  </div>
                  <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{script}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => setStep(4)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition">
              Next: Voice & Duration <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Voice & Duration */}
      {step === 4 && (
        <div className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">AI Voice</label>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">Duration</label>
            <div className="flex gap-4">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setForm({ ...form, durationSeconds: d.value })}
                  className={`flex-1 rounded-lg border p-4 text-center transition ${
                    form.durationSeconds === d.value
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <Clock className={`h-5 w-5 mx-auto mb-2 ${form.durationSeconds === d.value ? 'text-brand-400' : 'text-gray-500'}`} />
                  <p className="text-lg font-bold text-white">{d.label}</p>
                  <p className="text-xs text-gray-400">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">Aspect Ratio</label>
            <div className="flex gap-4">
              {ASPECTS.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setForm({ ...form, aspectRatio: a.value })}
                  className={`flex-1 rounded-lg border p-4 text-center transition ${
                    form.aspectRatio === a.value
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <p className="text-lg font-bold text-white">{a.label}</p>
                  <p className="text-xs text-gray-400">{a.desc}</p>
                </button>
              ))}
            </div>
          </div>

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
            {scriptVariations[form.selectedScript] && (
              <div className="p-5">
                <p className="text-xs text-gray-400 mb-1">Selected Script</p>
                <p className="text-sm text-gray-300 whitespace-pre-line">{scriptVariations[form.selectedScript]}</p>
              </div>
            )}
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Style</p>
                <p className="text-white capitalize">{form.style}</p>
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
              <strong>Cost:</strong> 1 credit or 1 reel from your monthly quota.
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
