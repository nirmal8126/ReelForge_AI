import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma, Prisma } from '@reelforge/db'
import { z } from 'zod'
import { resolveSegmentRules, SegmentRules } from '@/lib/segment-resolver'

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

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['eq', 'neq', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'between', 'contains']),
  value: z.any(),
})

const segmentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  rules: z.object({
    conditions: z.array(conditionSchema).min(1),
    match: z.enum(['all', 'any']),
  }),
  isActive: z.boolean().default(true),
})

// GET /api/admin/marketing/segments — list all segments
export const dynamic = 'force-dynamic';
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const segments = await prisma.userSegment.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ segments })
}

// POST /api/admin/marketing/segments — create a segment
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = segmentSchema.parse(body)

    // Compute initial user count
    const where = resolveSegmentRules(data.rules as SegmentRules)
    const count = await prisma.user.count({ where })

    const segment = await prisma.userSegment.create({
      data: {
        name: data.name,
        description: data.description || null,
        rules: data.rules as any,
        matchType: data.rules.match === 'any' ? 'ANY' : 'ALL',
        isActive: data.isActive,
        cachedCount: count,
        lastCountAt: new Date(),
      },
    })

    return NextResponse.json({ segment })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Segment create error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create segment' }, { status: 500 })
  }
}

// PUT /api/admin/marketing/segments — update a segment
export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) {
      return NextResponse.json({ error: 'Segment ID required' }, { status: 400 })
    }

    const data = segmentSchema.parse(rest)

    // Recompute user count
    const where = resolveSegmentRules(data.rules as SegmentRules)
    const count = await prisma.user.count({ where })

    const segment = await prisma.userSegment.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        rules: data.rules as any,
        matchType: data.rules.match === 'any' ? 'ANY' : 'ALL',
        isActive: data.isActive,
        cachedCount: count,
        lastCountAt: new Date(),
      },
    })

    return NextResponse.json({ segment })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Segment update error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to update segment' }, { status: 500 })
  }
}

// DELETE /api/admin/marketing/segments
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Segment ID required' }, { status: 400 })
  }

  await prisma.userSegment.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
