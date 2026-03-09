import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma, Prisma } from '@reelforge/db'
import { SEED_TEMPLATES } from '@/lib/seed-templates'

// POST /api/templates/seed — seed system templates (admin only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin only
  if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Check if templates already exist
  const existingCount = await prisma.contentTemplate.count({
    where: { isSystem: true },
  })

  if (existingCount > 0) {
    // Delete existing system templates and re-seed
    await prisma.contentTemplate.deleteMany({
      where: { isSystem: true },
    })
  }

  // Create all seed templates
  const created = await prisma.contentTemplate.createMany({
    data: SEED_TEMPLATES.map((t) => ({
      userId: null,
      name: t.name,
      description: t.description,
      moduleType: t.moduleType as 'REEL' | 'LONG_FORM' | 'QUOTE' | 'CHALLENGE' | 'GAMEPLAY' | 'IMAGE_STUDIO' | 'CARTOON',
      category: t.category,
      tags: t.tags as Prisma.InputJsonValue,
      promptTemplate: t.promptTemplate,
      defaultSettings: t.defaultSettings as Prisma.InputJsonValue,
      themeConfig: t.themeConfig ? (t.themeConfig as Prisma.InputJsonValue) : Prisma.JsonNull,
      isSystem: true,
      isPublic: true,
      isFeatured: t.isFeatured || false,
    })),
  })

  return NextResponse.json({
    seeded: created.count,
    message: `Successfully seeded ${created.count} system templates`,
  })
}
