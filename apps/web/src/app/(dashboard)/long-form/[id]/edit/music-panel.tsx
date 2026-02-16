'use client'

import { useState, useEffect } from 'react'
import { Music, X, Volume2, Check } from 'lucide-react'
import type { MusicTrack } from './types'

interface MusicPanelProps {
  isOpen: boolean
  onClose: () => void
  currentUrl: string | null
  currentVolume: number
  onSelect: (url: string | null, volume: number) => void
}

const MUSIC_LIBRARY: MusicTrack[] = [
  { id: 'none', name: 'No Music', genre: '', duration: '', url: '' },
  { id: 'upbeat-corporate', name: 'Upbeat Corporate', genre: 'Corporate', duration: '3:24', url: '/audio/upbeat-corporate.mp3' },
  { id: 'cinematic-epic', name: 'Cinematic Epic', genre: 'Cinematic', duration: '4:12', url: '/audio/cinematic-epic.mp3' },
  { id: 'lo-fi-chill', name: 'Lo-Fi Chill', genre: 'Lo-Fi', duration: '2:45', url: '/audio/lo-fi-chill.mp3' },
  { id: 'acoustic-gentle', name: 'Acoustic Gentle', genre: 'Acoustic', duration: '3:08', url: '/audio/acoustic-gentle.mp3' },
  { id: 'tech-innovation', name: 'Tech Innovation', genre: 'Electronic', duration: '3:36', url: '/audio/tech-innovation.mp3' },
  { id: 'motivational', name: 'Motivational Rise', genre: 'Inspirational', duration: '4:00', url: '/audio/motivational.mp3' },
  { id: 'ambient-focus', name: 'Ambient Focus', genre: 'Ambient', duration: '5:20', url: '/audio/ambient-focus.mp3' },
]

export function MusicPanel({ isOpen, onClose, currentUrl, currentVolume, onSelect }: MusicPanelProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentUrl)
  const [volume, setVolume] = useState(currentVolume)

  // Sync local state when props change or modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedUrl(currentUrl)
      setVolume(currentVolume)
    }
  }, [isOpen, currentUrl, currentVolume])

  if (!isOpen) return null

  const selectedTrack = MUSIC_LIBRARY.find((t) => t.url === (selectedUrl || '')) || MUSIC_LIBRARY[0]

  function handleApply() {
    const url = selectedTrack.id === 'none' ? null : selectedTrack.url
    onSelect(url, volume)
    onClose()
  }

  function handleRemoveMusic() {
    onSelect(null, 30)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-white/10 bg-gray-900 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-brand-500/10">
              <Music className="h-4 w-4 text-brand-400" />
            </div>
            <h2 className="text-white font-semibold text-sm">Background Music</h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Track List */}
        <div className="max-h-[340px] overflow-y-auto px-2 py-2">
          {MUSIC_LIBRARY.map((track) => {
            const isSelected = track.id === 'none'
              ? !selectedUrl || selectedUrl === ''
              : track.url === selectedUrl

            return (
              <button
                key={track.id}
                onClick={() => setSelectedUrl(track.id === 'none' ? null : track.url)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition group ${
                  isSelected
                    ? 'bg-brand-500/10 border border-brand-500/30'
                    : 'border border-transparent hover:bg-white/[0.04]'
                }`}
              >
                {/* Icon */}
                <div
                  className={`flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 ${
                    isSelected ? 'bg-brand-500/20' : 'bg-white/5'
                  }`}
                >
                  {isSelected ? (
                    <Check className="h-4 w-4 text-brand-400" />
                  ) : (
                    <Music className={`h-4 w-4 ${track.id === 'none' ? 'text-gray-600' : 'text-gray-400'}`} />
                  )}
                </div>

                {/* Name & Genre */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isSelected ? 'text-brand-300' : 'text-white'}`}>
                    {track.name}
                  </p>
                  {track.genre && (
                    <span className="inline-block mt-0.5 text-[10px] font-medium text-gray-400 bg-white/5 rounded px-1.5 py-0.5">
                      {track.genre}
                    </span>
                  )}
                </div>

                {/* Duration */}
                {track.duration && (
                  <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">
                    {track.duration}
                  </span>
                )}

                {/* Select indicator */}
                {!isSelected && (
                  <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                    Select
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Volume Slider */}
        <div className="px-5 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-medium">Volume</span>
                <span className="text-xs text-gray-300 tabular-nums font-medium">{volume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 accent-brand-500
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:shadow-md
                  [&::-webkit-slider-thumb]:shadow-brand-500/30 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-400
                  [&::-webkit-slider-thumb]:hover:bg-brand-400 [&::-webkit-slider-thumb]:transition"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06]">
          <button
            onClick={handleRemoveMusic}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-gray-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition"
          >
            <X className="h-3.5 w-3.5" />
            Remove Music
          </button>

          <button
            onClick={handleApply}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition shadow-lg shadow-brand-600/20"
          >
            <Check className="h-3.5 w-3.5" />
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
