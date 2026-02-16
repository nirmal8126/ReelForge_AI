'use client'

import { useRef } from 'react'
import { Search, Upload, Zap, Film, Image as ImageIcon, ChevronDown } from 'lucide-react'
import type { EditorSegment } from './types'

interface PropertiesPanelProps {
  segment: EditorSegment | null
  onUpdate: (segmentId: string, updates: Partial<EditorSegment>) => void
  onFindStock: () => void
  onUploadFile: (file: File) => void
}

const VISUAL_TYPE_LABELS: Record<string, { label: string; color: string; icon: typeof Film }> = {
  AI_CLIP: { label: 'AI Clip', color: 'text-purple-400', icon: Zap },
  STOCK_VIDEO: { label: 'Stock Video', color: 'text-blue-400', icon: Film },
  STATIC_IMAGE: { label: 'Static Image', color: 'text-gray-400', icon: ImageIcon },
}

export function PropertiesPanel({ segment, onUpdate, onFindStock, onUploadFile }: PropertiesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!segment) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-gray-500 text-sm text-center">
          Select a segment from the timeline to edit its properties
        </p>
      </div>
    )
  }

  const duration = Math.round(segment.endTime - segment.startTime)
  const typeInfo = VISUAL_TYPE_LABELS[segment.visualType] || VISUAL_TYPE_LABELS.STATIC_IMAGE
  const TypeIcon = typeInfo.icon

  return (
    <div className="p-4 space-y-6">
      {/* Segment Properties */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Segment Properties
        </h3>

        <div className="space-y-3">
          {/* Title */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Title</label>
            <input
              type="text"
              value={segment.title}
              onChange={(e) => onUpdate(segment.id, { title: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Script Text */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Script</label>
            <textarea
              value={segment.scriptText}
              onChange={(e) => onUpdate(segment.id, { scriptText: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>

          {/* Duration & Type (read-only) */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Duration</label>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-400">
                {duration}s
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Visual Type</label>
              <div className={`rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm flex items-center gap-1.5 ${typeInfo.color}`}>
                <TypeIcon className="h-3.5 w-3.5" />
                {typeInfo.label}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Swap Visual */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Swap Visual
        </h3>

        <div className="space-y-2">
          <button
            onClick={onFindStock}
            className="w-full flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition"
          >
            <Search className="h-4 w-4 text-blue-400" />
            Find Stock Footage
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition"
          >
            <Upload className="h-4 w-4 text-green-400" />
            Upload Custom File
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUploadFile(file)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      {/* Transition */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Transition
        </h3>

        <div className="relative">
          <select
            value={segment.transitionType || 'none'}
            onChange={(e) => onUpdate(segment.id, { transitionType: e.target.value })}
            className="w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          >
            <option value="none">None (Hard Cut)</option>
            <option value="fade">Fade</option>
            <option value="crossfade">Crossfade</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
        </div>
        <p className="text-[10px] text-gray-600 mt-1">
          Transition to the next segment
        </p>
      </section>

      {/* Overlay Options */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Overlays
        </h3>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={segment.captionsEnabled}
              onChange={(e) => onUpdate(segment.id, { captionsEnabled: e.target.checked })}
              className="rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500"
            />
            Show captions
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={segment.titleOverlay}
              onChange={(e) => onUpdate(segment.id, { titleOverlay: e.target.checked })}
              className="rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500"
            />
            Show title overlay
          </label>
        </div>
      </section>

      {/* Asset URL info */}
      {segment.assetUrl && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Asset
          </h3>
          <p className="text-[10px] text-gray-600 break-all font-mono">
            {segment.assetUrl.length > 80
              ? segment.assetUrl.slice(0, 80) + '...'
              : segment.assetUrl}
          </p>
        </section>
      )}
    </div>
  )
}
