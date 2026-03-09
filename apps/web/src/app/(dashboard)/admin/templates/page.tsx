'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Layers,
  Loader2,
  Trash2,
  Star,
  StarOff,
  Upload,
  RefreshCw,
  Film,
  Video,
  Quote,
  Gamepad2,
  Joystick,
  ImageIcon,
  Clapperboard,
  Eye,
  EyeOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Template {
  id: string
  name: string
  description: string | null
  moduleType: string
  category: string
  isSystem: boolean
  isPublic: boolean
  isFeatured: boolean
  useCount: number
  createdAt: string
}

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  REEL: Film,
  LONG_FORM: Video,
  QUOTE: Quote,
  CHALLENGE: Gamepad2,
  GAMEPLAY: Joystick,
  IMAGE_STUDIO: ImageIcon,
  CARTOON: Clapperboard,
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/templates?limit=50')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const seedTemplates = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/templates/seed', { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(data.message)
      fetchTemplates()
    } catch {
      toast.error('Failed to seed templates')
    } finally {
      setSeeding(false)
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Template deleted')
      fetchTemplates()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const systemCount = templates.filter((t) => t.isSystem).length
  const userCount = templates.filter((t) => !t.isSystem).length

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <Layers className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Template Management</h1>
            <p className="text-sm text-gray-400">
              {systemCount} system · {userCount} user-created
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchTemplates}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-gray-400 hover:bg-white/[0.04] transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={seedTemplates}
            disabled={seeding}
            className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {seeding ? 'Seeding...' : 'Seed System Templates'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => {
            const Icon = MODULE_ICONS[template.moduleType] || Layers
            return (
              <div
                key={template.id}
                className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04]">
                  <Icon className="h-4 w-4 text-gray-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-white truncate">{template.name}</h3>
                    {template.isSystem && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">System</span>
                    )}
                    {template.isFeatured && (
                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {template.moduleType} · {template.category} · {template.useCount} uses
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    template.isPublic ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-500'
                  )}>
                    {template.isPublic ? 'Public' : 'Private'}
                  </span>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
