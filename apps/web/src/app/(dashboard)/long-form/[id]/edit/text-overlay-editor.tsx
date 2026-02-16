'use client'

import { useState, useEffect } from 'react'
import { Type, AlignCenter, AlignLeft, AlignRight, X, Check, Palette } from 'lucide-react'
import type { TextOverlay } from './types'

interface TextOverlayEditorProps {
  overlay: TextOverlay | null
  onChange: (overlay: TextOverlay | null) => void
}

const POSITIONS = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
] as const

const FONT_SIZES = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
] as const

const PRESET_COLORS = ['#FFFFFF', '#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']
const PRESET_BG_COLORS = ['transparent', '#000000CC', '#00000080', '#FFFFFFCC', '#EF4444CC', '#3B82F6CC']

const STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'outline', label: 'Outline' },
  { value: 'shadow', label: 'Shadow' },
] as const

const DEFAULT_OVERLAY: TextOverlay = {
  text: '',
  position: 'bottom',
  fontSize: 'md',
  color: '#FFFFFF',
  bgColor: '#000000CC',
  style: 'solid',
}

export function TextOverlayEditor({ overlay, onChange }: TextOverlayEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<TextOverlay>(overlay || DEFAULT_OVERLAY)

  useEffect(() => {
    setDraft(overlay || DEFAULT_OVERLAY)
  }, [overlay])

  function handleAdd() {
    setDraft(DEFAULT_OVERLAY)
    setIsEditing(true)
  }

  function handleSave() {
    if (!draft.text.trim()) {
      onChange(null)
    } else {
      onChange(draft)
    }
    setIsEditing(false)
  }

  function handleRemove() {
    onChange(null)
    setIsEditing(false)
  }

  if (!isEditing && !overlay) {
    return (
      <button
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-gray-500 hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition"
      >
        <Type className="h-4 w-4" />
        Add Text Overlay
      </button>
    )
  }

  if (!isEditing && overlay) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Type className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-xs font-medium text-gray-300">Text Overlay</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditing(true)}
              className="text-[10px] text-brand-400 hover:text-brand-300 transition px-1.5 py-0.5 rounded hover:bg-white/5"
            >
              Edit
            </button>
            <button
              onClick={handleRemove}
              className="text-[10px] text-red-400 hover:text-red-300 transition px-1.5 py-0.5 rounded hover:bg-white/5"
            >
              Remove
            </button>
          </div>
        </div>
        <p className="text-sm text-white truncate">&ldquo;{overlay.text}&rdquo;</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-gray-500 capitalize">{overlay.position}</span>
          <span className="text-gray-700 text-[10px]">&middot;</span>
          <span className="text-[10px] text-gray-500 uppercase">{overlay.fontSize}</span>
          <span className="text-gray-700 text-[10px]">&middot;</span>
          <span className="text-[10px] text-gray-500 capitalize">{overlay.style}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="h-3.5 w-3.5 text-brand-400" />
          <span className="text-xs font-medium text-brand-300">Text Overlay</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditing(false)}
            className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/5 transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Text input */}
      <div>
        <input
          type="text"
          value={draft.text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          placeholder="Enter overlay text..."
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
          autoFocus
        />
      </div>

      {/* Position */}
      <div>
        <label className="text-[10px] text-gray-500 mb-1.5 block">Position</label>
        <div className="flex gap-1">
          {POSITIONS.map((pos) => (
            <button
              key={pos.value}
              onClick={() => setDraft({ ...draft, position: pos.value })}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                draft.position === pos.value
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div>
        <label className="text-[10px] text-gray-500 mb-1.5 block">Size</label>
        <div className="flex gap-1">
          {FONT_SIZES.map((size) => (
            <button
              key={size.value}
              onClick={() => setDraft({ ...draft, fontSize: size.value })}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                draft.fontSize === size.value
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>
      </div>

      {/* Style */}
      <div>
        <label className="text-[10px] text-gray-500 mb-1.5 block">Style</label>
        <div className="flex gap-1">
          {STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => setDraft({ ...draft, style: s.value as TextOverlay['style'] })}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                draft.style === s.value
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Text Color */}
      <div>
        <label className="text-[10px] text-gray-500 mb-1.5 block">Text Color</label>
        <div className="flex gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setDraft({ ...draft, color: c })}
              className={`h-6 w-6 rounded-full border-2 transition ${
                draft.color === c ? 'border-brand-400 scale-110' : 'border-transparent hover:border-white/30'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Background Color */}
      <div>
        <label className="text-[10px] text-gray-500 mb-1.5 block">Background</label>
        <div className="flex gap-1.5">
          {PRESET_BG_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setDraft({ ...draft, bgColor: c })}
              className={`h-6 w-6 rounded-full border-2 transition ${
                draft.bgColor === c ? 'border-brand-400 scale-110' : 'border-transparent hover:border-white/30'
              } ${c === 'transparent' ? 'bg-[conic-gradient(#ccc_25%,#fff_25%,#fff_50%,#ccc_50%,#ccc_75%,#fff_75%)] bg-[length:8px_8px]' : ''}`}
              style={c !== 'transparent' ? { backgroundColor: c } : undefined}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      {draft.text && (
        <div className="rounded-lg bg-black/50 p-3 flex items-center justify-center min-h-[60px]">
          <span
            className={`px-3 py-1 rounded ${
              draft.fontSize === 'sm' ? 'text-xs' :
              draft.fontSize === 'md' ? 'text-sm' :
              draft.fontSize === 'lg' ? 'text-lg' : 'text-xl'
            } font-semibold ${
              draft.style === 'outline' ? 'drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]' :
              draft.style === 'shadow' ? 'drop-shadow-[2px_2px_4px_rgba(0,0,0,0.8)]' : ''
            }`}
            style={{
              color: draft.color,
              backgroundColor: draft.style === 'solid' ? draft.bgColor : 'transparent',
              WebkitTextStroke: draft.style === 'outline' ? '1px rgba(0,0,0,0.5)' : undefined,
            }}
          >
            {draft.text}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        {overlay && (
          <button
            onClick={handleRemove}
            className="text-[10px] text-red-400 hover:text-red-300 transition"
          >
            Remove
          </button>
        )}
        <div className={`flex items-center gap-2 ${!overlay ? 'ml-auto' : ''}`}>
          <button
            onClick={() => setIsEditing(false)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-brand-500 transition"
          >
            <Check className="h-3 w-3" />
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
