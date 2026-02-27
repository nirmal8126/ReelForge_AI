'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Smile, HelpCircle, Calculator, BookOpen, ArrowLeftRight,
  Send, Loader2, Gamepad2, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  CHALLENGE_TYPES,
  CHALLENGE_CATEGORIES,
  CHALLENGE_DIFFICULTIES,
  CHALLENGE_TEMPLATES,
  CHALLENGE_QUESTION_COUNTS,
  CHALLENGE_TIMER_OPTIONS,
  SUPPORTED_LANGUAGES,
} from '@/lib/constants'

const TYPE_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Smile, HelpCircle, Calculator, BookOpen, ArrowLeftRight,
}

export default function CreateChallengePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    challengeType: CHALLENGE_TYPES[0].id as string,
    category: CHALLENGE_CATEGORIES[0].id as string,
    difficulty: 'medium' as string,
    numQuestions: 3,
    timerSeconds: 5,
    language: 'hi',
    prompt: '',
    templateStyle: 'neon',
    voiceEnabled: false,
  })

  const handleSubmit = async () => {
    if (!form.challengeType || !form.category) return
    setLoading(true)
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create challenge')
        return
      }
      toast.success('Challenge generation started!')
      router.push(`/challenges/${data.id}`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <Link href="/challenges" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to Challenges
      </Link>
      <div className="mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="text-2xl font-bold text-white tracking-tight">Create Challenge Video</h1>
        <p className="text-sm text-gray-500 mt-1">Generate interactive quiz & game reels with AI</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Section — Challenge Setup */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
          <div className="flex items-center gap-2 mb-1">
            <Gamepad2 className="h-5 w-5 text-brand-400" />
            <h2 className="text-base font-semibold text-white">Challenge Setup</h2>
          </div>

          {/* Challenge Type */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Challenge Type</label>
            <div className="grid grid-cols-2 gap-2.5">
              {CHALLENGE_TYPES.map((type) => {
                const Icon = TYPE_ICON_MAP[type.icon]
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setForm({ ...form, challengeType: type.id })}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                      form.challengeType === type.id
                        ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: type.color + '20' }}
                    >
                      {Icon && <Icon className="h-4 w-4" style={{ color: type.color }} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={`block text-sm font-medium ${form.challengeType === type.id ? 'text-brand-400' : 'text-gray-300'}`}>
                        {type.name}
                      </span>
                      <span className="block text-xs text-gray-500">{type.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CHALLENGE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setForm({ ...form, category: cat.id })}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    form.category === cat.id
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500 text-brand-400'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Difficulty</label>
            <div className="flex flex-wrap gap-2">
              {CHALLENGE_DIFFICULTIES.map((diff) => (
                <button
                  key={diff.id}
                  type="button"
                  onClick={() => setForm({ ...form, difficulty: diff.id })}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.difficulty === diff.id
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500 text-brand-400'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: diff.color }}
                  />
                  {diff.name}
                </button>
              ))}
            </div>
          </div>

          {/* Questions + Timer row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Questions</label>
              <div className="flex gap-1.5">
                {CHALLENGE_QUESTION_COUNTS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setForm({ ...form, numQuestions: count })}
                    className={`flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition text-center ${
                      form.numQuestions === count
                        ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500 text-brand-400'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Timer (sec)</label>
              <div className="flex gap-1.5">
                {CHALLENGE_TIMER_OPTIONS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setForm({ ...form, timerSeconds: sec })}
                    className={`flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition text-center ${
                      form.timerSeconds === sec
                        ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500 text-brand-400'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Section — Style & Preferences */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-5 h-5 rounded bg-brand-500/20 flex items-center justify-center text-xs text-brand-400">
              ✦
            </span>
            <h2 className="text-base font-semibold text-white">Style & Preferences</h2>
          </div>

          {/* Visual Template */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Visual Style</label>
            <div className="grid grid-cols-1 gap-2.5">
              {CHALLENGE_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setForm({ ...form, templateStyle: tmpl.id })}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                    form.templateStyle === tmpl.id
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: tmpl.color + '30' }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium ${form.templateStyle === tmpl.id ? 'text-brand-400' : 'text-gray-300'}`}>
                      {tmpl.name}
                    </span>
                    <span className="block text-xs text-gray-500">{tmpl.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Language</label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setForm({ ...form, language: lang.code })}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    form.language === lang.code
                      ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500 text-brand-400'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <span className="text-sm">{lang.flag}</span>
                  {lang.name}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Topic */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Custom Topic
              <span className="text-gray-600 ml-1">(optional)</span>
            </label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value.slice(0, 500) })}
              className="w-full min-h-[100px] rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
              placeholder="e.g., Bollywood 90s movies, Indian history, Science for kids..."
            />
            <p className="text-xs text-gray-500 mt-1">{form.prompt.length}/500 characters</p>
          </div>
        </div>
      </div>

      {/* Cost + Submit */}
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4">
        <p className="text-sm text-gray-400">
          Cost: <span className="text-brand-400 font-medium">{(() => { let c = 1; if (form.numQuestions >= 5) c++; if (form.voiceEnabled) c++; return c; })()} credit{(() => { let c = 1; if (form.numQuestions >= 5) c++; if (form.voiceEnabled) c++; return c > 1 ? 's' : ''; })()}</span>
          <span className="text-gray-600 mx-2">·</span>
          {form.numQuestions} question{form.numQuestions > 1 ? 's' : ''}{form.voiceEnabled ? ' + voice' : ''}
          <span className="text-gray-600 mx-2">·</span>
          ~{form.numQuestions * (10 + form.timerSeconds)}s video
        </p>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-sm font-semibold text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-brand-500/25"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
          ) : (
            <><Send className="h-4 w-4" /> Generate Challenge</>
          )}
        </button>
      </div>
    </div>
  )
}
