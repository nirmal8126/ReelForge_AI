import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'
import { generateShortCode } from '@/lib/utm-builder'

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

const utmLinkSchema = z.object({
  destinationUrl: z.string().url().max(1000),
  utmSource: z.string().min(1).max(100),
  utmMedium: z.string().min(1).max(100),
  utmCampaign: z.string().min(1).max(100),
  utmTerm: z.string().max(100).optional(),
  utmContent: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
})

// GET /api/admin/marketing/utm-links
export async function GET(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')

  const where: any = {}
  if (search) {
    where.OR = [
      { destinationUrl: { contains: search } },
      { utmSource: { contains: search } },
      { utmMedium: { contains: search } },
      { utmCampaign: { contains: search } },
      { shortCode: { contains: search } },
    ]
  }

  const links = await prisma.utmLink.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { clicks: true } } },
  })

  return NextResponse.json({ links })
}

// POST /api/admin/marketing/utm-links
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = utmLinkSchema.parse(body)

    // Generate unique short code with retry
    let shortCode = generateShortCode()
    let attempts = 0
    while (attempts < 5) {
      const existing = await prisma.utmLink.findUnique({ where: { shortCode } })
      if (!existing) break
      shortCode = generateShortCode()
      attempts++
    }

    const link = await prisma.utmLink.create({
      data: {
        shortCode,
        destinationUrl: data.destinationUrl,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        utmTerm: data.utmTerm,
        utmContent: data.utmContent,
        isActive: data.isActive ?? true,
      },
    })

    return NextResponse.json({ link }, { status: 201 })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to create UTM link' }, { status: 500 })
  }
}

// PUT /api/admin/marketing/utm-links
export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) {
      return NextResponse.json({ error: 'UTM link ID required' }, { status: 400 })
    }

    const data = utmLinkSchema.partial().parse(rest)

    const link = await prisma.utmLink.update({
      where: { id },
      data,
    })

    return NextResponse.json({ link })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to update UTM link' }, { status: 500 })
  }
}

// DELETE /api/admin/marketing/utm-links
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'UTM link ID required' }, { status: 400 })
  }

  await prisma.utmLink.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
