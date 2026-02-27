'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Flame, Heart, Laugh, Brain, Trophy, Leaf, Users, Star, Pen, Sparkles,
  Cpu, TrendingUp, Dumbbell, GraduationCap, Briefcase, HeartPulse,
  ChefHat, Gamepad2, Plane, Gem,
  Send, Loader2, AlignLeft, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  QUOTE_CATEGORIES,
  SUPPORTED_LANGUAGES,
} from '@/lib/constants'

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Flame, Heart, Laugh, Brain, Trophy, Leaf, Users, Star, Pen, Sparkles,
  Cpu, TrendingUp, Dumbbell, GraduationCap, Briefcase, HeartPulse,
  ChefHat, Gamepad2, Plane, Gem,
}

const QUOTE_LENGTHS = [
  { value: 'short', label: 'Short', desc: '1-2 lines', words: '10-30 words' },
  { value: 'medium', label: 'Medium', desc: '3-5 lines', words: '30-80 words' },
  { value: 'long', label: 'Long', desc: '5-10 lines', words: '80-150 words' },
]

export default function CreateQuotePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    category: QUOTE_CATEGORIES[0].id as string,
    prompt: '',
    language: 'hi',
    quoteLength: 'medium',
  })

  const canSubmit = form.category && (form.category !== 'custom' || form.prompt.trim().length > 0)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: form.prompt || form.category,
          category: form.category,
          language: form.language,
          quoteLength: form.quoteLength,
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

  const selectedCat = QUOTE_CATEGORIES.find((c) => c.id === form.category)

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 pb-5 border-b border-white/[0.06]">
        <Link
          href="/quotes"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Quotes
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">Create New Quote</h1>
        <p className="text-sm text-gray-500 mt-1">Generate AI-powered quotes in any language</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Category & Context */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Quote Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {QUOTE_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICON_MAP[cat.icon]
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat.id })}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      form.category === cat.id
                        ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0" />}
                    <span className="truncate text-xs">{cat.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom Topic / Additional Context */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {form.category === 'custom'
                ? 'What should the quote be about? *'
                : 'Additional context (optional)'}
            </label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value.slice(0, 500) })}
              className="w-full min-h-[120px] rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
              placeholder="e.g., Never giving up on your dreams, The beauty of nature..."
            />
            <p className="text-xs text-gray-500 mt-1">{form.prompt.length}/500 characters</p>
          </div>
        </div>

        {/* RIGHT — Length, Language & Submit */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
            {/* Quote Length */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                <span className="flex items-center gap-1.5"><AlignLeft className="h-4 w-4" /> Quote Length</span>
              </label>
              <div className="flex gap-3">
                {QUOTE_LENGTHS.map((len) => (
                  <button
                    key={len.value}
                    type="button"
                    onClick={() => setForm({ ...form, quoteLength: len.value })}
                    className={`flex-1 rounded-lg border px-4 py-3 text-center transition ${
                      form.quoteLength === len.value
                        ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold">{len.label}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{len.desc}</p>
                    <p className="text-[10px] text-gray-600">{len.words}</p>
                  </button>
                ))}
              </div>
            </div>

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

          {/* Summary Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Category</span>
                <span className="text-white font-medium flex items-center gap-1.5">
                  {selectedCat && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedCat.color }} />
                  )}
                  {selectedCat?.name || form.category}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Length</span>
                <span className="text-white font-medium capitalize">{form.quoteLength}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Language</span>
                <span className="text-white font-medium">
                  {SUPPORTED_LANGUAGES.find((l) => l.code === form.language)?.flag}{' '}
                  {SUPPORTED_LANGUAGES.find((l) => l.code === form.language)?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Variations</span>
                <span className="text-white font-medium">5 quotes</span>
              </div>
              <div className="border-t border-white/[0.06] pt-2 mt-2 flex justify-between">
                <span className="text-gray-500">Cost</span>
                <span className="text-brand-400 font-semibold">1 credit</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-sm font-semibold text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-brand-500/25"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Send className="h-4 w-4" /> Generate Quote</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
