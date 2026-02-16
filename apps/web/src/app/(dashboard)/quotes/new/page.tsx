'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Flame, Heart, Laugh, Brain, Trophy, Leaf, Users, Star, Pen, Sparkles,
  Palette, Mic, Send, ArrowLeft, ArrowRight, Check, Loader2, Quote, Type, Image,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  QUOTE_CATEGORIES,
  QUOTE_GRADIENTS,
  QUOTE_FONTS,
  SUPPORTED_LANGUAGES,
} from '@/lib/constants'

/* ── Icon map for category icons ── */
const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Flame,
  Heart,
  Laugh,
  Brain,
  Trophy,
  Leaf,
  Users,
  Star,
  Pen,
  Sparkles,
}

/* ── Voices (same as reels/new) ── */
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

/* ── Text color presets ── */
const TEXT_COLOR_PRESETS = [
  '#FFFFFF', '#000000', '#F59E0B', '#EC4899',
  '#3B82F6', '#22C55E', '#A855F7', '#EF4444',
]

/* ── Aspect ratios ── */
const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1', desc: 'Square' },
  { value: '9:16', label: '9:16', desc: 'Story' },
  { value: '16:9', label: '16:9', desc: 'Cover' },
]

export default function CreateQuotePage() {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [customHex, setCustomHex] = useState('')

  const [form, setForm] = useState({
    category: '',
    prompt: '',
    language: 'hi',
    bgType: 'gradient' as 'gradient' | 'stock' | 'ai',
    bgValue: QUOTE_GRADIENTS[0].colors.join(','),
    textColor: '#FFFFFF',
    fontStyle: 'serif',
    aspectRatio: '1:1',
    voiceId: VOICES[0].id,
  })

  /* ── Submit handler ── */
  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: form.prompt || form.category,
          category: form.category,
          language: form.language,
          bgType: form.bgType,
          bgValue: form.bgValue || undefined,
          textColor: form.textColor,
          fontStyle: form.fontStyle,
          aspectRatio: form.aspectRatio,
          voiceId: form.voiceId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create quote')
        return
      }
      toast.success('Quote generation started!')
      router.push(`/quotes/${data.id}`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  /* ── Step definitions ── */
  const steps = [
    { num: 1, label: 'Topic & Style', icon: Quote },
    { num: 2, label: 'Visual Design', icon: Palette },
    { num: 3, label: 'Voice & Review', icon: Send },
  ]

  /* ── Helper: get gradient style for a gradient entry ── */
  const gradientStyle = (colors: readonly string[]) => ({
    background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
  })

  /* ── Helper: get selected font preview family ── */
  const selectedFont = QUOTE_FONTS.find(f => f.id === form.fontStyle)
  const selectedGradient = QUOTE_GRADIENTS.find(g => g.colors.join(',') === form.bgValue)

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── Header ── */}
      <div className="mb-8 pb-6 border-b border-white/[0.06]">
        <h1 className="text-3xl font-bold text-white tracking-tight">Create New Quote</h1>
        <p className="text-sm text-gray-500 mt-2">Design a beautiful quote image &amp; video in 3 steps</p>
      </div>

      {/* ── Step Progress ── */}
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
              <span className="hidden sm:inline truncate">{s.label}</span>
            </button>
            {i < steps.length - 1 && <div className="w-4 h-px bg-white/10 flex-shrink-0 mx-1" />}
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════
          Step 1: Topic & Style
         ════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Quote Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {QUOTE_CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICON_MAP[cat.icon]
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setForm({ ...form, category: cat.id })}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                        form.category === cat.id
                          ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0" />}
                      <span className="truncate">{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom Topic Textarea */}
            {(form.category === 'custom' || form.category) && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {form.category === 'custom'
                    ? 'What should the quote be about? *'
                    : 'Additional context (optional)'}
                </label>
                <textarea
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value.slice(0, 500) })}
                  className="w-full min-h-[100px] rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                  placeholder="e.g., Never giving up on your dreams, The beauty of nature..."
                />
                <p className="text-xs text-gray-500 mt-1">{form.prompt.length}/500 characters</p>
              </div>
            )}

            {/* Language Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Language</label>
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
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!form.category || (form.category === 'custom' && !form.prompt)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Visual Design <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          Step 2: Visual Design
         ════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-8">
          {/* Background Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Background Type</label>
            <div className="flex gap-3">
              {([
                { id: 'gradient', label: 'Gradient', icon: Palette },
                { id: 'stock', label: 'Stock Photo', icon: Image },
                { id: 'ai', label: 'AI Generated', icon: Sparkles },
              ] as const).map((bt) => (
                <button
                  key={bt.id}
                  type="button"
                  onClick={() => setForm({ ...form, bgType: bt.id, bgValue: bt.id === 'gradient' ? QUOTE_GRADIENTS[0].colors.join(',') : '' })}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                    form.bgType === bt.id
                      ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                  }`}
                >
                  <bt.icon className="h-4 w-4" />
                  {bt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gradient Grid */}
          {form.bgType === 'gradient' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Choose Gradient</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {QUOTE_GRADIENTS.map((g) => {
                  const isSelected = form.bgValue === g.colors.join(',')
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setForm({ ...form, bgValue: g.colors.join(',') })}
                      className={`rounded-xl border p-1.5 transition ${
                        isSelected
                          ? 'border-brand-500 ring-2 ring-brand-500/50'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div
                        className="h-20 rounded-lg"
                        style={gradientStyle(g.colors)}
                      />
                      <p className={`text-xs font-medium mt-1.5 mb-0.5 ${isSelected ? 'text-brand-400' : 'text-gray-400'}`}>
                        {g.name}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stock Photo */}
          {form.bgType === 'stock' && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Image className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-300">Stock photos from Pexels will be matched to your quote theme</p>
                  <p className="text-xs text-gray-500 mt-1">We will automatically find the best matching photo based on your category and topic.</p>
                </div>
              </div>
              <input
                type="text"
                value={form.bgValue}
                onChange={(e) => setForm({ ...form, bgValue: e.target.value })}
                className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                placeholder="Optional: search keyword (e.g., sunset, mountains...)"
              />
            </div>
          )}

          {/* AI Generated */}
          {form.bgType === 'ai' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Describe the background image</label>
              <textarea
                value={form.bgValue}
                onChange={(e) => setForm({ ...form, bgValue: e.target.value })}
                className="w-full min-h-[100px] rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                placeholder="e.g., Beautiful sunset over mountains, Abstract geometric patterns..."
              />
            </div>
          )}

          {/* Text Color */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Text Color</label>
            <div className="flex items-center gap-3 flex-wrap">
              {TEXT_COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, textColor: color })}
                  className={`w-9 h-9 rounded-full border-2 transition flex items-center justify-center ${
                    form.textColor === color
                      ? 'border-brand-500 scale-110'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {form.textColor === color && (
                    <Check className={`h-4 w-4 ${color === '#FFFFFF' || color === '#FFE66D' ? 'text-gray-900' : 'text-white'}`} />
                  )}
                </button>
              ))}
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="text"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && /^#[0-9A-Fa-f]{6}$/.test(customHex)) {
                      setForm({ ...form, textColor: customHex })
                    }
                  }}
                  className="w-24 rounded-lg bg-white/10 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  placeholder="#HEX"
                />
                {/^#[0-9A-Fa-f]{6}$/.test(customHex) && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, textColor: customHex })}
                    className="text-xs text-brand-400 hover:text-brand-300 transition"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Font Style */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Font Style</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUOTE_FONTS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => setForm({ ...form, fontStyle: font.id })}
                  className={`rounded-xl border p-4 text-left transition ${
                    form.fontStyle === font.id
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <Type className={`h-4 w-4 mb-2 ${form.fontStyle === font.id ? 'text-brand-400' : 'text-gray-500'}`} />
                  <p className="text-sm font-medium text-white">{font.name}</p>
                  <p className="text-xs text-gray-400 mb-2">{font.desc}</p>
                  <p
                    className="text-sm text-gray-300 truncate"
                    style={{ fontFamily: font.preview }}
                  >
                    Sample text
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Aspect Ratio</label>
            <div className="flex gap-4">
              {ASPECT_RATIOS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setForm({ ...form, aspectRatio: a.value })}
                  className={`flex-1 rounded-lg border p-4 text-center transition ${
                    form.aspectRatio === a.value
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <p className="text-lg font-bold text-white">{a.label}</p>
                  <p className="text-xs text-gray-400">{a.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              Next: Voice &amp; Review <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          Step 3: Voice & Review
         ════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-8">
          {/* Voice Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">AI Voice</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VOICES.map((voice) => (
                <button
                  key={voice.id}
                  type="button"
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

          {/* Preview Card */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">Preview</label>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div
                className="relative rounded-lg overflow-hidden flex items-center justify-center mx-auto"
                style={{
                  ...(form.bgType === 'gradient' && selectedGradient
                    ? gradientStyle(selectedGradient.colors)
                    : { background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }),
                  width: '100%',
                  maxWidth: form.aspectRatio === '16:9' ? '28rem' : form.aspectRatio === '1:1' ? '20rem' : '14rem',
                  aspectRatio: form.aspectRatio.replace(':', '/'),
                }}
              >
                <p
                  className="text-center px-6 py-4 leading-relaxed"
                  style={{
                    color: form.textColor,
                    fontFamily: selectedFont?.preview || 'Georgia, serif',
                    fontSize: '1.125rem',
                    textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  &ldquo;Your quote will appear here&rdquo;
                </p>
              </div>

              {/* Badges below preview */}
              <div className="flex items-center gap-3 mt-4 justify-center">
                {form.category && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border"
                    style={{
                      borderColor: QUOTE_CATEGORIES.find(c => c.id === form.category)?.color || '#6366F1',
                      color: QUOTE_CATEGORIES.find(c => c.id === form.category)?.color || '#6366F1',
                      backgroundColor: `${QUOTE_CATEGORIES.find(c => c.id === form.category)?.color || '#6366F1'}20`,
                    }}
                  >
                    {QUOTE_CATEGORIES.find(c => c.id === form.category)?.name}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border border-white/10 text-gray-400 bg-white/5">
                  {form.aspectRatio}
                </span>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border border-white/10 text-gray-400 bg-white/5">
                  {selectedFont?.name}
                </span>
              </div>
            </div>
          </div>

          {/* Cost Info */}
          <div className="rounded-lg bg-brand-500/10 border border-brand-500/20 p-4">
            <p className="text-sm text-brand-400">
              <strong>Cost:</strong> 1 credit. Generates both an image (PNG) and short video (MP4) with voiceover.
            </p>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-sm font-semibold text-white hover:bg-brand-500 transition disabled:opacity-50 shadow-lg hover:shadow-brand-500/25"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Send className="h-4 w-4" /> Generate Quote</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
