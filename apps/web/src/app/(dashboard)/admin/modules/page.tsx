'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Shield,
  Loader2,
  Film,
  Quote,
  Gamepad2,
  Joystick,
  Video,
  Clapperboard,
  ImagePlus,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ModuleConfig {
  id: string
  moduleId: string
  moduleName: string
  isFree: boolean
  creditCost: number
  isEnabled: boolean
  updatedAt: string
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-md bg-gray-800 border border-white/10 text-[11px] text-gray-300 whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity shadow-lg z-10">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  )
}

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  reels: Film,
  quotes: Quote,
  challenges: Gamepad2,
  long_form: Video,
  cartoon_studio: Clapperboard,
  gameplay: Joystick,
  image_studio: ImagePlus,
}

export default function AdminModulesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [modules, setModules] = useState<ModuleConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      router.push('/login')
      return
    }
    if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
      router.push('/dashboard')
      toast.error('Super Admin access required')
      return
    }
    fetchModules()
  }, [session, status, router])

  async function fetchModules() {
    try {
      const res = await fetch('/api/admin/modules')
      if (!res.ok) {
        if (res.status === 403) {
          router.push('/dashboard')
          toast.error('Super Admin access required')
          return
        }
        throw new Error('Failed to load')
      }
      const data = await res.json()
      setModules(data.modules)
    } catch {
      toast.error('Failed to load module settings')
    } finally {
      setLoading(false)
    }
  }

  async function updateModule(moduleId: string, updates: Partial<Pick<ModuleConfig, 'isFree' | 'creditCost' | 'isEnabled'>>) {
    setSaving(moduleId)
    try {
      const res = await fetch('/api/admin/modules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, ...updates }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const data = await res.json()

      setModules((prev) =>
        prev.map((m) => (m.moduleId === moduleId ? { ...m, ...data.module } : m))
      )
      toast.success('Module updated')
    } catch {
      toast.error('Failed to update module')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Module Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Super Admin — Manage and configure all modules</p>
          </div>
        </div>
      </div>

      {/* Modules List */}
      <div className="space-y-4">
        {modules.map((mod) => {
          const Icon = MODULE_ICONS[mod.moduleId] || Film
          const isSaving = saving === mod.moduleId

          return (
            <div
              key={mod.moduleId}
              className={`rounded-xl border p-5 transition ${
                mod.isEnabled
                  ? 'border-white/10 bg-white/[0.03]'
                  : 'border-white/[0.04] bg-white/[0.01] opacity-60'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Icon + Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{mod.moduleName}</h3>
                    <p className="text-xs text-gray-500">{mod.moduleId}</p>
                  </div>
                </div>

                {/* Free/Paid Toggle */}
                <div className="flex items-center gap-6">
                  <Tooltip text={mod.isFree ? 'Click to make this module paid — users will need credits' : 'Click to make this module free — no credits required'}>
                    <button
                      onClick={() => updateModule(mod.moduleId, { isFree: !mod.isFree })}
                      disabled={isSaving}
                      className="flex items-center gap-2 group"
                    >
                      {mod.isFree ? (
                        <ToggleRight className="h-7 w-7 text-green-400" />
                      ) : (
                        <ToggleLeft className="h-7 w-7 text-gray-500 group-hover:text-gray-400" />
                      )}
                      <span className={`text-xs font-semibold min-w-[40px] ${mod.isFree ? 'text-green-400' : 'text-gray-400'}`}>
                        {mod.isFree ? 'Free' : 'Paid'}
                      </span>
                    </button>
                  </Tooltip>

                  {/* Credit Cost */}
                  {!mod.isFree && (
                    <Tooltip text="Base credits per use (actual cost varies by duration/options). Deducted when user exceeds quota.">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Credits:</label>
                        <select
                          value={mod.creditCost}
                          onChange={(e) => updateModule(mod.moduleId, { creditCost: parseInt(e.target.value) })}
                          disabled={isSaving}
                          className="rounded-md bg-white/10 border border-white/10 px-2 py-1 text-sm text-white outline-none focus:border-brand-500 w-16"
                        >
                          {[0, 1, 2, 3, 5, 10, 15, 20].map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </Tooltip>
                  )}

                  {/* Enable/Disable */}
                  <Tooltip text={mod.isEnabled ? 'Click to disable — module will be hidden from all users' : 'Click to enable — module will be visible to users'}>
                    <button
                      onClick={() => updateModule(mod.moduleId, { isEnabled: !mod.isEnabled })}
                      disabled={isSaving}
                      className={`text-xs font-medium px-3 py-1.5 rounded-md border transition ${
                        mod.isEnabled
                          ? 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                          : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      {mod.isEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </Tooltip>
                </div>

                {isSaving && <Loader2 className="h-4 w-4 text-brand-400 animate-spin flex-shrink-0" />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Info */}
      <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400 font-medium">How it works:</span> When a module is set to
          <span className="text-green-400"> Free</span>, users can generate content without using credits or quota.
          When set to <span className="text-gray-300">Paid</span>, it uses their subscription quota first, then
          deducts the configured credit cost when over quota. Disabled modules cannot be used by any user.
        </p>
      </div>
    </div>
  )
}
