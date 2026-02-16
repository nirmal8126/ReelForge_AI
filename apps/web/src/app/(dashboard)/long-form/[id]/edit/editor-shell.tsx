'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { EditorHeader } from './editor-header'
import { VideoPreview } from './video-preview'
import { SegmentTimeline } from './segment-timeline'
import { PropertiesPanel } from './properties-panel'
import { StockSearchModal } from './stock-search-modal'
import type { EditorJob, EditorSegment } from './types'

interface EditorShellProps {
  initialJob: EditorJob
  initialSegments: EditorSegment[]
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
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<EditorSegment>>>(new Map())

  const selectedSegment = segments.find((s) => s.id === selectedId) ?? null

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
          setJob((prev) => ({ ...prev, status: 'COMPLETED' })) // Reset to allow editing
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
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, segments])

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
    // Save pending changes first
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
    // Optimistic update
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
        setSegments(initialSegments) // Revert
        return
      }

      const data = await res.json()
      setSegments(data.segments.map((s: any) => ({
        ...s,
        transitionType: s.transitionType ?? 'none',
        captionsEnabled: s.captionsEnabled ?? true,
        titleOverlay: s.titleOverlay ?? false,
        createdAt: s.createdAt,
      })))
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

  return (
    <div className="fixed top-0 left-64 right-0 bottom-0 z-30 bg-gray-950 flex flex-col">
      <EditorHeader
        job={job}
        isDirty={isDirty}
        isSaving={isSaving}
        isRecomposing={isRecomposing}
        onSave={handleSave}
        onRecompose={handleRecompose}
      />

      <div className="flex-1 flex min-h-0">
        {/* Center: Video Preview */}
        <div className="flex-1 min-w-0 p-4">
          <VideoPreview
            segment={selectedSegment}
            aspectRatio={job.aspectRatio}
          />
        </div>

        {/* Right: Properties Panel */}
        <div className="w-80 border-l border-white/10 overflow-y-auto">
          <PropertiesPanel
            segment={selectedSegment}
            onUpdate={updateSegmentLocally}
            onFindStock={() => setStockSearchOpen(true)}
            onUploadFile={handleFileUpload}
          />
        </div>
      </div>

      {/* Bottom: Timeline */}
      <div className="border-t border-white/10">
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
    </div>
  )
}
