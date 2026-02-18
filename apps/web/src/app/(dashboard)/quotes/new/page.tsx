'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Flame, Heart, Laugh, Brain, Trophy, Leaf, Users, Star, Pen, Sparkles,
  Send, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  QUOTE_CATEGORIES,
  SUPPORTED_LANGUAGES,
} from '@/lib/constants'

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Flame, Heart, Laugh, Brain, Trophy, Leaf, Users, Star, Pen, Sparkles,
}

export default function CreateQuotePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    category: QUOTE_CATEGORIES[0].id as string,
    prompt: '',
    language: 'hi',
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

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-white/[0.06]">
        <h1 className="text-3xl font-bold text-white tracking-tight">Create New Quote</h1>
        <p className="text-sm text-gray-500 mt-2">Generate AI-powered quotes in any language</p>
      </div>

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
              className="w-full min-h-[100px] rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
              placeholder="e.g., Never giving up on your dreams, The beauty of nature..."
            />
            <p className="text-xs text-gray-500 mt-1">{form.prompt.length}/500 characters</p>
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

      {/* Cost + Submit */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Cost: <span className="text-brand-400 font-medium">1 credit</span> &middot; Generates 5 variations
        </p>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-sm font-semibold text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-brand-500/25"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
          ) : (
            <><Send className="h-4 w-4" /> Generate Quote</>
          )}
        </button>
      </div>
    </div>
  )
}
