'use client'

import { useState } from 'react'
import { Music, Volume2, VolumeX, ChevronDown } from 'lucide-react'
import { MUSIC_TRACKS } from '@/lib/constants'

interface MusicSelectorProps {
  value: string           // track ID
  volume: number          // 0-100
  onTrackChange: (trackId: string) => void
  onVolumeChange: (volume: number) => void
  compact?: boolean       // smaller variant for tight layouts
}

export function MusicSelector({ value, volume, onTrackChange, onVolumeChange, compact }: MusicSelectorProps) {
  const [open, setOpen] = useState(false)
  const selected = MUSIC_TRACKS.find(t => t.id === value) || MUSIC_TRACKS[0]

  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-2">
        <Music className="h-3.5 w-3.5" /> Background Music
      </label>

      {/* Track selector dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center justify-between rounded-lg border px-3 text-left transition ${
            value !== 'none'
              ? 'border-brand-500/30 bg-brand-500/5 text-brand-300'
              : 'border-white/10 bg-white/5 text-gray-400'
          } ${compact ? 'py-2 text-xs' : 'py-2.5 text-sm'}`}
        >
          <span className="flex items-center gap-2 truncate">
            {value === 'none' ? (
              <VolumeX className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
            ) : (
              <Music className="h-3.5 w-3.5 text-brand-400 flex-shrink-0" />
            )}
            <span className="truncate">{selected.name}</span>
            {selected.id !== 'none' && (
              <span className="text-gray-500 text-[10px] hidden sm:inline">({selected.desc})</span>
            )}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-gray-500 flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-gray-900 shadow-xl">
            {MUSIC_TRACKS.map(track => (
              <button
                key={track.id}
                type="button"
                onClick={() => { onTrackChange(track.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-white/[0.06] ${
                  value === track.id ? 'bg-brand-500/10 text-brand-300' : 'text-gray-300'
                }`}
              >
                {track.id === 'none' ? (
                  <VolumeX className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                ) : (
                  <Music className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm truncate">{track.name}</div>
                  {track.id !== 'none' && (
                    <div className="text-[10px] text-gray-500">{track.desc}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Volume slider — only show when a track is selected */}
      {value !== 'none' && (
        <div className="flex items-center gap-3 mt-2">
          <VolumeX className="h-3 w-3 text-gray-500 flex-shrink-0" />
          <input
            type="range"
            min={0}
            max={50}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="flex-1 h-1 accent-brand-500 bg-white/10 rounded-full appearance-none cursor-pointer"
          />
          <Volume2 className="h-3 w-3 text-gray-500 flex-shrink-0" />
          <span className="text-[10px] text-gray-500 w-7 text-right">{volume}%</span>
        </div>
      )}
    </div>
  )
}
