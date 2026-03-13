'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import {
  LogOut,
  CreditCard,
  Gift,
  Settings,
  ChevronDown,
  Coins,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { NotificationBell } from '@/components/notifications/notification-bell'

export function Header() {
  const { data: session } = useSession()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const isAdmin = (session?.user as Record<string, unknown>)?.role === 'ADMIN'

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen])

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-gray-200 dark:border-white/[0.06] bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-8">
        {/* Left side — empty for now, pages can use their own titles */}
        <div />

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Credits Badge — hidden for Admin */}
          {session?.user && !isAdmin && (
            <Link
              href="/billing"
              className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03] px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
            >
              <Coins className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-sm font-semibold text-brand-400">
                {session.user.creditsBalance || 0}
              </span>
              <span className="text-[11px] text-gray-500">credits</span>
              <span className="mx-1.5 h-3.5 w-px bg-gray-200 dark:bg-white/[0.08]" />
              <span className="text-[11px] font-medium text-gray-700 dark:text-white capitalize px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.06]">
                {session.user.plan?.toLowerCase() || 'free'}
              </span>
            </Link>
          )}

          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
              title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4 text-yellow-400" />
              ) : (
                <Moon className="h-4 w-4 text-gray-600" />
              )}
            </button>
          )}

          {/* Notifications */}
          <NotificationBell />

          {/* User Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500/30 to-brand-600/20 flex items-center justify-center ring-1 ring-gray-200 dark:ring-white/[0.08]">
                <span className="text-xs font-semibold text-brand-400">
                  {session?.user?.name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                  {session?.user?.name}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#12121A] shadow-2xl z-50 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{session?.user?.name}</p>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">{session?.user?.email}</p>
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  {!isAdmin && (
                    <>
                      <Link
                        href="/billing"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200 transition"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Billing
                      </Link>
                      <Link
                        href="/referrals"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200 transition"
                      >
                        <Gift className="h-3.5 w-3.5" />
                        Referrals
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200 transition"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                      </Link>
                    </>
                  )}
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-red-500 dark:hover:text-red-400 transition"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
