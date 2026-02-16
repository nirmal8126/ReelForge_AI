'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Film,
  Users,
  CreditCard,
  Gift,
  Settings,
  LogOut,
  ChevronRight,
  Video,
  Clapperboard,
  Quote,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reels', label: 'My Reels', icon: Film },
  { href: '/long-form', label: 'My Videos', icon: Video },
  { href: '/cartoon-studio', label: 'Cartoon Studio', icon: Clapperboard },
  { href: '/quotes', label: 'Quotes', icon: Quote },
  { href: '/profiles', label: 'Channels', icon: Users },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/referrals', label: 'Referrals', icon: Gift },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-white/10 bg-gray-950">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 p-6 border-b border-white/10">
          <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">RF</span>
          </div>
          <span className="text-lg font-bold text-white">ReelForge AI</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-500/10 text-brand-400'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
              </Link>
            )
          })}
        </nav>

        {/* Credits Badge */}
        {session?.user && (
          <div className="mx-4 mb-4 rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Credits</span>
              <span className="text-sm font-bold text-brand-400">{session.user.creditsBalance || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Plan</span>
              <span className="text-xs font-medium text-white capitalize">{session.user.plan?.toLowerCase() || 'free'}</span>
            </div>
          </div>
        )}

        {/* User */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-brand-500/20 flex items-center justify-center">
              <span className="text-sm font-medium text-brand-400">
                {session?.user?.name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{session?.user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  )
}
