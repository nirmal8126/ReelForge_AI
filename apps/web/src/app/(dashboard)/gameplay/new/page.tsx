'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Joystick, Send, Loader2, Palette, Gauge, Clock, Monitor,
  Music, Type, Eye, MessageSquare, Wand2, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TEMPLATES = [
  { id: 'ENDLESS_RUNNER', name: 'Endless Runner', desc: 'Isometric 3D path — dodge obstacles, collect coins', icon: '🏃', color: '#00F5FF' },
  { id: 'BALL_MAZE', name: 'Ball Maze', desc: 'Top-down maze with 3D walls — navigate to exit', icon: '🔵', color: '#FF00FF' },
  { id: 'OBSTACLE_TOWER', name: 'Obstacle Tower', desc: 'Vertical scrolling — climb past platforms & traps', icon: '🏗️', color: '#FFD700' },
  { id: 'COLOR_SWITCH', name: 'Color Switch', desc: 'Neon glow — pass through matching color gates', icon: '🌈', color: '#FF6B9D' },
]

const THEMES = [
  { id: 'neon', name: 'Neon', colors: ['#0A0A1A', '#00F5FF', '#FF00FF', '#FFD700'] },
  { id: 'pastel', name: 'Pastel', colors: ['#FFF5F5', '#FFB3BA', '#BAFFC9', '#BAE1FF'] },
  { id: 'retro', name: 'Retro', colors: ['#1A1A2E', '#E94560', '#533483', '#0F3460'] },
  { id: 'dark', name: 'Dark', colors: ['#0D1117', '#58A6FF', '#BC8CFF', '#3FB950'] },
  { id: 'candy', name: 'Candy', colors: ['#FFE4E1', '#FF6B9D', '#C44AFF', '#51CF66'] },
]

const DIFFICULTIES = [
  { id: 'easy', name: 'Easy', color: '#4ADE80' },
  { id: 'medium', name: 'Medium', color: '#FBBF24' },
  { id: 'hard', name: 'Hard', color: '#F87171' },
  { id: 'insane', name: 'Insane', color: '#C084FC' },
]

const DURATIONS = [15, 30, 45, 60]
const ASPECT_RATIOS = [
  { id: '9:16', name: '9:16', desc: 'Shorts/Reels' },
  { id: '16:9', name: '16:9', desc: 'YouTube' },
  { id: '1:1', name: '1:1', desc: 'Instagram' },
]
const MUSIC_STYLES = ['upbeat', 'chill', 'intense', 'none']

