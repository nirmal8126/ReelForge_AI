import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ReelForge AI - AI-Powered Video Generation Platform',
  description:
    'Generate professional AI-powered short-form video reels for YouTube Shorts, Instagram Reels, and Facebook Reels in minutes.',
}

// Server-side: build the brand color inline script to prevent FOUC
async function getBrandColorScript() {
  try {
    const { prisma } = await import('@reelforge/db')
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'theme_brand_color' },
    })
    const hex = setting?.value
    if (!hex) return ''

    // hex → HSL conversion (same logic as theme-provider, inlined for server)
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return ''
    let r = parseInt(result[1], 16) / 255
    let g = parseInt(result[2], 16) / 255
    let b = parseInt(result[3], 16) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h = 0, s = 0
    const l = (max + min) / 2
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      else if (max === g) h = ((b - r) / d + 2) / 6
      else h = ((r - g) / d + 4) / 6
    }
    const H = Math.round(h * 360), S = Math.round(s * 100), L = Math.round(l * 100)

    // Build CSS variable assignments
    const shades: Record<number, string> = {
      50: `${H} ${Math.min(S + 10, 100)}% 95%`,
      100: `${H} ${Math.min(S + 8, 100)}% 90%`,
      200: `${H} ${Math.min(S + 5, 100)}% 80%`,
      300: `${H} ${S}% 70%`,
      400: `${H} ${S}% ${L + 5}%`,
      500: `${H} ${S}% ${L}%`,
      600: `${H} ${S}% ${Math.max(L - 8, 10)}%`,
      700: `${H} ${S}% ${Math.max(L - 15, 10)}%`,
      800: `${H} ${Math.min(S + 5, 100)}% ${Math.max(L - 22, 5)}%`,
      900: `${H} ${Math.min(S + 10, 100)}% ${Math.max(L - 30, 5)}%`,
      950: `${H} ${Math.min(S + 15, 100)}% ${Math.max(L - 38, 3)}%`,
    }

    const vars = Object.entries(shades)
      .map(([k, v]) => `--brand-${k}:${v}`)
      .join(';')

    return `document.documentElement.style.cssText+="${vars};--primary:${shades[500]};--ring:${shades[500]}";`
  } catch {
    return ''
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const brandScript = await getBrandColorScript()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {brandScript && (
          <script dangerouslySetInnerHTML={{ __html: brandScript }} />
        )}
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
