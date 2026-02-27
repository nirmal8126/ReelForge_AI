'use client'

import { useState } from 'react'
import { Hash, Copy, Check } from 'lucide-react'

interface CopyHashtagsProps {
  hashtags: string
}

export function CopyHashtags({ hashtags }: CopyHashtagsProps) {
  const [copied, setCopied] = useState(false)

  const tags = hashtags.split(/\s+/).filter((t) => t.startsWith('#'))

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(hashtags)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = hashtags
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Hash className="h-5 w-5 text-brand-400" />
          Hashtags
        </h2>
        <button
          onClick={handleCopy}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            copied
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-brand-600 text-white hover:bg-brand-500'
          }`}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy All
            </>
          )}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-400 border border-brand-500/20"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
