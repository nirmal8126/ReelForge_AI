'use client'

import { useRef, useState } from 'react'
import { Play, Pause, Image as ImageIcon, Video, AlertCircle } from 'lucide-react'
import type { EditorSegment } from './types'

interface VideoPreviewProps {
  segment: EditorSegment | null
  aspectRatio: string
}

export function VideoPreview({ segment, aspectRatio }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasError, setHasError] = useState(false)

  if (!segment) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500 text-sm">Select a segment to preview</p>
      </div>
    )
  }

  const isVideo = segment.visualType === 'AI_CLIP' || segment.visualType === 'STOCK_VIDEO'
  const isImage = segment.visualType === 'STATIC_IMAGE'
  const aspectClass =
    aspectRatio === '9:16' ? 'aspect-[9/16]' : aspectRatio === '1:1' ? 'aspect-square' : 'aspect-video'

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

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      {/* Preview Container */}
      <div className={`relative ${aspectClass} max-h-[70vh] w-full max-w-3xl bg-black rounded-xl overflow-hidden border border-white/10`}>
        {isVideo && segment.assetUrl && !hasError ? (
          <>
            <video
              ref={videoRef}
              src={segment.assetUrl}
              className="w-full h-full object-contain"
              onEnded={() => setIsPlaying(false)}
              onError={() => setHasError(true)}
              onLoadedData={() => setHasError(false)}
              playsInline
            />
            {/* Play/Pause overlay */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
            >
              {isPlaying ? (
                <Pause className="h-12 w-12 text-white drop-shadow-lg" />
              ) : (
                <Play className="h-12 w-12 text-white drop-shadow-lg" />
              )}
            </button>
          </>
        ) : isImage && segment.assetUrl && !hasError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={segment.assetUrl}
            alt={segment.title}
            className="w-full h-full object-contain"
            onError={() => setHasError(true)}
          />
        ) : (
          // Fallback / no asset
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-brand-600/20 to-brand-800/20">
            {hasError ? (
              <>
                <AlertCircle className="h-10 w-10 text-red-400" />
                <p className="text-sm text-gray-400">Failed to load preview</p>
              </>
            ) : (
              <>
                {isVideo ? (
                  <Video className="h-10 w-10 text-gray-500" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-gray-500" />
                )}
                <p className="text-sm text-gray-400">No preview available</p>
              </>
            )}
          </div>
        )}

        {/* Segment info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <p className="text-white font-medium text-sm">{segment.title}</p>
          <p className="text-gray-400 text-xs mt-1">
            {Math.round(segment.endTime - segment.startTime)}s
            {' '}
            <span className="text-gray-500">|</span>
            {' '}
            {segment.visualType === 'AI_CLIP' ? 'AI Clip' :
              segment.visualType === 'STOCK_VIDEO' ? 'Stock' : 'Static'}
          </p>
        </div>
      </div>

      {/* Script text below preview */}
      {segment.scriptText && (
        <div className="max-w-3xl w-full">
          <div className="bg-white/5 rounded-lg p-3 max-h-24 overflow-y-auto">
            <p className="text-xs text-gray-400 leading-relaxed">{segment.scriptText}</p>
          </div>
        </div>
      )}
    </div>
  )
}
