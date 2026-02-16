'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Mic, Clock, Monitor, Send,
  ArrowLeft, ArrowRight, Loader2, Video, Youtube, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { SUPPORTED_LANGUAGES } from '@/lib/constants'

const STYLES = [
  { id: 'cinematic', name: 'Cinematic', color: '#1E293B', desc: 'Movie-like visuals' },
  { id: 'documentary', name: 'Documentary', color: '#0F766E', desc: 'Educational style' },
  { id: 'energetic', name: 'Energetic', color: '#EF4444', desc: 'High energy vibes' },
  { id: 'corporate', name: 'Corporate', color: '#3B82F6', desc: 'Professional look' },
  { id: 'minimal', name: 'Minimal', color: '#F8FAFC', desc: 'Clean & simple' },
  { id: 'dark', name: 'Dark Mode', color: '#0F172A', desc: 'Sleek dark aesthetic' },
]

const VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah - Professional Female' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam - Professional Male' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte - Energetic Female' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill - Energetic Male' },
]

const DURATIONS = [
  { value: 5, label: '5 min', desc: 'Quick overview' },
  { value: 10, label: '10 min', desc: 'Standard video' },
  { value: 15, label: '15 min', desc: 'Detailed guide' },
  { value: 20, label: '20 min', desc: 'Deep dive' },
  { value: 30, label: '30 min', desc: 'Documentary' },
]

const AI_CLIP_RATIOS = [
  { value: 0.1, label: '10% AI', desc: 'Budget-friendly', cost: '~$1.20' },
  { value: 0.3, label: '30% AI', desc: 'Balanced (Recommended)', cost: '~$2.80' },
  { value: 0.5, label: '50% AI', desc: 'High quality', cost: '~$4.40' },
  { value: 1.0, label: '100% AI', desc: 'Premium', cost: '~$8.40' },
]

const ASPECTS = [
  { value: '16:9', label: '16:9', desc: 'Horizontal (YouTube)' },
  { value: '9:16', label: '9:16', desc: 'Vertical (Shorts)' },
  { value: '1:1', label: '1:1', desc: 'Square (Feed)' },
]

interface Profile {
  id: string
  name: string
  niche: string
  primaryColor: string
  tone: string
}

