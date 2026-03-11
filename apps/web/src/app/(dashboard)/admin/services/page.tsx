'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Server,
  Loader2,
  ToggleLeft,
  ToggleRight,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  AlertCircle,
  Type,
  Image,
  Video,
  Mic,
  Film,
  BookOpen,
  Settings,
  Key,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderConfig {
  id: string
  name: string
  enabled: boolean
  priority: number
  envKey: string
  model?: string
  hasApiKey?: boolean
  settings?: Record<string, string | number | boolean>
}

interface ServiceCategoryConfig {
  category: string
  label: string
  description: string
  providers: ProviderConfig[]
}

// ---------------------------------------------------------------------------
// Category icons
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type,
  image: Image,
  video: Video,
  voice: Mic,
  stock: Film,
  story: BookOpen,
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdminServicesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [configs, setConfigs] = useState<ServiceCategoryConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    fetch('/api/admin/services')
      .then((r) => r.json())
      .then((data) => setConfigs(data.configs || []))
      .catch(() => toast.error('Failed to load service config'))
      .finally(() => setLoading(false))
  }, [])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function toggleProvider(catIndex: number, provIndex: number) {
    setConfigs((prev) => {
      const next = structuredClone(prev)
      next[catIndex].providers[provIndex].enabled = !next[catIndex].providers[provIndex].enabled
      return next
    })
    setHasChanges(true)
  }

  function moveProvider(catIndex: number, provIndex: number, direction: 'up' | 'down') {
    setConfigs((prev) => {
      const next = structuredClone(prev)
      const providers = next[catIndex].providers
      const swapIndex = direction === 'up' ? provIndex - 1 : provIndex + 1
      if (swapIndex < 0 || swapIndex >= providers.length) return prev

      // Swap priorities
      const tmpPriority = providers[provIndex].priority
      providers[provIndex].priority = providers[swapIndex].priority
      providers[swapIndex].priority = tmpPriority

      // Swap positions in array
      ;[providers[provIndex], providers[swapIndex]] = [providers[swapIndex], providers[provIndex]]

      return next
    })
    setHasChanges(true)
  }

  function updateModel(catIndex: number, provIndex: number, model: string) {
    setConfigs((prev) => {
      const next = structuredClone(prev)
      next[catIndex].providers[provIndex].model = model || undefined
      return next
    })
    setHasChanges(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Strip hasApiKey before sending (server-only field)
      const cleanConfigs = configs.map((cat) => ({
        ...cat,
        providers: cat.providers.map(({ hasApiKey, ...rest }) => rest),
      }))

      const res = await fetch('/api/admin/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: cleanConfigs }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Save failed')
      }

      toast.success('Service configuration saved! Changes take effect on next job.')
      setHasChanges(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  if ((session?.user as any)?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Access denied. Admin only.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
            <Server className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Service Providers</h1>
            <p className="text-sm text-gray-500">
              Configure AI and media services used for job generation
            </p>
          </div>
        </div>

        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 disabled:opacity-50 transition shadow-lg shadow-brand-600/20"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-400">
          <p>
            Drag providers up/down to set <span className="text-white font-medium">priority order</span>.
            The system tries providers top-to-bottom — if the first fails or its API key is missing, it falls back to the next.
          </p>
          <p className="mt-1.5 text-gray-500">
            Changes take effect on the next job. Running jobs are not affected.
          </p>
        </div>
      </div>

      {/* Category cards */}
      {configs.map((cat, catIndex) => {
        const Icon = CATEGORY_ICONS[cat.category] || Settings
        return (
          <div
            key={cat.category}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
          >
            {/* Category header */}
            <div className="flex items-center gap-3 p-5 border-b border-white/[0.06]">
              <div className="h-9 w-9 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <Icon className="h-4.5 w-4.5 text-brand-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">{cat.label}</h2>
                <p className="text-xs text-gray-500">{cat.description}</p>
              </div>
            </div>

            {/* Providers list */}
            <div className="divide-y divide-white/[0.04]">
              {cat.providers.map((provider, provIndex) => {
                const isExpanded = expandedProvider === `${cat.category}-${provider.id}`
                return (
                  <div key={provider.id} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      {/* Priority badge */}
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => moveProvider(catIndex, provIndex, 'up')}
                          disabled={provIndex === 0}
                          className="p-0.5 rounded text-gray-600 hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed transition"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-xs font-mono text-gray-500 w-5 text-center">
                          {provIndex + 1}
                        </span>
                        <button
                          onClick={() => moveProvider(catIndex, provIndex, 'down')}
                          disabled={provIndex === cat.providers.length - 1}
                          className="p-0.5 rounded text-gray-600 hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed transition"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Provider info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{provider.name}</span>
                          {provider.hasApiKey ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                              <Key className="h-2.5 w-2.5" />
                              Key Set
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                              <AlertCircle className="h-2.5 w-2.5" />
                              No Key
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          ENV: <code className="text-gray-500">{provider.envKey}</code>
                          {provider.model && (
                            <span className="ml-2">
                              Model: <code className="text-gray-500">{provider.model}</code>
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Settings toggle */}
                      <button
                        onClick={() =>
                          setExpandedProvider(
                            isExpanded ? null : `${cat.category}-${provider.id}`
                          )
                        }
                        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition"
                      >
                        <Settings className="h-4 w-4" />
                      </button>

                      {/* Enable/disable toggle */}
                      <button
                        onClick={() => toggleProvider(catIndex, provIndex)}
                        className="text-gray-400 hover:text-white transition"
                      >
                        {provider.enabled ? (
                          <ToggleRight className="h-7 w-7 text-brand-400" />
                        ) : (
                          <ToggleLeft className="h-7 w-7 text-gray-600" />
                        )}
                      </button>
                    </div>

                    {/* Expanded settings panel */}
                    {isExpanded && (
                      <div className="mt-3 ml-10 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-400 mb-1 block">
                            Model Override
                          </label>
                          <input
                            type="text"
                            value={provider.model || ''}
                            onChange={(e) => updateModel(catIndex, provIndex, e.target.value)}
                            placeholder="Default model"
                            className="w-full rounded-md bg-white/[0.06] border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-brand-500 transition"
                          />
                        </div>
                        {provider.settings && Object.keys(provider.settings).length > 0 && (
                          <div>
                            <label className="text-xs font-medium text-gray-400 mb-1 block">
                              Provider Settings
                            </label>
                            <div className="space-y-1.5">
                              {Object.entries(provider.settings).map(([key, val]) => (
                                <div key={key} className="flex items-center gap-2 text-xs">
                                  <span className="text-gray-500 w-32 truncate">{key}:</span>
                                  <span className="text-gray-300 font-mono">{String(val)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Bottom save bar */}
      {hasChanges && (
        <div className="sticky bottom-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 disabled:opacity-50 transition shadow-2xl shadow-brand-600/30"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Save All Changes
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
