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

// GET /api/admin/marketing/experiments — list all experiments with banner stats
export const dynamic = 'force-dynamic';
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const experiments = await prisma.bannerExperiment.findMany({
    orderBy: { createdAt: 'desc' },
  })

  // Fetch banner stats for each experiment
  const bannerIds = new Set<string>()
  for (const exp of experiments) {
    bannerIds.add(exp.bannerAId)
    bannerIds.add(exp.bannerBId)
  }

  const banners = bannerIds.size > 0
    ? await prisma.banner.findMany({
        where: { id: { in: [...bannerIds] } },
        select: { id: true, title: true, viewCount: true, clickCount: true, isActive: true, placement: true },
      })
    : []

  const bannerMap = Object.fromEntries(banners.map((b) => [b.id, b]))

  const results = experiments.map((exp) => ({
    ...exp,
    bannerA: bannerMap[exp.bannerAId] || null,
    bannerB: bannerMap[exp.bannerBId] || null,
  }))

  return NextResponse.json({ experiments: results })
}

const experimentSchema = z.object({
  name: z.string().min(1).max(200),
  bannerAId: z.string().min(1),
  bannerBId: z.string().min(1),
  splitPercent: z.number().int().min(1).max(99).default(50),
})

// POST /api/admin/marketing/experiments — create an experiment
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = experimentSchema.parse(body)

    if (data.bannerAId === data.bannerBId) {
      return NextResponse.json({ error: 'Banner A and B must be different' }, { status: 400 })
    }

    // Verify both banners exist
    const [bannerA, bannerB] = await Promise.all([
      prisma.banner.findUnique({ where: { id: data.bannerAId } }),
      prisma.banner.findUnique({ where: { id: data.bannerBId } }),
    ])

    if (!bannerA || !bannerB) {
      return NextResponse.json({ error: 'One or both banners not found' }, { status: 404 })
    }

    const experiment = await prisma.bannerExperiment.create({
      data: {
        name: data.name,
        bannerAId: data.bannerAId,
        bannerBId: data.bannerBId,
        splitPercent: data.splitPercent,
      },
    })

    // Mark banners with experiment reference
    await Promise.all([
      prisma.banner.update({ where: { id: data.bannerAId }, data: { experimentId: experiment.id } }),
      prisma.banner.update({ where: { id: data.bannerBId }, data: { experimentId: experiment.id } }),
    ])

    return NextResponse.json({ experiment })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to create experiment' }, { status: 500 })
  }
}

// PUT /api/admin/marketing/experiments — stop an experiment
export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { id, status } = body
    if (!id) {
      return NextResponse.json({ error: 'Experiment ID required' }, { status: 400 })
    }

    const experiment = await prisma.bannerExperiment.update({
      where: { id },
      data: {
        status: status || 'STOPPED',
        endedAt: new Date(),
      },
    })

    return NextResponse.json({ experiment })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update experiment' }, { status: 500 })
  }
}

// DELETE /api/admin/marketing/experiments — delete a stopped/completed experiment
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Experiment ID required' }, { status: 400 })
  }

  const existing = await prisma.bannerExperiment.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
  }

  // Clear experiment references from banners
  await prisma.banner.updateMany({
    where: { experimentId: id },
    data: { experimentId: null },
  })

  await prisma.bannerExperiment.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
