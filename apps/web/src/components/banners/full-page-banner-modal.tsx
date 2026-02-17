'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  triggerType: string
  triggerDelay: number | null
  triggerScrollPercent: number | null
  showFrequency: string
  maxImpressions: number | null
}

const TYPE_ICONS: Record<string, typeof Info> = {
  INFO: Info,
  SUCCESS: CheckCircle,
  WARNING: AlertTriangle,
  PROMOTION: Tag,
  ANNOUNCEMENT: Bell,
  NEW_FEATURE: Sparkles,
}

const TYPE_COLORS: Record<string, { accent: string; glow: string }> = {
  INFO: { accent: 'from-blue-500 to-blue-600', glow: 'shadow-blue-500/20' },
  SUCCESS: { accent: 'from-green-500 to-emerald-600', glow: 'shadow-green-500/20' },
  WARNING: { accent: 'from-yellow-500 to-amber-600', glow: 'shadow-yellow-500/20' },
  PROMOTION: { accent: 'from-brand-500 to-brand-600', glow: 'shadow-brand-500/20' },
  ANNOUNCEMENT: { accent: 'from-purple-500 to-violet-600', glow: 'shadow-purple-500/20' },
  NEW_FEATURE: { accent: 'from-cyan-500 to-teal-600', glow: 'shadow-cyan-500/20' },
}

function trackBanner(bannerId: string, action: 'view' | 'click') {
  fetch('/api/banners/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bannerId, action }),
  }).catch(() => {})
}

/* ── Frequency & Impression helpers ── */

function isFrequencyBlocked(banner: Banner): boolean {
  const freq = banner.showFrequency || 'EVERY_VISIT'
  if (freq === 'EVERY_VISIT') return false
  if (freq === 'ONCE') {
    return localStorage.getItem(`banner_dismissed_${banner.id}`) === '1'
  }
  if (freq === 'ONCE_PER_SESSION') {
    return sessionStorage.getItem(`banner_session_${banner.id}`) === '1'
  }
  return false
}

function isImpressionCapped(banner: Banner): boolean {
  if (!banner.maxImpressions) return false
  const count = parseInt(localStorage.getItem(`banner_impressions_${banner.id}`) || '0', 10)
  return count >= banner.maxImpressions
}

function recordImpression(banner: Banner) {
  const count = parseInt(localStorage.getItem(`banner_impressions_${banner.id}`) || '0', 10)
  localStorage.setItem(`banner_impressions_${banner.id}`, String(count + 1))
}

function recordDismiss(banner: Banner) {
  const freq = banner.showFrequency || 'EVERY_VISIT'
  if (freq === 'ONCE') {
    localStorage.setItem(`banner_dismissed_${banner.id}`, '1')
  } else if (freq === 'ONCE_PER_SESSION') {
    sessionStorage.setItem(`banner_session_${banner.id}`, '1')
  }
  // Also keep legacy dismissed_banners for backwards compat
  try {
    const saved = localStorage.getItem('dismissed_banners')
    const arr: string[] = saved ? JSON.parse(saved) : []
    if (!arr.includes(banner.id)) {
      arr.push(banner.id)
      localStorage.setItem('dismissed_banners', JSON.stringify(arr))
    }
  } catch {}
}

