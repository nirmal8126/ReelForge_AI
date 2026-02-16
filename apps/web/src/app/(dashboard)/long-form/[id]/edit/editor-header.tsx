'use client'

import Link from 'next/link'
import { ArrowLeft, Save, RefreshCw, Loader2 } from 'lucide-react'
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
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gray-900/80 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <Link
          href={`/long-form/${job.id}`}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex items-center gap-2">
          <h1 className="text-white font-semibold truncate max-w-md">{job.title}</h1>
          {isDirty && (
            <span className="h-2 w-2 rounded-full bg-yellow-500" title="Unsaved changes" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isRecomposing && (
          <div className="flex items-center gap-2 text-sm text-brand-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Applying edits...
          </div>
        )}

        <button
          onClick={onSave}
          disabled={!isDirty || isSaving || isRecomposing}
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
