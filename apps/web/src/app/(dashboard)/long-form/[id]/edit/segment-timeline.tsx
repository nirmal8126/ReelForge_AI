'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Film, Image as ImageIcon, Zap, Clock, GripVertical } from 'lucide-react'
import type { EditorSegment } from './types'

interface SegmentTimelineProps {
  segments: EditorSegment[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (newOrder: string[]) => void
}

const VISUAL_TYPE_STYLES: Record<string, { accent: string; accentBg: string; icon: typeof Film }> = {
  AI_CLIP: { accent: 'border-purple-500', accentBg: 'bg-purple-500', icon: Zap },
  STOCK_VIDEO: { accent: 'border-blue-500', accentBg: 'bg-blue-500', icon: Film },
  STATIC_IMAGE: { accent: 'border-gray-500', accentBg: 'bg-gray-500', icon: ImageIcon },
  PENDING: { accent: 'border-gray-700', accentBg: 'bg-gray-700', icon: Clock },
}

export function SegmentTimeline({ segments, selectedId, onSelect, onReorder }: SegmentTimelineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = segments.findIndex((s) => s.id === active.id)
    const newIndex = segments.findIndex((s) => s.id === over.id)
    const newOrder = arrayMove(
      segments.map((s) => s.id),
      oldIndex,
      newIndex
    )
    onReorder(newOrder)
  }

  const totalDuration = segments.reduce((sum, s) => sum + (s.endTime - s.startTime), 0)
  const selectedIdx = segments.findIndex((s) => s.id === selectedId)

  return (
    <div className="px-4 py-3 bg-gray-900/50">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Timeline
          </span>
          <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">
            {segments.length} segments
          </span>
        </div>
        <div className="flex items-center gap-3">
          {selectedIdx >= 0 && (
            <span className="text-[10px] text-gray-500">
              {selectedIdx + 1} / {segments.length}
            </span>
          )}
          <span className="text-[10px] text-gray-500 font-mono">
            {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Segments */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={segments.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {segments.map((segment, index) => (
              <SortableSegment
                key={segment.id}
                segment={segment}
                index={index}
                isSelected={segment.id === selectedId}
                onSelect={onSelect}
                totalDuration={totalDuration}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableSegment({
  segment,
  index,
  isSelected,
  onSelect,
  totalDuration,
}: {
  segment: EditorSegment
  index: number
  isSelected: boolean
  onSelect: (id: string) => void
  totalDuration: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: segment.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const duration = segment.endTime - segment.startTime
  const widthPx = Math.max(90, Math.min(200, (duration / totalDuration) * 800))
  const typeStyle = VISUAL_TYPE_STYLES[segment.visualType] || VISUAL_TYPE_STYLES.PENDING
  const TypeIcon = typeStyle.icon

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width: `${widthPx}px`, minWidth: `${widthPx}px` }}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(segment.id)}
      className={`
        flex-shrink-0 rounded-lg border p-2 cursor-pointer select-none transition-all relative group
        ${isSelected
          ? 'border-brand-500/60 bg-brand-500/10 shadow-lg shadow-brand-500/10'
          : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10'
        }
      `}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-2 right-2 h-0.5 rounded-b ${typeStyle.accentBg} ${isSelected ? 'opacity-100' : 'opacity-40'}`} />

      {/* Drag handle indicator (visible on hover) */}
      <div className="absolute top-1/2 -translate-y-1/2 -left-0.5 opacity-0 group-hover:opacity-50 transition pointer-events-none">
        <GripVertical className="h-3 w-3 text-gray-500" />
      </div>

      <div className="flex items-center gap-1.5 mb-1.5 mt-0.5">
        <TypeIcon className={`h-3 w-3 flex-shrink-0 ${isSelected ? 'text-brand-400' : 'text-gray-500'}`} />
        <span className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
          {segment.title}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-[10px] ${isSelected ? 'text-brand-400/80' : 'text-gray-600'}`}>
          {Math.round(duration)}s
        </span>
        <span className="text-[10px] text-gray-700">
          #{index + 1}
        </span>
      </div>
    </div>
  )
}