export default function CreateGameplayPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [generatingIdea, setGeneratingIdea] = useState(false)

  const [form, setForm] = useState({
    template: 'ENDLESS_RUNNER',
    theme: 'neon',
    difficulty: 'medium',
    duration: 30,
    aspectRatio: '9:16',
    musicStyle: 'upbeat',
    gameTitle: '',
    showScore: true,
    ctaText: '',
  })

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gameplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          gameTitle: form.gameTitle || undefined,
          ctaText: form.ctaText || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create gameplay video')
        return
      }
      toast.success('Gameplay video generation started!')
      router.push(`/gameplay/${data.id}`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateIdea = async () => {
    setGeneratingIdea(true)
    try {
      const res = await fetch('/api/gameplay/generate-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: form.template,
          theme: form.theme,
          difficulty: form.difficulty,
          duration: form.duration,
          musicStyle: form.musicStyle,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate idea')
        return
      }
      setForm((prev) => ({
        ...prev,
        gameTitle: data.gameTitle || '',
        ctaText: data.ctaText || '',
      }))
      toast.success('Idea generated!')
    } catch {
      toast.error('Failed to generate idea')
    } finally {
      setGeneratingIdea(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <Link href="/gameplay" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to Gameplay Videos
      </Link>
      <div className="mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Create 3D Gameplay Video</h1>
            <p className="text-sm text-gray-500 mt-1">Generate satisfying animated gameplay videos for Shorts, Reels & TikTok</p>
          </div>
          <button
            type="button"
            onClick={handleGenerateIdea}
            disabled={generatingIdea || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:from-purple-500 hover:to-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/20"
          >
            {generatingIdea ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Wand2 className="h-4 w-4" /> Generate Idea</>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Template & Game Settings */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
          <div className="flex items-center gap-2 mb-1">
            <Joystick className="h-5 w-5 text-brand-400" />
            <h2 className="text-base font-semibold text-white">Game Template</h2>
          </div>

          {/* Template Picker */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Choose Template</label>
            <div className="grid grid-cols-2 gap-2.5">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setForm({ ...form, template: tmpl.id })}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                    form.template === tmpl.id
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ backgroundColor: tmpl.color + '20' }}
                  >
                    {tmpl.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium ${form.template === tmpl.id ? 'text-brand-400' : 'text-gray-300'}`}>
                      {tmpl.name}
                    </span>
                    <span className="block text-[11px] text-gray-500 leading-tight">{tmpl.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
              <Palette className="h-3.5 w-3.5" /> Color Theme
            </label>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm({ ...form, theme: t.id })}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.theme === t.id
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500 text-brand-400'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div className="flex gap-0.5">
                    {t.colors.map((c, i) => (
                      <span key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
              <Gauge className="h-3.5 w-3.5" /> Difficulty
            </label>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setForm({ ...form, difficulty: d.id })}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.difficulty === d.id
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500 text-brand-400'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          {/* Duration + Aspect Ratio */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
                <Clock className="h-3.5 w-3.5" /> Duration
              </label>
              <div className="flex gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm({ ...form, duration: d })}
                    className={`flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition text-center ${
                      form.duration === d
                        ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500 text-brand-400'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
                <Monitor className="h-3.5 w-3.5" /> Aspect Ratio
              </label>
              <div className="flex gap-1.5">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => setForm({ ...form, aspectRatio: ar.id })}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-center transition ${
                      form.aspectRatio === ar.id
                        ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <span className={`block text-sm font-medium ${form.aspectRatio === ar.id ? 'text-brand-400' : 'text-gray-300'}`}>
                      {ar.name}
                    </span>
                    <span className="block text-[10px] text-gray-500">{ar.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right — Style & Customization */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-5 h-5 rounded bg-brand-500/20 flex items-center justify-center text-xs text-brand-400">
              ✦
            </span>
            <h2 className="text-base font-semibold text-white">Customization</h2>
          </div>

          {/* Music Style */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
              <Music className="h-3.5 w-3.5" /> Music Style
            </label>
            <div className="flex flex-wrap gap-2">
              {MUSIC_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setForm({ ...form, musicStyle: style })}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition capitalize ${
                    form.musicStyle === style
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500 text-brand-400'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Game Title */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
              <Type className="h-3.5 w-3.5" /> Game Title
              <span className="text-gray-600 ml-0.5">(optional)</span>
            </label>
            <input
              type="text"
              value={form.gameTitle}
              onChange={(e) => setForm({ ...form, gameTitle: e.target.value.slice(0, 100) })}
              className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              placeholder="e.g., Ball Runner 3D"
            />
          </div>

          {/* Show Score Toggle */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
              <Eye className="h-3.5 w-3.5" /> Show Score Counter
            </label>
            <div className="flex gap-2">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setForm({ ...form, showScore: val })}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    form.showScore === val
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500 text-brand-400'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {val ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {/* CTA Text */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
              <MessageSquare className="h-3.5 w-3.5" /> CTA Text
              <span className="text-gray-600 ml-0.5">(optional)</span>
            </label>
            <input
              type="text"
              value={form.ctaText}
              onChange={(e) => setForm({ ...form, ctaText: e.target.value.slice(0, 200) })}
              className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              placeholder="e.g., Follow for more gameplay!"
            />
          </div>

          {/* Preview Summary */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview Summary</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Template</span>
                <span className="text-gray-300">{TEMPLATES.find(t => t.id === form.template)?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Theme</span>
                <span className="text-gray-300 capitalize">{form.theme}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="text-gray-300">{form.duration}s ({form.duration * 30} frames)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Format</span>
                <span className="text-gray-300">{form.aspectRatio}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost + Submit */}
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4">
        <p className="text-sm text-gray-400">
          Cost: <span className="text-brand-400 font-medium">{form.duration <= 15 ? 1 : form.duration <= 30 ? 2 : 3} credit{form.duration <= 15 ? '' : 's'}</span>
          <span className="text-gray-600 mx-2">·</span>
          {form.duration}s {TEMPLATES.find(t => t.id === form.template)?.name} video
          <span className="text-gray-600 mx-2">·</span>
          {form.aspectRatio}
        </p>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-sm font-semibold text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-brand-500/25"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
          ) : (
            <><Send className="h-4 w-4" /> Generate Video</>
          )}
        </button>
      </div>
    </div>
  )
}
