'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { NICHE_PRESETS } from '@/lib/constants'
import toast from 'react-hot-toast'

export function CreateProfileDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    platform: 'MULTI',
    niche: '',
    tone: 'PROFESSIONAL',
    primaryColor: '#6366F1',
    hookStyle: 'question',
    musicPreference: 'ambient',
  })

  const handleNicheSelect = (key: string) => {
    const preset = NICHE_PRESETS[key as keyof typeof NICHE_PRESETS]
    if (preset) {
      setForm({
        ...form,
        niche: key,
        tone: preset.tone,
        primaryColor: preset.primaryColor,
        hookStyle: preset.hookStyle,
        musicPreference: preset.music,
      })
      setStep(2)
    }
  }

  const handleSubmit = async () => {
    if (!form.name || !form.niche) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to create profile')
        return
      }

      toast.success('Channel profile created!')
      setOpen(false)
      setStep(1)
      setForm({ name: '', platform: 'MULTI', niche: '', tone: 'PROFESSIONAL', primaryColor: '#6366F1', hookStyle: 'question', musicPreference: 'ambient' })
      router.refresh()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition"
      >
        <Plus className="h-4 w-4" />
        New Profile
      </button>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gray-900 p-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Create Channel Profile</h2>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-brand-500' : 'bg-white/10'}`} />
            ))}
          </div>

          {step === 1 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-4">Choose your niche</h3>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(NICHE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => handleNicheSelect(key)}
                    className={`rounded-lg border p-4 text-left transition ${
                      form.niche === key
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="h-3 w-3 rounded-full mb-2" style={{ backgroundColor: preset.primaryColor }} />
                    <p className="text-sm font-medium text-white">{preset.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{preset.tone.toLowerCase()}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white mb-4">Profile Details</h3>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Channel Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  placeholder="My Tech Channel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Platform</label>
                <select
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                >
                  <option value="MULTI">Multi-Platform</option>
                  <option value="YOUTUBE">YouTube Shorts</option>
                  <option value="INSTAGRAM">Instagram Reels</option>
                  <option value="FACEBOOK">Facebook Reels</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Brand Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="h-10 w-10 rounded cursor-pointer"
                  />
                  <span className="text-sm text-white">{form.primaryColor}</span>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setStep(1)} className="flex-1 rounded-lg bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition">
                  Back
                </button>
                <button onClick={() => setStep(3)} className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition">
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white mb-4">Review & Create</h3>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Channel Name</span>
                  <span className="text-white">{form.name || 'Not set'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Niche</span>
                  <span className="text-white capitalize">{NICHE_PRESETS[form.niche as keyof typeof NICHE_PRESETS]?.name || form.niche}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Platform</span>
                  <span className="text-white capitalize">{form.platform.toLowerCase()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Tone</span>
                  <span className="text-white capitalize">{form.tone.toLowerCase()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Brand Color</span>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded" style={{ backgroundColor: form.primaryColor }} />
                    <span className="text-white">{form.primaryColor}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setStep(2)} className="flex-1 rounded-lg bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition">
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Profile'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
