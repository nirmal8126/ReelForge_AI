'use client'

import Link from 'next/link'
import { ArrowLeft, Save, RefreshCw, Loader2, Film, Keyboard } from 'lucide-react'
import type { EditorJob } from './types'

interface EditorHeaderProps {
  job: EditorJob
  isDirty: boolean
  isSaving: boolean
  isRecomposing: boolean
  onSave: () => void
  onRecompose: () => void
}

export function EditorHeader({
  job,
  isDirty,
  isSaving,
  isRecomposing,
  onSave,
  onRecompose,
}: EditorHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-gray-900/90 backdrop-blur-md">
      {/* Left side */}
      <div className="flex items-center gap-4 min-w-0">
        <Link
          href={`/long-form/${job.id}`}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition rounded-lg px-2 py-1.5 -ml-2 hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Exit Editor</span>
        </Link>

        <div className="h-5 w-px bg-white/10" />

        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-brand-500/10 flex-shrink-0">
            <Film className="h-4 w-4 text-brand-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-white font-semibold text-sm truncate max-w-sm">{job.title}</h1>
              {isDirty && (
                <span className="flex items-center gap-1.5 text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  Unsaved
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-600 mt-0.5">
              {job.aspectRatio} &middot; Use <Keyboard className="inline h-2.5 w-2.5" /> arrow keys to navigate segments
            </p>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2.5">
        {isRecomposing && (
          <div className="flex items-center gap-2 text-sm text-brand-400 bg-brand-500/10 px-3 py-1.5 rounded-lg mr-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs font-medium">Applying edits...</span>
          </div>
        )}

        <button
          onClick={onSave}
          disabled={!isDirty || isSaving || isRecomposing}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </button>

        <button
          onClick={onRecompose}
          disabled={isRecomposing}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-brand-600/20"
        >
          {isRecomposing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Re-compose
        </button>
      </div>
    </div>
  )
}