export default function CreateLongFormPage() {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [estimatedCost, setEstimatedCost] = useState({ credits: 5, cents: 280 })

  const [form, setForm] = useState({
    title: '',
    prompt: '',
    durationMinutes: 10,
    style: 'cinematic',
    language: 'en',
    voiceId: VOICES[0].id,
    aspectRatio: '16:9',
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

  // Calculate estimated cost whenever form changes
  useEffect(() => {
    const creditsCost =
      form.durationMinutes <= 5 ? 3 :
      form.durationMinutes <= 10 ? 5 :
      form.durationMinutes <= 15 ? 7 :
      form.durationMinutes <= 20 ? 9 : 12

    const segmentCount = Math.ceil((form.durationMinutes * 60) / 30)
    const aiSegments = Math.ceil(segmentCount * form.aiClipRatio)
    const estimatedCostCents = Math.ceil(
      (aiSegments * 40) + // RunwayML
      (form.durationMinutes * 3) + // ElevenLabs
      10 // Claude
    )

    setEstimatedCost({ credits: creditsCost, cents: estimatedCostCents })
  }, [form.durationMinutes, form.aiClipRatio])

  const handleSubmit = async () => {
    if (!form.prompt || form.prompt.length < 10) {
      toast.error('Please enter at least 10 characters for your prompt')
      return
    }

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
          aiClipRatio: form.aiClipRatio,
          useStockFootage: form.useStockFootage,
          useStaticVisuals: form.useStaticVisuals,
          publishToYouTube: form.publishToYouTube,
          channelProfileId: form.channelProfileId || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create long-form job')
        return
      }

      toast.success('Long-form video job submitted! Generation will begin shortly.')
      router.push(`/long-form/${data.job.id}`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { num: 1, label: 'Topic & Duration', icon: Sparkles },
    { num: 2, label: 'Generation Settings', icon: Zap },
    { num: 3, label: 'Voice & Style', icon: Mic },
    { num: 4, label: 'Review & Submit', icon: Send },
  ]

  const canProceedStep1 = form.prompt.length >= 10
  const canProceedStep2 = true
  const canProceedStep3 = true

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Create Long-Form Video</h1>
        <p className="text-gray-400 mt-1">AI-powered long-form video generation (5-30 minutes)</p>
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

      {/* Step 1: Topic & Duration */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Video Title (optional)</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., How to Build a Successful YouTube Channel"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 focus:border-brand-500 focus:ring focus:ring-brand-500/20 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video Topic / Prompt <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.prompt}
              onChange={e => setForm({ ...form, prompt: e.target.value })}
              placeholder="Describe the topic for your long-form video. Be specific about the key points you want to cover..."
              rows={5}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 focus:border-brand-500 focus:ring focus:ring-brand-500/20 transition"
            />
            <p className="text-xs text-gray-500 mt-1">{form.prompt.length} / 2000 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Duration</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {DURATIONS.map(duration => (
                <button
                  key={duration.value}
                  onClick={() => setForm({ ...form, durationMinutes: duration.value })}
                  className={`rounded-lg border p-4 text-center transition ${
                    form.durationMinutes === duration.value
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <div className="text-lg font-semibold">{duration.label}</div>
                  <div className="text-xs mt-1">{duration.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Channel Profile (optional)</label>
            <select
              value={form.channelProfileId}
              onChange={e => setForm({ ...form, channelProfileId: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-brand-500 focus:ring focus:ring-brand-500/20 transition"
            >
              <option value="">No profile (use defaults)</option>
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name} ({profile.niche})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => canProceedStep1 && setStep(2)}
              disabled={!canProceedStep1}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Step
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Generation Settings */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              AI Clip Ratio
              <span className="text-xs text-gray-500 ml-2">Higher ratio = better quality, higher cost</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AI_CLIP_RATIOS.map(ratio => (
                <button
                  key={ratio.value}
                  onClick={() => setForm({ ...form, aiClipRatio: ratio.value })}
                  className={`rounded-lg border p-4 text-left transition ${
                    form.aiClipRatio === ratio.value
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold ${form.aiClipRatio === ratio.value ? 'text-brand-400' : 'text-white'}`}>
                      {ratio.label}
                    </span>
                    <span className="text-xs text-gray-500">{ratio.cost}</span>
                  </div>
                  <div className="text-xs text-gray-400">{ratio.desc}</div>
                </button>
              ))}
            </div>
          </div>

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

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.useStockFootage}
                onChange={e => setForm({ ...form, useStockFootage: e.target.checked })}
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-600 focus:ring-brand-500/20"
              />
              <span className="text-sm text-gray-300">Use stock footage (free)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.useStaticVisuals}
                onChange={e => setForm({ ...form, useStaticVisuals: e.target.checked })}
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-600 focus:ring-brand-500/20"
              />
              <span className="text-sm text-gray-300">Use static visuals</span>
            </label>
          </div>

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
              Next Step
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Voice & Style */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Voice</label>
            <select
              value={form.voiceId}
              onChange={e => setForm({ ...form, voiceId: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-brand-500 focus:ring focus:ring-brand-500/20 transition"
            >
              {VOICES.map(voice => (
                <option key={voice.id} value={voice.id}>{voice.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Visual Style</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setForm({ ...form, style: style.id })}
                  className={`rounded-lg border p-4 text-left transition ${
                    form.style === style.id
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className={`font-semibold mb-1 ${form.style === style.id ? 'text-brand-400' : 'text-white'}`}>
                    {style.name}
                  </div>
                  <div className="text-xs text-gray-400">{style.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Language</label>
            <select
              value={form.language}
              onChange={e => setForm({ ...form, language: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-brand-500 focus:ring focus:ring-brand-500/20 transition"
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.publishToYouTube}
              onChange={e => setForm({ ...form, publishToYouTube: e.target.checked })}
              className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-600 focus:ring-brand-500/20"
            />
            <Youtube className="h-4 w-4 text-red-500" />
            <span className="text-sm text-gray-300">Auto-publish to YouTube when complete</span>
          </label>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              Review
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Video Summary</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Title</dt>
                <dd className="text-white mt-1">{form.title || form.prompt.substring(0, 50) + '...'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Duration</dt>
                <dd className="text-white mt-1">{form.durationMinutes} minutes</dd>
              </div>
              <div>
                <dt className="text-gray-500">AI Clip Ratio</dt>
                <dd className="text-white mt-1">{Math.round(form.aiClipRatio * 100)}%</dd>
              </div>
              <div>
                <dt className="text-gray-500">Aspect Ratio</dt>
                <dd className="text-white mt-1">{form.aspectRatio}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Style</dt>
                <dd className="text-white mt-1 capitalize">{form.style}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Language</dt>
                <dd className="text-white mt-1">{SUPPORTED_LANGUAGES.find(l => l.code === form.language)?.name}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Cost Estimate</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-brand-400">{estimatedCost.credits} Credits</div>
                <div className="text-xs text-gray-400 mt-1">Will be deducted on completion</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-400">${(estimatedCost.cents / 100).toFixed(2)}</div>
                <div className="text-xs text-gray-400 mt-1">Estimated API cost</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Create Long-Form Video
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
