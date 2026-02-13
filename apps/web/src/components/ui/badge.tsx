import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-white/10 text-gray-300': variant === 'default',
          'bg-green-500/10 text-green-400': variant === 'success',
          'bg-yellow-500/10 text-yellow-400': variant === 'warning',
          'bg-red-500/10 text-red-400': variant === 'error',
          'bg-blue-500/10 text-blue-400': variant === 'info',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
