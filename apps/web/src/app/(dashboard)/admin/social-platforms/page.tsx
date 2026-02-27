'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Share2,
  Loader2,
  Youtube,
  Facebook,
  Instagram,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PlatformConfig {
  id: string
  platformKey: string
  platformName: string
  status: 'ENABLED' | 'DISABLED' | 'COMING_SOON'
  updatedAt: string
}

const STATUS_OPTIONS: { value: PlatformConfig['status']; label: string; color: string; bg: string; border: string }[] = [
  { value: 'ENABLED', label: 'Enabled', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  { value: 'DISABLED', label: 'Disabled', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  { value: 'COMING_SOON', label: 'Coming Soon', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
]

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  youtube: Youtube,
  facebook: Facebook,
  instagram: Instagram,
}

export default function AdminSocialPlatformsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      router.push('/login')
      return
    }
    if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
      router.push('/dashboard')
      toast.error('Super Admin access required')
      return
    }
    fetchPlatforms()
  }, [session, status, router])

  async function fetchPlatforms() {
    try {
      const res = await fetch('/api/admin/social-platforms')
      if (!res.ok) {
        if (res.status === 403) {
          router.push('/dashboard')
          toast.error('Super Admin access required')
          return
        }
        throw new Error('Failed to load')
      }
      const data = await res.json()
      setPlatforms(data.platforms)
    } catch {
      toast.error('Failed to load social platform settings')
    } finally {
      setLoading(false)
    }
  }

  async function updatePlatform(platformKey: string, newStatus: PlatformConfig['status']) {
    setSaving(platformKey)
    try {
      const res = await fetch('/api/admin/social-platforms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformKey, status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const data = await res.json()

      setPlatforms((prev) =>
        prev.map((p) => (p.platformKey === platformKey ? { ...p, ...data.platform } : p))
      )
      toast.success('Platform updated')
    } catch {
      toast.error('Failed to update platform')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Share2 className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Social Platforms</h1>
            <p className="text-sm text-gray-500 mt-0.5">Super Admin — Manage social media platform availability</p>
          </div>
        </div>
      </div>

      {/* Platforms List */}
      <div className="space-y-4">
        {platforms.map((platform) => {
          const Icon = PLATFORM_ICONS[platform.platformKey] || Share2
          const isSaving = saving === platform.platformKey
          const currentStatus = STATUS_OPTIONS.find((s) => s.value === platform.status)!

          return (
            <div
              key={platform.platformKey}
              className={`rounded-xl border p-5 transition ${
                platform.status === 'ENABLED'
                  ? 'border-white/10 bg-white/[0.03]'
                  : 'border-white/[0.04] bg-white/[0.01] opacity-60'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Icon + Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{platform.platformName}</h3>
                    <p className="text-xs text-gray-500">{platform.platformKey}</p>
                  </div>
                </div>

                {/* Status Buttons */}
                <div className="flex items-center gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (platform.status !== opt.value) {
                          updatePlatform(platform.platformKey, opt.value)
                        }
                      }}
                      disabled={isSaving}
                      className={`text-xs font-medium px-3 py-1.5 rounded-md border transition ${
                        platform.status === opt.value
                          ? `${opt.border} ${opt.bg} ${opt.color}`
                          : 'border-white/[0.06] bg-white/[0.02] text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {isSaving && <Loader2 className="h-4 w-4 text-brand-400 animate-spin flex-shrink-0" />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Info */}
      <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400 font-medium">How it works:</span>{' '}
          <span className="text-green-400">Enabled</span> platforms appear in users&apos; Social Accounts page and can be connected.{' '}
          <span className="text-yellow-400">Coming Soon</span> platforms are shown but grayed out.{' '}
          <span className="text-red-400">Disabled</span> platforms are completely hidden from users.
        </p>
      </div>
    </div>
  )
}
