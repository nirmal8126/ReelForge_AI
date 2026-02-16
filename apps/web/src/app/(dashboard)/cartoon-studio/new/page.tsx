'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  PlusCircle,
  Trash2,
  Loader2,
  Clapperboard,
} from 'lucide-react'
import Link from 'next/link'
import { SUPPORTED_LANGUAGES } from '@/lib/constants'
import { SearchableSelect } from '@/components/ui/searchable-select'

interface CharacterInput {
  name: string
  description: string
  personality: string
  voiceId: string
  color: string
}

const DEFAULT_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']

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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Series info
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetAudience, setTargetAudience] = useState('kids-7-12')
  const [artStyle, setArtStyle] = useState('cartoon')
  const [language, setLanguage] = useState('hi')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [narratorVoiceId, setNarratorVoiceId] = useState('')

  // Characters
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
    if (field === 'name' && value.trim()) setErrors((prev) => ({ ...prev, characters: '' }))
  }

  async function handleSubmit() {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Series name is required'
    const validChars = characters.filter((c) => c.name.trim())
    if (validChars.length === 0) newErrors.characters = 'Add at least one character with a name'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})

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
          narratorVoiceId: narratorVoiceId || undefined,
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
    <div>
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-white/[0.06]">
        <Link
          href="/cartoon-studio"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cartoon Studio
        </Link>
        <h1 className="text-3xl font-bold text-white tracking-tight">Create New Series</h1>
        <p className="text-sm text-gray-500 mt-2">
          Define your cartoon series and its characters
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Series Info */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white mb-5">Series Info</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Series Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: '' })) }}
                placeholder="e.g., Adventures of Bunny & Fox"
                className={`w-full rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none ${
                  errors.name ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-brand-500'
                }`}
              />
              {errors.name && <p className="text-xs text-red-400 mt-1.5">{errors.name}</p>}
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
                <SearchableSelect
                  value={targetAudience}
                  onChange={setTargetAudience}
                  options={AUDIENCES}
                  placeholder="Select audience"
                  searchPlaceholder="Search audiences..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">Art Style</label>
                <SearchableSelect
                  value={artStyle}
                  onChange={setArtStyle}
                  options={ART_STYLES}
                  placeholder="Select style"
                  searchPlaceholder="Search styles..."
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Language</label>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      language === lang.code
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

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Aspect Ratio</label>
              <div className="flex gap-2">
                {['16:9', '9:16', '1:1'].map((ar) => (
                  <button
                    key={ar}
                    type="button"
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

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">
                Narrator Voice <span className="text-gray-600">(optional)</span>
              </label>
              <SearchableSelect
                value={narratorVoiceId}
                onChange={setNarratorVoiceId}
                options={VOICES.map((v) => ({ value: v.id, label: v.name }))}
                placeholder="No narrator voice"
                searchPlaceholder="Search voices..."
              />
            </div>
          </div>
        </div>

        {/* RIGHT — Characters */}
        <div className={`rounded-xl border bg-white/5 p-5 ${errors.characters ? 'border-red-500/30' : 'border-white/10'}`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Characters ({characters.filter((c) => c.name.trim()).length})</h2>
              {errors.characters && <p className="text-xs text-red-400 mt-1">{errors.characters}</p>}
            </div>
            <button
              onClick={addCharacter}
              className="inline-flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition"
            >
              <PlusCircle className="h-4 w-4" />
              Add
            </button>
          </div>

          <div className="space-y-3">
            {characters.map((char, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
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
                    <label className="text-xs text-gray-500 mb-1 block">Name <span className="text-red-400">*</span></label>
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
                          type="button"
                          onClick={() => updateCharacter(i, 'color', c)}
                          className={`h-7 w-7 rounded-full transition ${
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
                    Voice <span className="text-gray-600">(optional)</span>
                  </label>
                  <SearchableSelect
                    value={char.voiceId}
                    onChange={(val) => updateCharacter(i, 'voiceId', val)}
                    options={VOICES.map((v) => ({ value: v.id, label: v.name }))}
                    placeholder="No voice"
                    searchPlaceholder="Search voices..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Button */}
      <div className="flex justify-end mt-6 pt-6 border-t border-white/[0.06]">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
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
  )
}
