'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { confirmAction } from '@/lib/confirm'
import Link from 'next/link'
import {
  ArrowLeft,
  Save,
  Loader2,
  PlusCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react'

interface Character {
  id: string
  name: string
  description: string | null
  personality: string | null
  voiceId: string | null
  color: string | null
}

interface Series {
  id: string
  name: string
  description: string | null
  targetAudience: string | null
  artStyle: string | null
  narratorVoiceId: string | null
  language: string
  aspectRatio: string
  characters: Character[]
}

const DEFAULT_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']

export default function EditSeriesPage() {
  const params = useParams()
  const router = useRouter()
  const seriesId = params.seriesId as string

  const [series, setSeries] = useState<Series | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [artStyle, setArtStyle] = useState('')
  const [narratorVoiceId, setNarratorVoiceId] = useState('')

  // Character editing state
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null)
  const [editingChar, setEditingChar] = useState<Record<string, { name: string; description: string; personality: string; voiceId: string; color: string }>>({})
  const [savingCharId, setSavingCharId] = useState<string | null>(null)

  // New character form
  const [showNewChar, setShowNewChar] = useState(false)
  const [newChar, setNewChar] = useState({ name: '', description: '', personality: '', voiceId: '', color: DEFAULT_COLORS[0] })
  const [addingChar, setAddingChar] = useState(false)

  useEffect(() => {
    fetch(`/api/cartoon-studio/series/${seriesId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.series) {
          setSeries(data.series)
          setName(data.series.name)
          setDescription(data.series.description || '')
          setTargetAudience(data.series.targetAudience || '')
          setArtStyle(data.series.artStyle || '')
          setNarratorVoiceId(data.series.narratorVoiceId || '')
        }
      })
      .finally(() => setLoading(false))
  }, [seriesId])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/cartoon-studio/series/${seriesId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          targetAudience: targetAudience || undefined,
          artStyle: artStyle || undefined,
          narratorVoiceId: narratorVoiceId || undefined,
        }),
      })
      if (res.ok) {
        toast.success('Series updated')
      } else {
        toast.error('Failed to update series')
      }
    } catch {
      toast.error('Failed to update series')
    } finally {
      setSaving(false)
    }
  }

  function toggleExpand(char: Character) {
    if (expandedCharId === char.id) {
      setExpandedCharId(null)
    } else {
      setExpandedCharId(char.id)
      // Initialize editing state for this character
      if (!editingChar[char.id]) {
        setEditingChar((prev) => ({
          ...prev,
          [char.id]: {
            name: char.name,
            description: char.description || '',
            personality: char.personality || '',
            voiceId: char.voiceId || '',
            color: char.color || DEFAULT_COLORS[0],
          },
        }))
      }
    }
  }

  function updateEditingChar(charId: string, field: string, value: string) {
    setEditingChar((prev) => ({
      ...prev,
      [charId]: { ...prev[charId], [field]: value },
    }))
  }

  async function saveCharacter(charId: string) {
    const data = editingChar[charId]
    if (!data?.name?.trim()) {
      toast.error('Character name is required')
      return
    }

    setSavingCharId(charId)
    try {
      const res = await fetch(`/api/cartoon-studio/series/${seriesId}/characters/${charId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description || undefined,
          personality: data.personality || undefined,
          voiceId: data.voiceId || undefined,
          color: data.color || undefined,
        }),
      })
      if (res.ok) {
        const result = await res.json()
        setSeries((prev) =>
          prev
            ? { ...prev, characters: prev.characters.map((c) => (c.id === charId ? result.character : c)) }
            : prev
        )
        toast.success('Character updated')
        setExpandedCharId(null)
      } else {
        toast.error('Failed to update character')
      }
    } catch {
      toast.error('Failed to update character')
    } finally {
      setSavingCharId(null)
    }
  }

  async function addCharacter() {
    if (!newChar.name.trim()) {
      toast.error('Enter a character name')
      return
    }

    setAddingChar(true)
    try {
      const res = await fetch(`/api/cartoon-studio/series/${seriesId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChar.name,
          description: newChar.description || undefined,
          personality: newChar.personality || undefined,
          voiceId: newChar.voiceId || undefined,
          color: newChar.color || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSeries((prev) => prev ? { ...prev, characters: [...prev.characters, data.character] } : prev)
        setNewChar({ name: '', description: '', personality: '', voiceId: '', color: DEFAULT_COLORS[(series?.characters.length || 0) % DEFAULT_COLORS.length] })
        setShowNewChar(false)
        toast.success('Character added')
      } else {
        toast.error('Failed to add character')
      }
    } catch {
      toast.error('Failed to add character')
    } finally {
      setAddingChar(false)
    }
  }

  async function deleteCharacter(charId: string) {
    const confirmed = await confirmAction({
      title: 'Delete Character?',
      text: 'This character will be removed from the series.',
      confirmText: 'Delete',
      type: 'danger',
    })
    if (!confirmed) return

    try {
      const res = await fetch(`/api/cartoon-studio/series/${seriesId}/characters/${charId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setSeries((prev) => prev ? { ...prev, characters: prev.characters.filter((c) => c.id !== charId) } : prev)
        if (expandedCharId === charId) setExpandedCharId(null)
        toast.success('Character deleted')
      }
    } catch {
      toast.error('Failed to delete character')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  if (!series) {
    return <div className="text-center py-20"><p className="text-gray-400">Series not found</p></div>
  }

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-white/[0.06]">
        <Link
          href={`/cartoon-studio/${seriesId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {series.name}
        </Link>
        <h1 className="text-3xl font-bold text-white tracking-tight">Edit Series</h1>
        <p className="text-sm text-gray-500 mt-2">Update series details and manage characters</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Series Info */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white mb-5">Series Info</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Series Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Target Audience</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Art Style</label>
              <input
                type="text"
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Narrator Voice ID</label>
              <input
                type="text"
                value={narratorVoiceId}
                onChange={(e) => setNarratorVoiceId(e.target.value)}
                placeholder="ElevenLabs voice ID for narrator"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-start pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — Characters */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">Characters ({series.characters.length})</h2>
            <button
              onClick={() => {
                setShowNewChar(true)
                setNewChar({ name: '', description: '', personality: '', voiceId: '', color: DEFAULT_COLORS[series.characters.length % DEFAULT_COLORS.length] })
              }}
              className="inline-flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition"
            >
              <PlusCircle className="h-4 w-4" />
              Add
            </button>
          </div>

          <div className="space-y-2">
            {/* Existing Characters */}
            {series.characters.map((char) => {
              const isExpanded = expandedCharId === char.id
              const edit = editingChar[char.id]

              return (
                <div
                  key={char.id}
                  className="rounded-lg border border-white/10 bg-white/5 overflow-hidden"
                >
                  {/* Collapsed row */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition"
                    onClick={() => toggleExpand(char)}
                  >
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: char.color || '#6366F1' }}
                    >
                      {char.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white">{char.name}</span>
                      {char.personality && (
                        <p className="text-[10px] text-gray-500 truncate">{char.personality}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {char.voiceId && (
                        <span className="text-[10px] text-brand-400 mr-2">Voice set</span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                  </div>

                  {/* Expanded edit form */}
                  {isExpanded && edit && (
                    <div className="border-t border-white/10 p-4 space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Name *</label>
                        <input
                          type="text"
                          value={edit.name}
                          onChange={(e) => updateEditingChar(char.id, 'name', e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Color</label>
                        <div className="flex gap-1.5">
                          {DEFAULT_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => updateEditingChar(char.id, 'color', c)}
                              className={`h-7 w-7 rounded-full transition ${
                                edit.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Description</label>
                        <input
                          type="text"
                          value={edit.description}
                          onChange={(e) => updateEditingChar(char.id, 'description', e.target.value)}
                          placeholder="Physical appearance, age, species..."
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Personality</label>
                        <input
                          type="text"
                          value={edit.personality}
                          onChange={(e) => updateEditingChar(char.id, 'personality', e.target.value)}
                          placeholder="Brave, curious, funny, wise..."
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Voice ID <span className="text-gray-600">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={edit.voiceId}
                          onChange={(e) => updateEditingChar(char.id, 'voiceId', e.target.value)}
                          placeholder="ElevenLabs voice ID"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => deleteCharacter(char.id)}
                          className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedCharId(null)}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveCharacter(char.id)}
                            disabled={savingCharId === char.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
                          >
                            {savingCharId === char.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* New Character Form */}
            {showNewChar && (
              <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-4 space-y-3">
                <span className="text-sm font-medium text-brand-300">New Character</span>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Name *</label>
                  <input
                    type="text"
                    value={newChar.name}
                    onChange={(e) => setNewChar({ ...newChar, name: e.target.value })}
                    placeholder="e.g., Bunny"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Color</label>
                  <div className="flex gap-1.5">
                    {DEFAULT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewChar({ ...newChar, color: c })}
                        className={`h-7 w-7 rounded-full transition ${
                          newChar.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Description</label>
                  <input
                    type="text"
                    value={newChar.description}
                    onChange={(e) => setNewChar({ ...newChar, description: e.target.value })}
                    placeholder="Physical appearance, age, species..."
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Personality</label>
                  <input
                    type="text"
                    value={newChar.personality}
                    onChange={(e) => setNewChar({ ...newChar, personality: e.target.value })}
                    placeholder="Brave, curious, funny, wise..."
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Voice ID <span className="text-gray-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newChar.voiceId}
                    onChange={(e) => setNewChar({ ...newChar, voiceId: e.target.value })}
                    placeholder="ElevenLabs voice ID"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowNewChar(false)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addCharacter}
                    disabled={addingChar}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
                  >
                    {addingChar ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlusCircle className="h-3.5 w-3.5" />
                    )}
                    Add Character
                  </button>
                </div>
              </div>
            )}

            {series.characters.length === 0 && !showNewChar && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
                <p className="text-gray-400 text-sm">No characters yet</p>
                <p className="text-gray-600 text-xs mt-1">Add characters for your episodes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
