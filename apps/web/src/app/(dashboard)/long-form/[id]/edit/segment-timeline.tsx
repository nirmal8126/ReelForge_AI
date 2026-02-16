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
import { Film, Image as ImageIcon, Zap, Clock } from 'lucide-react'
import type { EditorSegment } from './types'

interface SegmentTimelineProps {
  segments: EditorSegment[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (newOrder: string[]) => void
}

const VISUAL_TYPE_STYLES: Record<string, { border: string; bg: string; icon: typeof Film }> = {
  AI_CLIP: { border: 'border-l-purple-500', bg: 'bg-purple-500/10', icon: Zap },
  STOCK_VIDEO: { border: 'border-l-blue-500', bg: 'bg-blue-500/10', icon: Film },
  STATIC_IMAGE: { border: 'border-l-gray-500', bg: 'bg-gray-500/10', icon: ImageIcon },
  PENDING: { border: 'border-l-gray-600', bg: 'bg-gray-600/10', icon: Clock },
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

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium">
          TIMELINE — {segments.length} segments
        </span>
        <span className="text-xs text-gray-500">
          {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={segments.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
            {segments.map((segment) => (
              <SortableSegment
                key={segment.id}
                segment={segment}
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
  isSelected,
  onSelect,
  totalDuration,
}: {
  segment: EditorSegment
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
  // Min width 80px, max 200px, scaled by duration proportion
  const widthPx = Math.max(80, Math.min(200, (duration / totalDuration) * 800))
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
        flex-shrink-0 rounded-lg border-l-4 p-2 cursor-pointer select-none transition-all
        ${typeStyle.border} ${typeStyle.bg}
        ${isSelected
          ? 'ring-2 ring-brand-500 bg-brand-500/10'
          : 'hover:bg-white/5'
        }
      `}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <TypeIcon className="h-3 w-3 text-gray-400 flex-shrink-0" />
        <span className="text-xs font-medium text-white truncate">{segment.title}</span>
      </div>
      <div className="text-[10px] text-gray-500">
        {Math.round(duration)}s
      </div>
    </div>
  )
}
