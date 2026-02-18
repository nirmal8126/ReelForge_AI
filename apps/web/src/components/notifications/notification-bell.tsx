'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Info,
  CheckCircle,
  AlertTriangle,
  Tag,
  Sparkles,
  Settings,
  X,
  CheckCheck,
} from 'lucide-react'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  linkUrl: string | null
  isRead: boolean
  createdAt: string
}

const TYPE_ICONS: Record<string, typeof Info> = {
  INFO: Info,
  SUCCESS: CheckCircle,
  WARNING: AlertTriangle,
  PROMOTION: Tag,
  ANNOUNCEMENT: Bell,
  NEW_FEATURE: Sparkles,
  SYSTEM: Settings,
}

const TYPE_COLORS: Record<string, string> = {
  INFO: 'text-blue-400',
  SUCCESS: 'text-green-400',
  WARNING: 'text-yellow-400',
  PROMOTION: 'text-brand-400',
  ANNOUNCEMENT: 'text-purple-400',
  NEW_FEATURE: 'text-cyan-400',
  SYSTEM: 'text-gray-400',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {}
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  async function markAllRead() {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {}
  }

  async function handleNotificationClick(notif: Notification) {
    // Mark as read
    if (!notif.isRead) {
      fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notif.id }),
      }).catch(() => {})
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    }

    // Navigate if link
    if (notif.linkUrl) {
      setOpen(false)
      router.push(notif.linkUrl)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-white/[0.06] hover:text-gray-200 transition"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#12121A] shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 transition"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-white/[0.06] transition"
              >
                <X className="h-3.5 w-3.5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((notif) => {
                const Icon = TYPE_ICONS[notif.type] || Info
                const color = TYPE_COLORS[notif.type] || 'text-gray-400'
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition border-b border-white/[0.04] last:border-0 ${
                      !notif.isRead ? 'bg-brand-500/[0.03]' : ''
                    }`}
                  >
                    <div className={`mt-0.5 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-medium truncate ${notif.isRead ? 'text-gray-300' : 'text-white'}`}>
                          {notif.title}
                        </p>
                        {!notif.isRead && (
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{notif.message}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
