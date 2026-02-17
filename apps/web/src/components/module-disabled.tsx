import Link from 'next/link'
import { ShieldOff } from 'lucide-react'

interface ModuleDisabledProps {
  moduleName: string
}

export function ModuleDisabled({ moduleName }: ModuleDisabledProps) {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <div className="h-16 w-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-6">
        <ShieldOff className="h-8 w-8 text-gray-600" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Module Unavailable</h2>
      <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
        <span className="text-gray-400">{moduleName}</span> is currently disabled by the Super Admin.
        Please check back later or contact support.
      </p>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-brand-400 hover:text-brand-300 transition"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
