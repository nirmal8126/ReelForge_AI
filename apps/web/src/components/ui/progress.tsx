import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
}

export function Progress({ value, max = 100, className, showLabel }: ProgressProps) {
  const percent = Math.min(Math.round((value / max) * 100), 100)

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{value} / {max}</span>
          <span>{percent}%</span>
        </div>
      )}
      <div className="h-2 rounded-full bg-white/10">
        <div
          className={cn(
            'h-2 rounded-full transition-all',
            percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-brand-500'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
