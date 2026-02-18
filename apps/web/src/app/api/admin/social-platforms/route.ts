import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Admin-only middleware check
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (!user || user.role !== 'ADMIN') {
    return { error: 'Forbidden — Super Admin access required', status: 403 }
  }

  return { userId: session.user.id }
}

// ---------------------------------------------------------------------------
// Default social platform configs (for seeding)
// ---------------------------------------------------------------------------

const DEFAULT_PLATFORMS = [
  { platformKey: 'youtube',          platformName: 'YouTube' },
  { platformKey: 'youtube_shorts',   platformName: 'YouTube Shorts' },
  { platformKey: 'facebook_page',    platformName: 'Facebook Page' },
  { platformKey: 'facebook_reels',   platformName: 'Facebook Reels' },
  { platformKey: 'instagram',        platformName: 'Instagram' },
  { platformKey: 'instagram_reels',  platformName: 'Instagram Reels' },
]

const PLATFORM_ORDER = DEFAULT_PLATFORMS.map((p) => p.platformKey)

// ---------------------------------------------------------------------------
// GET /api/admin/social-platforms — list all platform configs
// ---------------------------------------------------------------------------

export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  // Ensure all default platforms exist
  for (const def of DEFAULT_PLATFORMS) {
    await prisma.socialPlatformConfig.upsert({
      where: { platformKey: def.platformKey },
      create: {
        platformKey: def.platformKey,
        platformName: def.platformName,
        status: 'DISABLED',
      },
      update: {},
    })
  }

  const platforms = await prisma.socialPlatformConfig.findMany()

  // Sort to match defined order
  platforms.sort((a, b) => {
    const ai = PLATFORM_ORDER.indexOf(a.platformKey)
    const bi = PLATFORM_ORDER.indexOf(b.platformKey)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  return NextResponse.json({ platforms })
}

// ---------------------------------------------------------------------------
// PUT /api/admin/social-platforms — update a platform config
// ---------------------------------------------------------------------------

const updatePlatformSchema = z.object({
  platformKey: z.string().min(1),
  status: z.enum(['ENABLED', 'DISABLED', 'COMING_SOON']),
})

export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const data = updatePlatformSchema.parse(body)

  const existing = await prisma.socialPlatformConfig.findUnique({
    where: { platformKey: data.platformKey },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Platform not found' }, { status: 404 })
  }

  const updated = await prisma.socialPlatformConfig.update({
    where: { platformKey: data.platformKey },
    data: { status: data.status },
  })

  return NextResponse.json({ platform: updated })
}
