'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Info,
  CheckCircle,
  AlertTriangle,
  Tag,
  Bell,
  Sparkles,
  X,
} from 'lucide-react'

interface Banner {
  id: string
  title: string
  message: string
  type: string
  contentType: string
  imageUrl: string | null
  linkUrl: string | null
  linkText: string | null
  bgColor: string | null
  textColor: string | null
  placement: string
  dismissible: boolean
}

const TYPE_ICONS: Record<string, typeof Info> = {
  INFO: Info,
  SUCCESS: CheckCircle,
  WARNING: AlertTriangle,
  PROMOTION: Tag,
  ANNOUNCEMENT: Bell,
  NEW_FEATURE: Sparkles,
}

const TYPE_DEFAULTS: Record<string, { bg: string; border: string; text: string }> = {
  INFO: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-300' },
  SUCCESS: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-300' },
  WARNING: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-300' },
  PROMOTION: { bg: 'bg-brand-500/10', border: 'border-brand-500/20', text: 'text-brand-300' },
  ANNOUNCEMENT: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-300' },
  NEW_FEATURE: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-300' },
}

function trackBanner(bannerId: string, action: 'view' | 'click') {
  fetch('/api/banners/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bannerId, action }),
  }).catch(() => {})
}

export function DashboardBanners({ placement = 'DASHBOARD_TOP' }: { placement?: string }) {
  const [banners, setBanners] = useState<Banner[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const trackedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Load dismissed banners from localStorage
    try {
      const saved = localStorage.getItem('dismissed_banners')
      if (saved) setDismissed(new Set(JSON.parse(saved)))
    } catch {}

    fetch('/api/banners')
      .then((res) => res.json())
      .then((data) => setBanners(data.banners || []))
      .catch(() => {})
  }, [])

  const visible = banners.filter(
    (b) => b.placement === placement && !dismissed.has(b.id)
  )

  // Track views once per banner per component lifetime
  useEffect(() => {
    visible.forEach((banner) => {
      const key = `${placement}_${banner.id}`
      if (!trackedRef.current.has(key)) {
        trackedRef.current.add(key)
        trackBanner(banner.id, 'view')
      }
    })
  }, [visible, placement])

  function dismiss(id: string) {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    localStorage.setItem('dismissed_banners', JSON.stringify([...next]))
  }

  if (visible.length === 0) return null

  return (
    <div className="space-y-3 mb-6">
      {visible.map((banner) => {
        const Icon = TYPE_ICONS[banner.type] || Info
        const defaults = TYPE_DEFAULTS[banner.type] || TYPE_DEFAULTS.INFO
        const hasCustomColors = banner.bgColor || banner.textColor

        // Image banner
        if (banner.contentType === 'image' && banner.imageUrl) {
          return (
            <div
              key={banner.id}
              className="rounded-xl border border-white/[0.08] overflow-hidden bg-white/[0.02]"
            >
              <div className="relative">
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full max-h-40 object-cover"
                />
                {banner.dismissible && (
                  <button
                    onClick={() => dismiss(banner.id)}
                    className="absolute top-2 right-2 p-1 rounded-lg bg-black/40 hover:bg-black/60 transition"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-white">{banner.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{banner.message}</p>
                {banner.linkUrl && banner.linkText && (
                  <Link
                    href={banner.linkUrl}
                    onClick={() => trackBanner(banner.id, 'click')}
                    className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-brand-400 underline underline-offset-2 hover:opacity-80 transition"
                  >
                    {banner.linkText}
                  </Link>
                )}
              </div>
            </div>
          )
        }

        // Text banner
        return (
          <div
            key={banner.id}
            className={`rounded-xl border p-4 ${hasCustomColors ? '' : `${defaults.bg} ${defaults.border}`}`}
            style={hasCustomColors ? {
              backgroundColor: banner.bgColor ? banner.bgColor + '18' : undefined,
              borderColor: banner.bgColor ? banner.bgColor + '40' : undefined,
              color: banner.textColor || undefined,
            } : undefined}
          >
            <div className="flex items-start gap-3">
              <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${hasCustomColors ? '' : defaults.text}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${hasCustomColors ? '' : 'text-white'}`}>
                  {banner.title}
                </p>
                <p className={`text-xs mt-0.5 ${hasCustomColors ? 'opacity-80' : 'text-gray-400'}`}>
                  {banner.message}
                </p>
                {banner.linkUrl && banner.linkText && (
                  <Link
                    href={banner.linkUrl}
                    onClick={() => trackBanner(banner.id, 'click')}
                    className={`inline-flex items-center gap-1 mt-2 text-xs font-medium underline underline-offset-2 ${
                      hasCustomColors ? '' : defaults.text
                    } hover:opacity-80 transition`}
                  >
                    {banner.linkText}
                  </Link>
                )}
              </div>
              {banner.dismissible && (
                <button
                  onClick={() => dismiss(banner.id)}
                  className="p-1 rounded-lg hover:bg-white/[0.1] transition flex-shrink-0"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
