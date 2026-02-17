'use client'

import { useState, useEffect } from 'react'
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

const TYPE_COLORS: Record<string, { accent: string; glow: string }> = {
  INFO: { accent: 'from-blue-500 to-blue-600', glow: 'shadow-blue-500/20' },
  SUCCESS: { accent: 'from-green-500 to-emerald-600', glow: 'shadow-green-500/20' },
  WARNING: { accent: 'from-yellow-500 to-amber-600', glow: 'shadow-yellow-500/20' },
  PROMOTION: { accent: 'from-brand-500 to-brand-600', glow: 'shadow-brand-500/20' },
  ANNOUNCEMENT: { accent: 'from-purple-500 to-violet-600', glow: 'shadow-purple-500/20' },
  NEW_FEATURE: { accent: 'from-cyan-500 to-teal-600', glow: 'shadow-cyan-500/20' },
}

export function FullPageBannerModal() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dismissed_banners')
      if (saved) setDismissed(new Set(JSON.parse(saved)))
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

  function dismiss(id: string) {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    localStorage.setItem('dismissed_banners', JSON.stringify([...next]))
  }

  const visible = banners.filter((b) => !dismissed.has(b.id))
  const banner = visible[currentIndex]

  if (!banner) return null

  const Icon = TYPE_ICONS[banner.type] || Info
  const colors = TYPE_COLORS[banner.type] || TYPE_COLORS.INFO
  const hasCustomColors = banner.bgColor || banner.textColor

  function handleDismiss() {
    dismiss(banner.id)
    if (currentIndex < visible.length - 1) {
      // There are more modals — currentIndex stays, visible shrinks
    } else {
      setCurrentIndex(0)
    }
  }

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
                    onClick={handleDismiss}
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
                    onClick={handleDismiss}
                    className={`inline-flex items-center gap-2 mt-6 px-6 py-2.5 rounded-xl bg-gradient-to-r ${colors.accent} text-white text-sm font-semibold shadow-lg ${colors.glow} hover:opacity-90 transition`}
                  >
                    {banner.linkText}
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Multiple modals indicator */}
          {visible.length > 1 && (
            <div className="px-8 pb-5 flex items-center justify-center gap-1.5">
              {visible.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentIndex ? 'w-6 bg-brand-400' : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Skip / counter for non-dismissible with multiple */}
        {visible.length > 1 && banner.dismissible && (
          <p className="text-center mt-3 text-xs text-gray-500">
            {currentIndex + 1} of {visible.length} announcements
          </p>
        )}
      </div>
    </div>
  )
}
