import { NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'

// GET /api/theme — public endpoint for theme config
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const settings = await prisma.appSetting.findMany({
      where: {
        key: { in: ['theme_brand_color', 'theme_default_mode'] },
      },
    })

    const config: Record<string, string> = {}
    for (const s of settings) {
      if (s.key === 'theme_brand_color') config.brandColor = s.value
      if (s.key === 'theme_default_mode') config.defaultTheme = s.value
    }

    return NextResponse.json(config, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch {
    return NextResponse.json({})
  }
}
