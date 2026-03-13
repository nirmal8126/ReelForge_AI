'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useEffect, useState } from 'react'

interface ThemeConfig {
  brandColor?: string
  defaultTheme?: string
}

// Convert hex to HSL for CSS variables
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null

  let r = parseInt(result[1], 16) / 255
  let g = parseInt(result[2], 16) / 255
  let b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

// Generate shade variants from a base color
function generateBrandShades(hex: string) {
  const hsl = hexToHSL(hex)
  if (!hsl) return null

  return {
    50: `${hsl.h} ${Math.min(hsl.s + 10, 100)}% 95%`,
    100: `${hsl.h} ${Math.min(hsl.s + 8, 100)}% 90%`,
    200: `${hsl.h} ${Math.min(hsl.s + 5, 100)}% 80%`,
    300: `${hsl.h} ${hsl.s}% 70%`,
    400: `${hsl.h} ${hsl.s}% ${hsl.l + 5}%`,
    500: `${hsl.h} ${hsl.s}% ${hsl.l}%`,
    600: `${hsl.h} ${hsl.s}% ${Math.max(hsl.l - 8, 10)}%`,
    700: `${hsl.h} ${hsl.s}% ${Math.max(hsl.l - 15, 10)}%`,
    800: `${hsl.h} ${Math.min(hsl.s + 5, 100)}% ${Math.max(hsl.l - 22, 5)}%`,
    900: `${hsl.h} ${Math.min(hsl.s + 10, 100)}% ${Math.max(hsl.l - 30, 5)}%`,
    950: `${hsl.h} ${Math.min(hsl.s + 15, 100)}% ${Math.max(hsl.l - 38, 3)}%`,
  }
}

function ThemeConfigApplier() {
  useEffect(() => {
    fetch('/api/theme')
      .then((res) => res.json())
      .then((config: ThemeConfig) => {
        if (config.brandColor) {
          const shades = generateBrandShades(config.brandColor)
          if (shades) {
            const root = document.documentElement
            root.style.setProperty('--brand-50', shades[50])
            root.style.setProperty('--brand-100', shades[100])
            root.style.setProperty('--brand-200', shades[200])
            root.style.setProperty('--brand-300', shades[300])
            root.style.setProperty('--brand-400', shades[400])
            root.style.setProperty('--brand-500', shades[500])
            root.style.setProperty('--brand-600', shades[600])
            root.style.setProperty('--brand-700', shades[700])
            root.style.setProperty('--brand-800', shades[800])
            root.style.setProperty('--brand-900', shades[900])
            root.style.setProperty('--brand-950', shades[950])
            // Also set the primary color
            root.style.setProperty('--primary', shades[500])
            root.style.setProperty('--ring', shades[500])
          }
        }
      })
      .catch(() => {
        // Silently fail — use defaults
      })
  }, [])

  return null
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      {mounted && <ThemeConfigApplier />}
      {children}
    </NextThemesProvider>
  )
}
