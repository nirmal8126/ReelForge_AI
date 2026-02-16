'use client'

import { useRef } from 'react'
import { Search, Upload, Zap, Film, Image as ImageIcon, Type, FileText, Clock, Layers, Captions, ArrowRightLeft, Scissors, Copy, Trash2, MoreHorizontal } from 'lucide-react'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { TextOverlayEditor } from './text-overlay-editor'
import type { EditorSegment, TextOverlay } from './types'

interface PropertiesPanelProps {
  segment: EditorSegment | null
  onUpdate: (segmentId: string, updates: Partial<EditorSegment>) => void
  onFindStock: () => void
  onUploadFile: (file: File) => void
  onSplit: (segmentId: string) => void
  onDuplicate: (segmentId: string) => void
  onDelete: (segmentId: string) => void
  segmentCount: number
}

const VISUAL_TYPE_LABELS: Record<string, { label: string; color: string; bg: string; icon: typeof Film }> = {
  AI_CLIP: { label: 'AI Clip', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: Zap },
  STOCK_VIDEO: { label: 'Stock Video', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Film },
  STATIC_IMAGE: { label: 'Static Image', color: 'text-gray-400', bg: 'bg-gray-500/10', icon: ImageIcon },
}

const TRANSITION_OPTIONS = [
  { value: 'none', label: 'None (Hard Cut)' },
  { value: 'fade', label: 'Fade' },
  { value: 'crossfade', label: 'Crossfade' },
]

export function PropertiesPanel({ segment, onUpdate, onFindStock, onUploadFile, onSplit, onDuplicate, onDelete, segmentCount }: PropertiesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!segment) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 gap-3">
        <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Layers className="h-5 w-5 text-gray-600" />
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-sm font-medium">Properties</p>
          <p className="text-gray-600 text-xs mt-1">Select a segment to edit</p>
        </div>
      </div>
    )
  }

  const duration = Math.round(segment.endTime - segment.startTime)
  const typeInfo = VISUAL_TYPE_LABELS[segment.visualType] || VISUAL_TYPE_LABELS.STATIC_IMAGE
  const TypeIcon = typeInfo.icon

  return (
    <div className="p-4 space-y-5">
      {/* Segment Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
        <div className={`h-9 w-9 rounded-lg ${typeInfo.bg} flex items-center justify-center flex-shrink-0`}>
          <TypeIcon className={`h-4 w-4 ${typeInfo.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{segment.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
            <span className="text-gray-600 text-[10px]">&middot;</span>
            <span className="text-[10px] text-gray-500">{duration}s</span>
          </div>
        </div>
      </div>

      {/* Segment Operations */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <MoreHorizontal className="h-3.5 w-3.5 text-gray-500" />
          <h3 className="text-xs font-medium text-gray-400">Actions</h3>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => onSplit(segment.id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-[11px] text-gray-400 hover:text-white hover:bg-white/[0.06] transition"
            title="Split segment in half"
          >
            <Scissors className="h-3.5 w-3.5" />
            Split
          </button>
          <button
            onClick={() => onDuplicate(segment.id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-[11px] text-gray-400 hover:text-white hover:bg-white/[0.06] transition"
            title="Duplicate segment"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
          <button
            onClick={() => onDelete(segment.id)}
            disabled={segmentCount <= 1}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/10 bg-red-500/5 px-2 py-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
            title={segmentCount <= 1 ? 'Cannot delete the only segment' : 'Delete segment'}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </section>

      {/* Title */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Type className="h-3.5 w-3.5 text-gray-500" />
          <h3 className="text-xs font-medium text-gray-400">Title</h3>
        </div>
        <input
          type="text"
          value={segment.title}
          onChange={(e) => onUpdate(segment.id, { title: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none transition"
        />
      </section>

      {/* Script Text */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-gray-500" />
          <h3 className="text-xs font-medium text-gray-400">Script</h3>
        </div>
        <textarea
          value={segment.scriptText}
          onChange={(e) => onUpdate(segment.id, { scriptText: e.target.value })}
          rows={4}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none resize-none transition"
        />
        <p className="text-[10px] text-gray-600">{segment.scriptText.length} characters</p>
      </section>

      {/* Info Row */}
      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3 w-3 text-gray-600" />
            <span className="text-[10px] text-gray-500">Duration</span>
          </div>
          <p className="text-sm font-medium text-white">{duration}s</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Film className="h-3 w-3 text-gray-600" />
            <span className="text-[10px] text-gray-500">Visual</span>
          </div>
          <p className={`text-sm font-medium ${typeInfo.color}`}>{typeInfo.label}</p>
        </div>
      </section>

      {/* Swap Visual */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-3.5 w-3.5 text-gray-500" />
          <h3 className="text-xs font-medium text-gray-400">Replace Visual</h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onFindStock}
            className="flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-center hover:bg-white/[0.06] hover:border-blue-500/30 transition group"
          >
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition">
              <Search className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-[11px] text-gray-400 group-hover:text-white transition">Stock Footage</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-center hover:bg-white/[0.06] hover:border-green-500/30 transition group"
          >
            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition">
              <Upload className="h-4 w-4 text-green-400" />
            </div>
            <span className="text-[11px] text-gray-400 group-hover:text-white transition">Upload File</span>
          </button>
        </div>

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
      </section>

      {/* Text Overlay */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Type className="h-3.5 w-3.5 text-gray-500" />
          <h3 className="text-xs font-medium text-gray-400">Text Overlay</h3>
        </div>
        <TextOverlayEditor
          overlay={segment.textOverlay}
          onChange={(overlay) => onUpdate(segment.id, { textOverlay: overlay })}
        />
      </section>

      {/* Transition */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-gray-500" />
          <h3 className="text-xs font-medium text-gray-400">Transition</h3>
        </div>

        <SearchableSelect
          value={segment.transitionType || 'none'}
          onChange={(val: string) => onUpdate(segment.id, { transitionType: val })}
          options={TRANSITION_OPTIONS}
          placeholder="Select transition"
          searchPlaceholder="Search..."
        />
        <p className="text-[10px] text-gray-600">
          Transition effect before the next segment
        </p>
      </section>

      {/* Overlays */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Captions className="h-3.5 w-3.5 text-gray-500" />
          <h3 className="text-xs font-medium text-gray-400">Overlays</h3>
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.04] transition">
            <input
              type="checkbox"
              checked={segment.captionsEnabled}
              onChange={(e) => onUpdate(segment.id, { captionsEnabled: e.target.checked })}
              className="rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500 focus:ring-offset-0"
            />
            <div>
              <span className="text-sm text-gray-200">Captions</span>
              <p className="text-[10px] text-gray-600 mt-0.5">Show subtitles on this segment</p>
            </div>
          </label>

          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.04] transition">
            <input
              type="checkbox"
              checked={segment.titleOverlay}
              onChange={(e) => onUpdate(segment.id, { titleOverlay: e.target.checked })}
              className="rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500 focus:ring-offset-0"
            />
            <div>
              <span className="text-sm text-gray-200">Title Overlay</span>
              <p className="text-[10px] text-gray-600 mt-0.5">Display segment title on screen</p>
            </div>
          </label>
        </div>
      </section>

      {/* Asset URL */}
      {segment.assetUrl && (
        <section className="pt-3 border-t border-white/[0.06]">
          <p className="text-[10px] text-gray-600 font-mono break-all leading-relaxed">
            {segment.assetUrl.length > 100
              ? segment.assetUrl.slice(0, 100) + '...'
              : segment.assetUrl}
          </p>
        </section>
      )}
    </div>
  )
}
