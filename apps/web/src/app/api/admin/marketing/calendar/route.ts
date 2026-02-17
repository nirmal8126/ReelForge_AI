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

interface CalendarEvent {
  id: string
  title: string
  type: string
  date: string
  endDate?: string
  color: string
  referenceId?: string
}

// GET /api/admin/marketing/calendar?month=2025-06
export async function GET(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM

  let from: Date
  let to: Date

  if (month) {
    const [year, m] = month.split('-').map(Number)
    from = new Date(year, m - 1, 1)
    to = new Date(year, m, 0, 23, 59, 59, 999) // last day of month
  } else {
    const now = new Date()
    from = new Date(now.getFullYear(), now.getMonth(), 1)
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  }

  const events: CalendarEvent[] = []

  // Fetch all sources in parallel
  const [campaigns, banners, promos, sequences, referralCampaigns, experiments, customEvents] = await Promise.all([
    // Campaigns — scheduled/sent dates within range
    prisma.emailCampaign.findMany({
      where: {
        OR: [
          { scheduledAt: { gte: from, lte: to } },
          { sentAt: { gte: from, lte: to } },
          { createdAt: { gte: from, lte: to } },
        ],
      },
      select: { id: true, name: true, status: true, scheduledAt: true, sentAt: true, createdAt: true },
    }),
    // Banners — startsAt/expiresAt overlapping range
    prisma.banner.findMany({
      where: {
        OR: [
          { startsAt: { gte: from, lte: to } },
          { expiresAt: { gte: from, lte: to } },
          { AND: [{ startsAt: { lte: from } }, { expiresAt: { gte: to } }] },
          { AND: [{ startsAt: null }, { createdAt: { gte: from, lte: to } }] },
        ],
      },
      select: { id: true, title: true, startsAt: true, expiresAt: true, createdAt: true },
    }),
    // Promos — startsAt/expiresAt overlapping range
    prisma.promoCode.findMany({
      where: {
        OR: [
          { startsAt: { gte: from, lte: to } },
          { expiresAt: { gte: from, lte: to } },
          { AND: [{ startsAt: { lte: from } }, { expiresAt: { gte: to } }] },
          { createdAt: { gte: from, lte: to } },
        ],
      },
      select: { id: true, code: true, startsAt: true, expiresAt: true, createdAt: true },
    }),
    // Sequences — created within range
    prisma.emailSequence.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, name: true, createdAt: true },
    }),
    // Referral campaigns — startsAt/endsAt overlapping range
    prisma.referralCampaign.findMany({
      where: {
        OR: [
          { startsAt: { gte: from, lte: to } },
          { endsAt: { gte: from, lte: to } },
          { AND: [{ startsAt: { lte: from } }, { endsAt: { gte: to } }] },
        ],
      },
      select: { id: true, name: true, startsAt: true, endsAt: true },
    }),
    // Experiments — startedAt/endedAt overlapping range
    prisma.bannerExperiment.findMany({
      where: {
        OR: [
          { startedAt: { gte: from, lte: to } },
          { endedAt: { gte: from, lte: to } },
          { AND: [{ startedAt: { lte: from } }, { endedAt: { gte: to } }] },
          { AND: [{ startedAt: { lte: from } }, { endedAt: null }] },
        ],
      },
      select: { id: true, name: true, startedAt: true, endedAt: true },
    }),
    // Custom marketing events
    prisma.marketingEvent.findMany({
      where: {
        OR: [
          { date: { gte: from, lte: to } },
          { endDate: { gte: from, lte: to } },
        ],
      },
    }),
  ])

  // Map campaigns
  for (const c of campaigns) {
    const date = c.sentAt || c.scheduledAt || c.createdAt
    events.push({
      id: c.id,
      title: `Campaign: ${c.name}`,
      type: 'CAMPAIGN',
      date: date.toISOString(),
      color: '#3B82F6', // blue
      referenceId: c.id,
    })
  }

  // Map banners
  for (const b of banners) {
    const date = b.startsAt || b.createdAt
    events.push({
      id: b.id,
      title: `Banner: ${b.title}`,
      type: 'BANNER',
      date: date.toISOString(),
      endDate: b.expiresAt?.toISOString(),
      color: '#8B5CF6', // purple
      referenceId: b.id,
    })
  }

  // Map promos
  for (const p of promos) {
    const date = p.startsAt || p.createdAt
    events.push({
      id: p.id,
      title: `Promo: ${p.code}`,
      type: 'PROMO',
      date: date.toISOString(),
      endDate: p.expiresAt?.toISOString(),
      color: '#10B981', // green
      referenceId: p.id,
    })
  }

  // Map sequences
  for (const s of sequences) {
    events.push({
      id: s.id,
      title: `Sequence: ${s.name}`,
      type: 'SEQUENCE',
      date: s.createdAt.toISOString(),
      color: '#F59E0B', // orange
      referenceId: s.id,
    })
  }

  // Map referral campaigns
  for (const rc of referralCampaigns) {
    events.push({
      id: rc.id,
      title: `Referral: ${rc.name}`,
      type: 'REFERRAL_CAMPAIGN',
      date: rc.startsAt.toISOString(),
      endDate: rc.endsAt.toISOString(),
      color: '#EC4899', // pink
      referenceId: rc.id,
    })
  }

  // Map experiments
  for (const e of experiments) {
    events.push({
      id: e.id,
      title: `Experiment: ${e.name}`,
      type: 'EXPERIMENT',
      date: e.startedAt.toISOString(),
      endDate: e.endedAt?.toISOString(),
      color: '#EAB308', // yellow
      referenceId: e.id,
    })
  }

  // Map custom events
  for (const ce of customEvents) {
    events.push({
      id: ce.id,
      title: ce.title,
      type: ce.type,
      date: ce.date.toISOString(),
      endDate: ce.endDate?.toISOString(),
      color: ce.color || '#6B7280', // gray
      referenceId: ce.referenceId || undefined,
    })
  }

  return NextResponse.json({ events })
}

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  date: z.string().min(1),
  endDate: z.string().optional(),
  color: z.string().max(20).optional(),
})

// POST /api/admin/marketing/calendar — create custom event
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = eventSchema.parse(body)

    const event = await prisma.marketingEvent.create({
      data: {
        title: data.title,
        description: data.description,
        type: 'CUSTOM',
        date: new Date(data.date),
        endDate: data.endDate ? new Date(data.endDate) : null,
        color: data.color || '#6B7280',
      },
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to create event' }, { status: 500 })
  }
}

// PUT /api/admin/marketing/calendar — update custom event
export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 })
    }

    const existing = await prisma.marketingEvent.findUnique({ where: { id } })
    if (!existing || existing.type !== 'CUSTOM') {
      return NextResponse.json({ error: 'Only custom events can be edited' }, { status: 400 })
    }

    const data = eventSchema.partial().parse(rest)
    const updateData: any = { ...data }
    if (data.date) updateData.date = new Date(data.date)
    if (data.endDate) updateData.endDate = new Date(data.endDate)

    const event = await prisma.marketingEvent.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ event })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to update event' }, { status: 500 })
  }
}

// DELETE /api/admin/marketing/calendar
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Event ID required' }, { status: 400 })
  }

  const existing = await prisma.marketingEvent.findUnique({ where: { id } })
  if (!existing || existing.type !== 'CUSTOM') {
    return NextResponse.json({ error: 'Only custom events can be deleted' }, { status: 400 })
  }

  await prisma.marketingEvent.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
