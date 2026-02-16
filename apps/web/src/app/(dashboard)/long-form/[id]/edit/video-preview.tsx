'use client'

import { useRef, useState } from 'react'
import { Play, Pause, Image as ImageIcon, Video, AlertCircle, Volume2, VolumeX, Maximize2, Zap, Film } from 'lucide-react'
import type { EditorSegment } from './types'

interface VideoPreviewProps {
  segment: EditorSegment | null
  aspectRatio: string
}

const VISUAL_TYPE_BADGES: Record<string, { label: string; color: string; bg: string; icon: typeof Film }> = {
  AI_CLIP: { label: 'AI Clip', color: 'text-purple-300', bg: 'bg-purple-500/20', icon: Zap },
  STOCK_VIDEO: { label: 'Stock', color: 'text-blue-300', bg: 'bg-blue-500/20', icon: Film },
  STATIC_IMAGE: { label: 'Static', color: 'text-gray-300', bg: 'bg-gray-500/20', icon: ImageIcon },
}

export function VideoPreview({ segment, aspectRatio }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [progress, setProgress] = useState(0)

  if (!segment) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Film className="h-7 w-7 text-gray-600" />
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-sm font-medium">No segment selected</p>
          <p className="text-gray-600 text-xs mt-1">Select a segment from the timeline below</p>
        </div>
      </div>
    )
  }

  const isVideo = segment.visualType === 'AI_CLIP' || segment.visualType === 'STOCK_VIDEO'
  const isImage = segment.visualType === 'STATIC_IMAGE'
  const aspectClass =
    aspectRatio === '9:16' ? 'aspect-[9/16]' : aspectRatio === '1:1' ? 'aspect-square' : 'aspect-video'
  const duration = Math.round(segment.endTime - segment.startTime)
  const badge = VISUAL_TYPE_BADGES[segment.visualType] || VISUAL_TYPE_BADGES.STATIC_IMAGE
  const BadgeIcon = badge.icon

  function togglePlay() {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  function toggleMute() {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
    setIsMuted(videoRef.current.muted)
  }

  function handleTimeUpdate() {
    if (!videoRef.current) return
    const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100
    setProgress(isNaN(pct) ? 0 : pct)
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-4">
      {/* Preview Container */}
      <div className={`relative ${aspectClass} max-h-[65vh] w-full max-w-3xl rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40`}>
        {/* Checkerboard background for transparency */}
        <div className="absolute inset-0 bg-black" />

        {isVideo && segment.assetUrl && !hasError ? (
          <>
            <video
              ref={videoRef}
              src={segment.assetUrl}
              className="relative w-full h-full object-contain"
              onEnded={() => { setIsPlaying(false); setProgress(0) }}
              onError={() => setHasError(true)}
              onLoadedData={() => setHasError(false)}
              onTimeUpdate={handleTimeUpdate}
              muted={isMuted}
              playsInline
            />
            {/* Play/Pause overlay */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center group"
            >
              <div className={`h-14 w-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all ${isPlaying ? 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100' : 'opacity-100 scale-100'}`}>
                {isPlaying ? (
                  <Pause className="h-6 w-6 text-white" />
                ) : (
                  <Play className="h-6 w-6 text-white ml-0.5" />
                )}
              </div>
            </button>

            {/* Bottom controls bar */}
            <div className="absolute bottom-0 left-0 right-0">
              {/* Progress bar */}
              <div className="h-1 bg-white/10">
                <div
                  className="h-full bg-brand-500 transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/80 to-black/40">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${badge.color} ${badge.bg} px-2 py-0.5 rounded`}>
                    <BadgeIcon className="h-2.5 w-2.5" />
                    {badge.label}
                  </span>
                  <span className="text-[10px] text-gray-400">{duration}s</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMute() }}
                    className="p-1 rounded text-gray-400 hover:text-white transition"
                  >
                    {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : isImage && segment.assetUrl && !hasError ? (
          <div className="relative w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={segment.assetUrl}
              alt={segment.title}
              className="w-full h-full object-contain relative"
              onError={() => setHasError(true)}
            />
            {/* Info overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${badge.color} ${badge.bg} px-2 py-0.5 rounded`}>
                <BadgeIcon className="h-2.5 w-2.5" />
                {badge.label}
              </span>
              <span className="text-[10px] text-gray-400">{duration}s</span>
            </div>
          </div>
        ) : (
          /* Fallback / no asset */
          <div className="relative w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-gray-900 to-gray-950">
            {hasError ? (
              <>
                <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-400" />
                </div>
                <p className="text-sm text-gray-400">Failed to load preview</p>
                <p className="text-[10px] text-gray-600">Try recomposing the video</p>
              </>
            ) : (
              <>
                <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  {isVideo ? (
                    <Video className="h-6 w-6 text-gray-500" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-gray-500" />
                  )}
                </div>
                <p className="text-sm text-gray-400">No preview available</p>
                <p className="text-[10px] text-gray-600">Asset not yet generated</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Segment title + script below preview */}
      <div className="max-w-3xl w-full space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white truncate">{segment.title}</h3>
          <span className="text-[10px] text-gray-600 flex-shrink-0">Segment {segment.segmentIndex + 1}</span>
        </div>

        {segment.scriptText && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 max-h-20 overflow-y-auto">
            <p className="text-xs text-gray-400 leading-relaxed">{segment.scriptText}</p>
          </div>
        )}
      </div>
    </div>
  )
}