export function FullPageBannerModal() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [triggeredIds, setTriggeredIds] = useState<Set<string>>(new Set())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const trackedRef = useRef<Set<string>>(new Set())
  const triggersSetup = useRef(false)

  // Fetch banners
  useEffect(() => {
    // Load legacy dismissals
    try {
      const saved = localStorage.getItem('dismissed_banners')
      if (saved) setDismissedIds(new Set(JSON.parse(saved)))
    } catch {}

    fetch('/api/banners')
      .then((res) => res.json())
      .then((data) => {
        const modals = (data.banners || []).filter(
          (b: Banner) => b.placement === 'FULL_PAGE_MODAL'
        )
        setBanners(modals)
      })
      .catch(() => {})
  }, [])

  // Setup triggers when banners load
  useEffect(() => {
    if (banners.length === 0 || triggersSetup.current) return
    triggersSetup.current = true

    const eligible = banners.filter(
      (b) => !dismissedIds.has(b.id) && !isFrequencyBlocked(b) && !isImpressionCapped(b)
    )

    for (const b of eligible) {
      const trigger = b.triggerType || 'IMMEDIATE'

      if (trigger === 'IMMEDIATE') {
        setTriggeredIds((prev) => new Set(prev).add(b.id))
      } else if (trigger === 'DELAY') {
        const delay = (b.triggerDelay || 5) * 1000
        setTimeout(() => {
          setTriggeredIds((prev) => new Set(prev).add(b.id))
        }, delay)
      } else if (trigger === 'SCROLL') {
        const threshold = b.triggerScrollPercent || 50
        const handler = () => {
          const scrollTop = window.scrollY || document.documentElement.scrollTop
          const docHeight = document.documentElement.scrollHeight - window.innerHeight
          if (docHeight <= 0) return
          const percent = (scrollTop / docHeight) * 100
          if (percent >= threshold) {
            setTriggeredIds((prev) => new Set(prev).add(b.id))
            window.removeEventListener('scroll', handler)
          }
        }
        window.addEventListener('scroll', handler, { passive: true })
      } else if (trigger === 'EXIT_INTENT') {
        // Desktop only
        const isDesktop = window.matchMedia('(pointer: fine)').matches
        if (isDesktop) {
          const handler = (e: MouseEvent) => {
            if (e.clientY <= 0) {
              setTriggeredIds((prev) => new Set(prev).add(b.id))
              document.removeEventListener('mouseleave', handler)
            }
          }
          document.addEventListener('mouseleave', handler)
        }
      } else if (trigger === 'IDLE') {
        let timer: ReturnType<typeof setTimeout>
        const resetTimer = () => {
          clearTimeout(timer)
          timer = setTimeout(() => {
            setTriggeredIds((prev) => new Set(prev).add(b.id))
            cleanup()
          }, 30000) // 30 seconds idle
        }
        const events = ['mousemove', 'keydown', 'scroll', 'touchstart']
        const cleanup = () => {
          events.forEach((e) => window.removeEventListener(e, resetTimer))
          clearTimeout(timer)
        }
        events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))
        resetTimer()
      } else if (trigger === 'FIRST_VISIT') {
        const hasVisited = localStorage.getItem('rf_has_previous_session')
        if (!hasVisited) {
          setTriggeredIds((prev) => new Set(prev).add(b.id))
        }
        // Always set the key so future visits are not "first"
        localStorage.setItem('rf_has_previous_session', '1')
      }
    }
  }, [banners, dismissedIds])

  // Get the first visible triggered banner
  const visibleBanners = banners.filter(
    (b) =>
      triggeredIds.has(b.id) &&
      !dismissedIds.has(b.id) &&
      !isFrequencyBlocked(b) &&
      !isImpressionCapped(b)
  )
  const banner = visibleBanners[0] || null

  // Track view + record impression
  useEffect(() => {
    if (banner && !trackedRef.current.has(banner.id)) {
      trackedRef.current.add(banner.id)
      trackBanner(banner.id, 'view')
      recordImpression(banner)
    }
  }, [banner?.id])

  const handleDismiss = useCallback(() => {
    if (!banner) return
    recordDismiss(banner)
    setDismissedIds((prev) => new Set(prev).add(banner.id))
  }, [banner])

  if (!banner) return null

  const Icon = TYPE_ICONS[banner.type] || Info
  const colors = TYPE_COLORS[banner.type] || TYPE_COLORS.INFO
  const hasCustomColors = banner.bgColor || banner.textColor

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={banner.dismissible ? handleDismiss : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 animate-in fade-in zoom-in-95 duration-300">
        {/* Dismiss button */}
        {banner.dismissible && (
          <button
            onClick={handleDismiss}
            className="absolute -top-3 -right-3 z-10 p-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition backdrop-blur-sm"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        )}

        <div className="rounded-2xl border border-white/[0.1] overflow-hidden shadow-2xl bg-[#12121A]">
          {/* Image banner */}
          {banner.contentType === 'image' && banner.imageUrl ? (
            <>
              <div className="relative">
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full max-h-80 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#12121A] via-transparent to-transparent" />
              </div>
              <div className="px-8 pb-8 -mt-10 relative z-10">
                <h2 className="text-2xl font-bold text-white mb-2">{banner.title}</h2>
                <p className="text-sm text-gray-300 leading-relaxed">{banner.message}</p>
                {banner.linkUrl && banner.linkText && (
                  <Link
                    href={banner.linkUrl}
                    onClick={() => { trackBanner(banner.id, 'click'); handleDismiss() }}
                    className={`inline-flex items-center gap-2 mt-5 px-6 py-2.5 rounded-xl bg-gradient-to-r ${colors.accent} text-white text-sm font-semibold shadow-lg ${colors.glow} hover:opacity-90 transition`}
                  >
                    {banner.linkText}
                  </Link>
                )}
              </div>
            </>
          ) : (
            /* Text banner */
            <div
              className="p-8"
              style={hasCustomColors ? {
                backgroundColor: banner.bgColor ? banner.bgColor + '18' : undefined,
                color: banner.textColor || undefined,
              } : undefined}
            >
              <div className="flex flex-col items-center text-center">
                <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${colors.accent} flex items-center justify-center mb-5 shadow-lg ${colors.glow}`}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h2 className={`text-2xl font-bold mb-3 ${hasCustomColors ? '' : 'text-white'}`}>
                  {banner.title}
                </h2>
                <p className={`text-sm leading-relaxed max-w-md ${hasCustomColors ? 'opacity-80' : 'text-gray-300'}`}>
                  {banner.message}
                </p>
                {banner.linkUrl && banner.linkText && (
                  <Link
                    href={banner.linkUrl}
                    onClick={() => { trackBanner(banner.id, 'click'); handleDismiss() }}
                    className={`inline-flex items-center gap-2 mt-6 px-6 py-2.5 rounded-xl bg-gradient-to-r ${colors.accent} text-white text-sm font-semibold shadow-lg ${colors.glow} hover:opacity-90 transition`}
                  >
                    {banner.linkText}
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Multiple banners indicator */}
          {visibleBanners.length > 1 && (
            <div className="px-8 pb-5 flex items-center justify-center gap-1.5">
              {visibleBanners.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === 0 ? 'w-6 bg-brand-400' : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {visibleBanners.length > 1 && banner.dismissible && (
          <p className="text-center mt-3 text-xs text-gray-500">
            1 of {visibleBanners.length} announcements
          </p>
        )}
      </div>
    </div>
  )
}
