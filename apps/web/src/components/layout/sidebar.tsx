'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Film,
  Users,
  CreditCard,
  Gift,
  Shield,
  Video,
  Clapperboard,
  Quote,
  Gamepad2,
  Joystick,
  ImagePlus,
  Sparkles,
  Globe,
  Tv,
  Wrench,
  Megaphone,
  DollarSign,
  Share2,
  Zap,
  Layers,
} from 'lucide-react'
import { DashboardBanners } from '@/components/banners/dashboard-banners'

const navSections = [
  {
    label: 'Create',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/quotes', label: 'Quotes', icon: Quote, moduleId: 'quotes' },
      { href: '/reels', label: 'My Reels', icon: Film, moduleId: 'reels' },
      { href: '/long-form', label: 'My Videos', icon: Video, moduleId: 'long_form' },
      { href: '/cartoon-studio', label: 'Cartoon Studio', icon: Clapperboard, moduleId: 'cartoon_studio' },
      { href: '/challenges', label: 'Challenges', icon: Gamepad2, moduleId: 'challenges' },
      { href: '/gameplay', label: '3D Gameplay', icon: Joystick, moduleId: 'gameplay' },
      { href: '/image-studio', label: 'Image Studio', icon: ImagePlus, moduleId: 'image_studio' },
      { href: '/templates', label: 'Templates', icon: Layers, hideForAdmin: true },
      { href: '/automation', label: 'Automation', icon: Zap, hideForAdmin: true },
      { href: '/profiles', label: 'Channels', icon: Tv, hideForAdmin: true },
      { href: '/social-accounts', label: 'Social Accounts', icon: Share2, hideForAdmin: true },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null)

  useEffect(() => {
    fetch('/api/modules/enabled')
      .then((res) => res.json())
      .then((data) => setEnabledModules(data.enabledModules))
      .catch(() => setEnabledModules(null))
  }, [])

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-white/[0.06] bg-[#0A0A0F]">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5 hover:opacity-90 transition-opacity">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">ReelForge</span>
            <span className="text-base font-bold text-brand-400 ml-1">AI</span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4">
          {navSections.map((section) => {
            const isUserAdmin = (session?.user as Record<string, unknown>)?.role === 'ADMIN'
            const visibleItems = section.items.filter((item) => {
              if ('hideForAdmin' in item && item.hideForAdmin && isUserAdmin) return false
              if (!('moduleId' in item) || !item.moduleId) return true
              if (!enabledModules) return true // show all while loading
              return enabledModules.includes(item.moduleId)
            })

            if (visibleItems.length === 0) return null

            return (
              <div key={section.label} className="mb-4">
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all',
                          isActive
                            ? 'bg-brand-500/10 text-brand-400'
                            : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                            isActive
                              ? 'bg-brand-500/15 text-brand-400'
                              : 'bg-white/[0.04] text-gray-500 group-hover:bg-white/[0.06] group-hover:text-gray-300'
                          )}
                        >
                          <item.icon className="h-3.5 w-3.5" />
                        </span>
                        {item.label}
                        {isActive && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-400" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Super Admin Section — only for ADMIN users */}
          {(session?.user as Record<string, unknown>)?.role === 'ADMIN' && (
            <div className="mb-4">
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-red-400/70">
                Super Admin
              </p>
              <div className="space-y-0.5">
                {[
                  { href: '/admin/users', label: 'Users', icon: Users },
                  { href: '/admin/channels', label: 'Channels', icon: Tv },
                  { href: '/admin/modules', label: 'Module Settings', icon: Shield },
                  { href: '/admin/plans', label: 'Plans Settings', icon: CreditCard },
                  { href: '/admin/referrals', label: 'Referrals Settings', icon: Gift },
                  { href: '/admin/pricing', label: 'Pricing Regions', icon: Globe },
                  { href: '/admin/financials', label: 'Financials', icon: DollarSign },
                  { href: '/admin/social-platforms', label: 'Social Platforms', icon: Share2 },
                  { href: '/admin/templates', label: 'Templates', icon: Layers },
                  { href: '/admin/marketing', label: 'Marketing', icon: Megaphone },
                  { href: '/admin/settings', label: 'App Settings', icon: Wrench },
                ].map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all',
                        isActive
                          ? 'bg-red-500/10 text-red-400'
                          : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                          isActive
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-white/[0.04] text-gray-500 group-hover:bg-white/[0.06] group-hover:text-gray-300'
                        )}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                      </span>
                      {item.label}
                      {isActive && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-400" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Sidebar Banners */}
        <div className="mx-3 mb-3">
          <DashboardBanners placement="SIDEBAR" />
        </div>
      </div>
    </aside>
  )
}
