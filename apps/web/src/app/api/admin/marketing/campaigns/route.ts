import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma, Prisma } from '@reelforge/db'
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

const campaignSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  targetPlans: z.array(z.string()).optional().nullable(),
  targetCountries: z.array(z.string()).optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  targetSegmentId: z.string().optional().nullable(),
})

// GET /api/admin/marketing/campaigns — list all campaigns
export const dynamic = 'force-dynamic';
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ campaigns })
}

// POST /api/admin/marketing/campaigns — create a campaign (DRAFT)
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = campaignSchema.parse(body)

    const campaign = await prisma.emailCampaign.create({
      data: {
        name: data.name,
        subject: data.subject,
        body: data.body,
        targetPlans: data.targetPlans && data.targetPlans.length > 0 ? data.targetPlans : Prisma.JsonNull,
        targetCountries: data.targetCountries && data.targetCountries.length > 0 ? data.targetCountries : Prisma.JsonNull,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        targetSegmentId: data.targetSegmentId || null,
      },
    })

    return NextResponse.json({ campaign })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to create campaign' }, { status: 500 })
  }
}

// PUT /api/admin/marketing/campaigns — update a campaign (only DRAFT)
export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
    }

    const existing = await prisma.emailCampaign.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Only DRAFT campaigns can be edited' }, { status: 400 })
    }

    const data = campaignSchema.parse(rest)

    const campaign = await prisma.emailCampaign.update({
      where: { id },
      data: {
        name: data.name,
        subject: data.subject,
        body: data.body,
        targetPlans: data.targetPlans && data.targetPlans.length > 0 ? data.targetPlans : Prisma.JsonNull,
        targetCountries: data.targetCountries && data.targetCountries.length > 0 ? data.targetCountries : Prisma.JsonNull,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        targetSegmentId: data.targetSegmentId || null,
      },
    })

    return NextResponse.json({ campaign })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to update campaign' }, { status: 500 })
  }
}

// DELETE /api/admin/marketing/campaigns — delete a campaign (only DRAFT)
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
  }

  const existing = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }
  if (existing.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only DRAFT campaigns can be deleted' }, { status: 400 })
  }

  await prisma.emailCampaign.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
