import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

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
    return { error: 'Forbidden', status: 403 }
  }
  return { userId: session.user.id }
}

// GET /api/admin/marketing/banners — list all banners
export async function GET(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const banners = await prisma.banner.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ banners })
}

const bannerSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'PROMOTION', 'ANNOUNCEMENT', 'NEW_FEATURE']),
  contentType: z.enum(['text', 'image']).default('text'),
  targetModule: z.string().max(50).optional().nullable(),
  linkUrl: z.string().max(500).optional().nullable(),
  linkText: z.string().max(100).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  bgColor: z.string().max(20).optional().nullable(),
  textColor: z.string().max(20).optional().nullable(),
  placement: z.enum(['DASHBOARD_TOP', 'DASHBOARD_BOTTOM', 'SIDEBAR', 'FULL_PAGE_MODAL']),
  targetPlans: z.array(z.string()).optional().nullable(),
  priority: z.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
  startsAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  dismissible: z.boolean().default(true),
})

// POST /api/admin/marketing/banners — create a banner
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = bannerSchema.parse(body)

    const banner = await prisma.banner.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type as any,
        contentType: data.contentType,
        targetModule: data.targetModule || null,
        linkUrl: data.linkUrl || null,
        linkText: data.linkText || null,
        imageUrl: data.imageUrl || null,
        bgColor: data.bgColor || null,
        textColor: data.textColor || null,
        placement: data.placement as any,
        targetPlans: data.targetPlans || null,
        priority: data.priority,
        isActive: data.isActive,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        dismissible: data.dismissible,
      },
    })

    return NextResponse.json({ banner })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Banner create error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to create banner' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/marketing/banners — update a banner
export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) {
      return NextResponse.json({ error: 'Banner ID required' }, { status: 400 })
    }

    const data = bannerSchema.parse(rest)

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        title: data.title,
        message: data.message,
        type: data.type as any,
        contentType: data.contentType,
        targetModule: data.targetModule || null,
        linkUrl: data.linkUrl || null,
        linkText: data.linkText || null,
        imageUrl: data.imageUrl || null,
        bgColor: data.bgColor || null,
        textColor: data.textColor || null,
        placement: data.placement as any,
        targetPlans: data.targetPlans || null,
        priority: data.priority,
        isActive: data.isActive,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        dismissible: data.dismissible,
      },
    })

    return NextResponse.json({ banner })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Banner update error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to update banner' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/marketing/banners — delete a banner
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Banner ID required' }, { status: 400 })
  }

  await prisma.banner.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
