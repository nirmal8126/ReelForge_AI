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

const campaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  creditMultiplier: z.number().min(1).max(10).default(1),
  bonusCredits: z.number().int().min(0).max(1000).default(0),
  cashMultiplier: z.number().min(1).max(10).default(1),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']).default('DRAFT'),
  startsAt: z.string(),
  endsAt: z.string(),
  targetSegmentId: z.string().optional().nullable(),
})

// GET /api/admin/marketing/referral-campaigns
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const campaigns = await prisma.referralCampaign.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ campaigns })
}

// POST /api/admin/marketing/referral-campaigns
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = campaignSchema.parse(body)

    const campaign = await prisma.referralCampaign.create({
      data: {
        name: data.name,
        description: data.description || null,
        creditMultiplier: data.creditMultiplier,
        bonusCredits: data.bonusCredits,
        cashMultiplier: data.cashMultiplier,
        status: data.status as any,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        targetSegmentId: data.targetSegmentId || null,
      },
    })

    return NextResponse.json({ campaign })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Referral campaign create error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create campaign' }, { status: 500 })
  }
}

// PUT /api/admin/marketing/referral-campaigns
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

    const data = campaignSchema.parse(rest)

    const campaign = await prisma.referralCampaign.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        creditMultiplier: data.creditMultiplier,
        bonusCredits: data.bonusCredits,
        cashMultiplier: data.cashMultiplier,
        status: data.status as any,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        targetSegmentId: data.targetSegmentId || null,
      },
    })

    return NextResponse.json({ campaign })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Referral campaign update error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to update campaign' }, { status: 500 })
  }
}

// DELETE /api/admin/marketing/referral-campaigns
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

  const existing = await prisma.referralCampaign.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }
  if (existing.status === 'ACTIVE') {
    return NextResponse.json({ error: 'Cannot delete active campaigns. Cancel it first.' }, { status: 400 })
  }

  await prisma.referralCampaign.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
