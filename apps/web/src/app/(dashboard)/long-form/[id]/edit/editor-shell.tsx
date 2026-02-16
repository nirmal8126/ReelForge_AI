'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { EditorHeader } from './editor-header'
import { VideoPreview } from './video-preview'
import { SegmentTimeline } from './segment-timeline'
import { PropertiesPanel } from './properties-panel'
import { StockSearchModal } from './stock-search-modal'
import { MusicPanel } from './music-panel'
import type { EditorJob, EditorSegment } from './types'

interface EditorShellProps {
  initialJob: EditorJob
  initialSegments: EditorSegment[]
}

/** Normalize segment data from API responses */
function normalizeSegment(s: any): EditorSegment {
  return {
    ...s,
    transitionType: s.transitionType ?? 'none',
    captionsEnabled: s.captionsEnabled ?? true,
    titleOverlay: s.titleOverlay ?? false,
    textOverlay: (s.assetMetadata as any)?.textOverlay ?? s.textOverlay ?? null,
    createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date(s.createdAt).toISOString(),
  }
}

export function EditorShell({ initialJob, initialSegments }: EditorShellProps) {
  const router = useRouter()
  const [job, setJob] = useState(initialJob)
  const [segments, setSegments] = useState(initialSegments)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSegments[0]?.id ?? null
  )
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRecomposing, setIsRecomposing] = useState(job.status === 'RECOMPOSING')
  const [stockSearchOpen, setStockSearchOpen] = useState(false)
  const [musicPanelOpen, setMusicPanelOpen] = useState(false)
  const [isPlayingAll, setIsPlayingAll] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<EditorSegment>>>(new Map())
  const playAllTimerRef = useRef<NodeJS.Timeout | null>(null)

  const selectedSegment = segments.find((s) => s.id === selectedId) ?? null

  // Play-all: auto-advance through segments
  useEffect(() => {
    if (!isPlayingAll) {
      if (playAllTimerRef.current) {
        clearTimeout(playAllTimerRef.current)
        playAllTimerRef.current = null
      }
      return
    }

    const currentIdx = segments.findIndex((s) => s.id === selectedId)
    if (currentIdx < 0) {
      setIsPlayingAll(false)
      return
    }

    const current = segments[currentIdx]
    const duration = (current.endTime - current.startTime) * 1000 // ms

    playAllTimerRef.current = setTimeout(() => {
      if (currentIdx < segments.length - 1) {
        setSelectedId(segments[currentIdx + 1].id)
      } else {
        // Reached the end
        setIsPlayingAll(false)
      }
    }, duration)

    return () => {
      if (playAllTimerRef.current) {
        clearTimeout(playAllTimerRef.current)
      }
    }
  }, [isPlayingAll, selectedId, segments])

  // Poll for recompose status
  useEffect(() => {
    if (!isRecomposing) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/long-form/${job.id}`)
        const data = await res.json()
        if (data.job?.status === 'COMPLETED') {
          setIsRecomposing(false)
          setJob((prev) => ({ ...prev, status: 'COMPLETED', outputUrl: data.job.outputUrl }))
          toast.success('Video recomposed successfully!')
          router.refresh()
        } else if (data.job?.status === 'FAILED') {
          setIsRecomposing(false)
          setJob((prev) => ({ ...prev, status: 'COMPLETED' }))
          toast.error(`Recompose failed: ${data.job.errorMessage || 'Unknown error'}`)
        }
      } catch { /* ignore polling errors */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [isRecomposing, job.id, router])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const idx = segments.findIndex((s) => s.id === selectedId)
      if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault()
        setSelectedId(segments[idx - 1].id)
      } else if (e.key === 'ArrowRight' && idx < segments.length - 1) {
        e.preventDefault()
        setSelectedId(segments[idx + 1].id)
      } else if (e.key === ' ' && e.ctrlKey) {
        e.preventDefault()
        handlePlayAll()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, segments, isPlayingAll])

  const updateSegmentLocally = useCallback((segmentId: string, updates: Partial<EditorSegment>) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, ...updates } : s))
    )
    setPendingChanges((prev) => {
      const next = new Map(prev)
      const existing = next.get(segmentId) || {}
      next.set(segmentId, { ...existing, ...updates })
      return next
    })
    setIsDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (pendingChanges.size === 0) return
    setIsSaving(true)

    try {
      const promises = Array.from(pendingChanges.entries()).map(([segmentId, changes]) =>
        fetch(`/api/long-form/${job.id}/segments/${segmentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        })
      )

      const results = await Promise.all(promises)
      const failed = results.filter((r) => !r.ok)

      if (failed.length > 0) {
        toast.error(`Failed to save ${failed.length} segment(s)`)
      } else {
        toast.success('Changes saved')
        setPendingChanges(new Map())
        setIsDirty(false)
      }
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }, [pendingChanges, job.id])

  const handleRecompose = useCallback(async () => {
    if (pendingChanges.size > 0) {
      await handleSave()
    }

    try {
      const res = await fetch(`/api/long-form/${job.id}/recompose`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to start recompose')
        return
      }
      setIsRecomposing(true)
      setJob((prev) => ({ ...prev, status: 'RECOMPOSING' }))
      toast.success('Recomposing video with your edits...')
    } catch {
      toast.error('Failed to start recompose')
    }
  }, [job.id, pendingChanges, handleSave])

  const handleReorder = useCallback(async (newOrder: string[]) => {
    const reordered = newOrder.map((id, idx) => {
      const seg = segments.find((s) => s.id === id)!
      return { ...seg, segmentIndex: idx }
    })
    setSegments(reordered)
    setIsDirty(true)

    try {
      const res = await fetch(`/api/long-form/${job.id}/segments/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentIds: newOrder }),
      })

      if (!res.ok) {
        toast.error('Failed to reorder segments')
        setSegments(initialSegments)
        return
      }

      const data = await res.json()
      setSegments(data.segments.map(normalizeSegment))
    } catch {
      toast.error('Failed to reorder segments')
      setSegments(initialSegments)
    }
  }, [segments, job.id, initialSegments])

  const handleStockSelect = useCallback(async (previewUrl: string) => {
    if (!selectedId) return

    updateSegmentLocally(selectedId, {
      assetUrl: previewUrl,
      visualType: 'STOCK_VIDEO',
    })
    setStockSearchOpen(false)
    toast.success('Stock footage selected — save and recompose to apply')
  }, [selectedId, updateSegmentLocally])

  const handleFileUpload = useCallback(async (file: File) => {
    if (!selectedId) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/api/long-form/${job.id}/segments/${selectedId}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Upload failed')
        return
      }

      const data = await res.json()
      setSegments((prev) =>
        prev.map((s) =>
          s.id === selectedId
            ? { ...s, assetUrl: data.url, visualType: data.segment.visualType }
            : s
        )
      )
      toast.success('File uploaded — recompose to apply')
    } catch {
      toast.error('Upload failed')
    }
  }, [selectedId, job.id])

  // --- Segment Operations ---

  const handleSplit = useCallback(async (segmentId: string) => {
    try {
      const res = await fetch(`/api/long-form/${job.id}/segments/${segmentId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splitPoint: 0.5 }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to split segment')
        return
      }

      const data = await res.json()
      const updated = data.segments.map(normalizeSegment)
      setSegments(updated)
      setIsDirty(true)
      toast.success('Segment split into two')
    } catch {
      toast.error('Failed to split segment')
    }
  }, [job.id])

  const handleDuplicate = useCallback(async (segmentId: string) => {
    try {
      const res = await fetch(`/api/long-form/${job.id}/segments/${segmentId}/duplicate`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to duplicate segment')
        return
      }

      const data = await res.json()
      const updated = data.segments.map(normalizeSegment)
      setSegments(updated)
      setIsDirty(true)
      toast.success('Segment duplicated')
    } catch {
      toast.error('Failed to duplicate segment')
    }
  }, [job.id])

  const handleDelete = useCallback(async (segmentId: string) => {
    try {
      const res = await fetch(`/api/long-form/${job.id}/segments/${segmentId}/delete`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete segment')
        return
      }

      const data = await res.json()
      const updated = data.segments.map(normalizeSegment)
      setSegments(updated)

      // If we deleted the selected segment, select the first one
      if (segmentId === selectedId) {
        setSelectedId(updated[0]?.id ?? null)
      }

      setIsDirty(true)
      toast.success('Segment deleted')
    } catch {
      toast.error('Failed to delete segment')
    }
  }, [job.id, selectedId])

  // --- Play All ---

  const handlePlayAll = useCallback(() => {
    if (isPlayingAll) {
      setIsPlayingAll(false)
    } else {
      // Start from first segment
      if (segments.length > 0) {
        setSelectedId(segments[0].id)
        setIsPlayingAll(true)
      }
    }
  }, [isPlayingAll, segments])

  // --- Music ---

  const handleMusicSelect = useCallback((url: string | null, volume: number) => {
    setJob((prev) => ({ ...prev, bgMusicUrl: url, bgMusicVolume: volume }))
    setIsDirty(true)
    if (url) {
      toast.success('Background music applied')
    } else {
      toast.success('Background music removed')
    }
  }, [])

  return (
    <div className="fixed top-0 left-64 right-0 bottom-0 z-30 bg-gray-950 flex flex-col">
      <EditorHeader
        job={job}
        isDirty={isDirty}
        isSaving={isSaving}
        isRecomposing={isRecomposing}
        isPlayingAll={isPlayingAll}
        onSave={handleSave}
        onRecompose={handleRecompose}
        onPlayAll={handlePlayAll}
        onOpenMusic={() => setMusicPanelOpen(true)}
      />

      <div className="flex-1 flex min-h-0">
        {/* Center: Video Preview */}
        <div className="flex-1 min-w-0 bg-gradient-to-b from-gray-950 to-gray-900/50">
          <VideoPreview
            segment={selectedSegment}
            aspectRatio={job.aspectRatio}
            autoPlay={isPlayingAll}
          />
        </div>

        {/* Right: Properties Panel */}
        <div className="w-80 border-l border-white/[0.06] bg-gray-900/40 overflow-y-auto scrollbar-thin">
          <PropertiesPanel
            segment={selectedSegment}
            onUpdate={updateSegmentLocally}
            onFindStock={() => setStockSearchOpen(true)}
            onUploadFile={handleFileUpload}
            onSplit={handleSplit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            segmentCount={segments.length}
          />
        </div>
      </div>

      {/* Bottom: Timeline */}
      <div className="border-t border-white/[0.06]">
        <SegmentTimeline
          segments={segments}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReorder={handleReorder}
        />
      </div>

      {/* Stock Search Modal */}
      {stockSearchOpen && (
        <StockSearchModal
          jobId={job.id}
          initialQuery={selectedSegment?.title || ''}
          onSelect={handleStockSelect}
          onClose={() => setStockSearchOpen(false)}
        />
      )}

      {/* Music Panel Modal */}
      <MusicPanel
        isOpen={musicPanelOpen}
        onClose={() => setMusicPanelOpen(false)}
        currentUrl={job.bgMusicUrl}
        currentVolume={job.bgMusicVolume}
        onSelect={handleMusicSelect}
      />
    </div>
  )
}
