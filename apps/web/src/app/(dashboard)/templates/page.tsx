'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Layers,
  Search,
  Loader2,
  Star,
  Zap,
  Film,
  Video,
  Quote,
  Gamepad2,
  Joystick,
  ImageIcon,
  Clapperboard,
  TrendingUp,
  Play,
  Clock,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Template {
  id: string
  name: string
  description: string | null
  moduleType: string
  category: string
  tags: string[] | null
  promptTemplate: string
  defaultSettings: Record<string, unknown>
  themeConfig: Record<string, unknown> | null
  isSystem: boolean
  isFeatured: boolean
  useCount: number
  createdAt: string
}

interface CategoryCount {
  name: string
  count: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODULE_CONFIG: Record<string, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
  redirectPath: string
}> = {
  REEL: { label: 'Reel', icon: Film, color: 'text-pink-400', bgColor: 'bg-pink-500/10', redirectPath: '/reels' },
  LONG_FORM: { label: 'Long-Form', icon: Video, color: 'text-blue-400', bgColor: 'bg-blue-500/10', redirectPath: '/long-form' },
  QUOTE: { label: 'Quote', icon: Quote, color: 'text-amber-400', bgColor: 'bg-amber-500/10', redirectPath: '/quotes' },
  CHALLENGE: { label: 'Challenge', icon: Gamepad2, color: 'text-green-400', bgColor: 'bg-green-500/10', redirectPath: '/challenges' },
  GAMEPLAY: { label: 'Gameplay', icon: Joystick, color: 'text-purple-400', bgColor: 'bg-purple-500/10', redirectPath: '/gameplay' },
  IMAGE_STUDIO: { label: 'Image Studio', icon: ImageIcon, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', redirectPath: '/image-studio' },
  CARTOON: { label: 'Cartoon', icon: Clapperboard, color: 'text-orange-400', bgColor: 'bg-orange-500/10', redirectPath: '/cartoon-studio' },
}

const CATEGORY_EMOJI: Record<string, string> = {
  motivation: '🔥',
  education: '📚',
  entertainment: '🎬',
  business: '💼',
  philosophy: '🧠',
  attitude: '💪',
  lifestyle: '✨',
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [categories, setCategories] = useState<CategoryCount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterModule, setFilterModule] = useState<string | ''>('')
  const [filterCategory, setFilterCategory] = useState<string | ''>('')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [topic, setTopic] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterModule) params.set('moduleType', filterModule)
      if (filterCategory) params.set('category', filterCategory)
      if (search) params.set('search', search)

      const res = await fetch(`/api/templates?${params.toString()}`)
      const data = await res.json()
      setTemplates(data.templates || [])
      setCategories(data.categories || [])
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [filterModule, filterCategory, search])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Use template — create job
  const handleUseTemplate = async () => {
    if (!selectedTemplate || !topic.trim()) {
      return toast.error('Please enter a topic')
    }

    setCreating(true)
    try {
      const res = await fetch('/api/templates/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          topic: topic.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create job')
      }

      const data = await res.json()
      toast.success(`Job created from "${selectedTemplate.name}"!`)

      // Redirect to the module page
      const moduleConfig = MODULE_CONFIG[selectedTemplate.moduleType]
      if (moduleConfig) {
        router.push(`${moduleConfig.redirectPath}/${data.jobId}`)
      }

      setSelectedTemplate(null)
      setTopic('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create job')
    } finally {
      setCreating(false)
    }
  }

  // Featured templates
  const featured = templates.filter((t) => t.isFeatured)
  const regular = templates.filter((t) => !t.isFeatured)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
            <Layers className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Templates</h1>
            <p className="text-sm text-gray-400">One-click content creation with proven viral formats</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none"
          />
        </div>

        {/* Module Filter */}
        <select
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
        >
          <option value="" className="bg-gray-900">All Modules</option>
          {Object.entries(MODULE_CONFIG).map(([key, { label }]) => (
            <option key={key} value={key} className="bg-gray-900">{label}</option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
        >
          <option value="" className="bg-gray-900">All Categories</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name} className="bg-gray-900">
              {CATEGORY_EMOJI[c.name] || '📂'} {c.name.charAt(0).toUpperCase() + c.name.slice(1)} ({c.count})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <Layers className="mx-auto h-12 w-12 text-gray-600" />
          <h3 className="mt-4 text-lg font-medium text-white">No templates found</h3>
          <p className="mt-2 text-sm text-gray-400">
            {search || filterModule || filterCategory
              ? 'Try different filters or search terms.'
              : 'Ask your admin to seed system templates.'}
          </p>
        </div>
      ) : (
        <>
          {/* Featured Section */}
          {featured.length > 0 && !filterCategory && !search && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-4 w-4 text-yellow-400" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Featured Templates</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featured.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    featured
                    onSelect={() => setSelectedTemplate(template)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Templates */}
          <div>
            {featured.length > 0 && !filterCategory && !search && (
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">All Templates</h2>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(filterCategory || search ? templates : regular).map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => setSelectedTemplate(template)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Use Template Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0F0F18] p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                {(() => {
                  const config = MODULE_CONFIG[selectedTemplate.moduleType]
                  const Icon = config?.icon || Layers
                  return (
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', config?.bgColor || 'bg-white/[0.06]')}>
                      <Icon className={cn('h-5 w-5', config?.color || 'text-gray-400')} />
                    </div>
                  )
                })()}
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedTemplate.name}</h3>
                  <p className="text-xs text-gray-500">
                    {MODULE_CONFIG[selectedTemplate.moduleType]?.label} · {selectedTemplate.category}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedTemplate(null); setTopic('') }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Description */}
            {selectedTemplate.description && (
              <p className="mb-4 text-sm text-gray-400">{selectedTemplate.description}</p>
            )}

            {/* Tags */}
            {selectedTemplate.tags && (selectedTemplate.tags as string[]).length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {(selectedTemplate.tags as string[]).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-gray-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Settings Preview */}
            <div className="mb-5 rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Pre-configured Settings</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(selectedTemplate.defaultSettings as Record<string, unknown>)
                  .filter(([, v]) => v !== null && v !== undefined)
                  .slice(0, 6)
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-500">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="text-gray-300">{String(value)}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Topic Input */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Your Topic <span className="text-red-400">*</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. How Elon Musk thinks about failure..."
                rows={3}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none resize-none"
                autoFocus
              />
              <p className="mt-1 text-[11px] text-gray-600">
                This replaces {'{{topic}}'} in the template prompt
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setSelectedTemplate(null); setTopic('') }}
                className="flex-1 rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm font-medium text-gray-400 hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUseTemplate}
                disabled={creating || !topic.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Generate Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Template Card Component
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
  featured = false,
  onSelect,
}: {
  template: Template
  featured?: boolean
  onSelect: () => void
}) {
  const config = MODULE_CONFIG[template.moduleType]
  const Icon = config?.icon || Layers

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group relative rounded-xl border p-4 text-left transition-all hover:scale-[1.01]',
        featured
          ? 'border-brand-500/20 bg-gradient-to-br from-brand-500/[0.06] to-transparent hover:border-brand-500/40'
          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
      )}
    >
      {/* Featured badge */}
      {featured && (
        <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5">
          <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
          <span className="text-[10px] font-medium text-yellow-400">Featured</span>
        </div>
      )}

      {/* Module Badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config?.bgColor || 'bg-white/[0.06]')}>
          <Icon className={cn('h-4 w-4', config?.color || 'text-gray-400')} />
        </div>
        <span className={cn('text-[11px] font-medium', config?.color || 'text-gray-400')}>
          {config?.label || template.moduleType}
        </span>
        <span className="text-[10px] text-gray-600 ml-auto">
          {CATEGORY_EMOJI[template.category] || ''} {template.category}
        </span>
      </div>

      {/* Name & Description */}
      <h3 className="text-sm font-semibold text-white mb-1.5 group-hover:text-brand-400 transition-colors">
        {template.name}
      </h3>
      {template.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{template.description}</p>
      )}

      {/* Tags */}
      {template.tags && (template.tags as string[]).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {(template.tags as string[]).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-gray-500"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-1 text-[11px] text-gray-600">
          <TrendingUp className="h-3 w-3" />
          {template.useCount} uses
        </div>
        <div className="flex items-center gap-1 text-[11px] text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
          Use Template
          <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    </button>
  )
}
