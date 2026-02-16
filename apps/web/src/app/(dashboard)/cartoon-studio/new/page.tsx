'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  ArrowRight,
  PlusCircle,
  Trash2,
  Loader2,
  Clapperboard,
} from 'lucide-react'
import Link from 'next/link'

interface CharacterInput {
  name: string
  description: string
  personality: string
  voiceId: string
  color: string
}

const DEFAULT_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']

const ART_STYLES = [
  { value: 'cartoon', label: 'Cartoon' },
  { value: 'anime', label: 'Anime' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'comic', label: 'Comic Book' },
  { value: 'pixel', label: 'Pixel Art' },
  { value: '3d', label: '3D Render' },
]

const AUDIENCES = [
  { value: 'kids-3-6', label: 'Kids (3-6)' },
  { value: 'kids-7-12', label: 'Kids (7-12)' },
  { value: 'teens', label: 'Teens (13-17)' },
  { value: 'adults', label: 'Adults (18+)' },
  { value: 'family', label: 'Family (All ages)' },
]

export default function NewSeriesPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step 1: Series info
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetAudience, setTargetAudience] = useState('kids-7-12')
  const [artStyle, setArtStyle] = useState('cartoon')
  const [language, setLanguage] = useState('en')
  const [aspectRatio, setAspectRatio] = useState('16:9')

  // Step 2: Characters
  const [characters, setCharacters] = useState<CharacterInput[]>([
    { name: '', description: '', personality: '', voiceId: '', color: DEFAULT_COLORS[0] },
  ])

  function addCharacter() {
    const nextColor = DEFAULT_COLORS[characters.length % DEFAULT_COLORS.length]
    setCharacters([...characters, { name: '', description: '', personality: '', voiceId: '', color: nextColor }])
  }

  function removeCharacter(index: number) {
    if (characters.length <= 1) return
    setCharacters(characters.filter((_, i) => i !== index))
  }

  function updateCharacter(index: number, field: keyof CharacterInput, value: string) {
    const updated = [...characters]
    updated[index] = { ...updated[index], [field]: value }
    setCharacters(updated)
  }

  async function handleSubmit() {
    const validChars = characters.filter((c) => c.name.trim())
    if (validChars.length === 0) {
      toast.error('Add at least one character with a name')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/cartoon-studio/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          targetAudience,
          artStyle,
          language,
          aspectRatio,
          characters: validChars.map((c) => ({
            name: c.name,
            description: c.description || undefined,
            personality: c.personality || undefined,
            voiceId: c.voiceId || undefined,
            color: c.color || undefined,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to create series')
        return
      }

      const data = await res.json()
      toast.success('Series created!')
      router.push(`/cartoon-studio/${data.series.id}`)
    } catch {
      toast.error('Failed to create series')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/cartoon-studio"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cartoon Studio
        </Link>
        <h1 className="text-2xl font-bold text-white">Create New Series</h1>
        <p className="text-gray-400 text-sm mt-1">
          Define your cartoon series and its characters
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[1, 2].map((s) => (
          <button
            key={s}
            onClick={() => s === 1 ? setStep(1) : name.trim() ? setStep(2) : null}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              step === s
                ? 'bg-brand-600 text-white'
                : step > s
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'bg-white/5 text-gray-500'
            }`}
          >
            <span className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center text-xs">
              {s}
            </span>
            {s === 1 ? 'Series Info' : 'Characters'}
          </button>
        ))}
      </div>

      {/* Step 1: Series Info */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">Series Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Adventures of Bunny & Fox"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this series about? What themes does it explore?"
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Target Audience</label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Art Style</label>
              <select
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                {ART_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="pt">Portuguese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="zh">Chinese</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Aspect Ratio</label>
              <div className="flex gap-2">
                {['16:9', '9:16', '1:1'].map((ar) => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      aspectRatio === ar
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => {
                if (!name.trim()) { toast.error('Enter a series name'); return }
                setStep(2)
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              Next: Add Characters
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Characters */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">
              Add the characters that will appear in your episodes
            </p>
            <button
              onClick={addCharacter}
              className="inline-flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition"
            >
              <PlusCircle className="h-4 w-4" />
              Add Character
            </button>
          </div>

          {characters.map((char, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: char.color || '#6366F1' }}
                  >
                    {char.name ? char.name[0].toUpperCase() : '?'}
                  </div>
                  <span className="text-sm font-medium text-white">
                    Character {i + 1}
                  </span>
                </div>
                {characters.length > 1 && (
                  <button
                    onClick={() => removeCharacter(i)}
                    className="p-1 text-gray-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Name *</label>
                  <input
                    type="text"
                    value={char.name}
                    onChange={(e) => updateCharacter(i, 'name', e.target.value)}
                    placeholder="e.g., Bunny"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Color</label>
                  <div className="flex gap-1.5">
                    {DEFAULT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateCharacter(i, 'color', c)}
                        className={`h-8 w-8 rounded-full transition ${
                          char.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <input
                  type="text"
                  value={char.description}
                  onChange={(e) => updateCharacter(i, 'description', e.target.value)}
                  placeholder="Physical appearance, age, species..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Personality</label>
                <input
                  type="text"
                  value={char.personality}
                  onChange={(e) => updateCharacter(i, 'personality', e.target.value)}
                  placeholder="Brave, curious, funny, wise..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  ElevenLabs Voice ID <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={char.voiceId}
                  onChange={(e) => updateCharacter(i, 'voiceId', e.target.value)}
                  placeholder="Voice ID for this character's dialogue"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          ))}

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clapperboard className="h-4 w-4" />
              )}
              Create Series
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
