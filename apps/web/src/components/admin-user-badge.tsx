import { User } from 'lucide-react'

interface AdminUserBadgeProps {
  name: string | null
  email: string | null
}

export function AdminUserBadge({ name, email }: AdminUserBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md bg-red-500/5 border border-red-500/10">
      <User className="h-3 w-3 text-red-400 flex-shrink-0" />
      <span className="text-[11px] text-red-300 truncate">{name || 'Unknown'}</span>
      {email && (
        <span className="text-[11px] text-red-400/40 truncate hidden sm:inline">({email})</span>
      )}
    </div>
  )
}
