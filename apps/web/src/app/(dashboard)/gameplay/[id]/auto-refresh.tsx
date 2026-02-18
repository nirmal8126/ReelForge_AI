'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AutoRefreshProps {
  enabled: boolean
  intervalMs?: number
}

export function AutoRefresh({ enabled, intervalMs = 3000 }: AutoRefreshProps) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return

    const timer = window.setInterval(() => {
      router.refresh()
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [enabled, intervalMs, router])

  return null
}
