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

// GET /api/admin/marketing/sequences — list all sequences with counts
export const dynamic = 'force-dynamic';
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const sequences = await prisma.emailSequence.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { steps: true, enrollments: true } },
    },
  })

  return NextResponse.json({ sequences })
}

const sequenceSchema = z.object({
  name: z.string().min(1).max(200),
  trigger: z.enum(['SIGNUP', 'INACTIVITY_7D', 'INACTIVITY_30D', 'PLAN_EXPIRY', 'FIRST_REEL', 'UPGRADE']),
  isActive: z.boolean().default(true),
})

// POST /api/admin/marketing/sequences — create a sequence
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = sequenceSchema.parse(body)

    const sequence = await prisma.emailSequence.create({
      data: {
        name: data.name,
        trigger: data.trigger as any,
        isActive: data.isActive,
      },
    })

    return NextResponse.json({ sequence })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to create sequence' }, { status: 500 })
  }
}

// PUT /api/admin/marketing/sequences — update a sequence
export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) {
      return NextResponse.json({ error: 'Sequence ID required' }, { status: 400 })
    }

    const data = sequenceSchema.parse(rest)

    const sequence = await prisma.emailSequence.update({
      where: { id },
      data: {
        name: data.name,
        trigger: data.trigger as any,
        isActive: data.isActive,
      },
    })

    return NextResponse.json({ sequence })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to update sequence' }, { status: 500 })
  }
}

// DELETE /api/admin/marketing/sequences — delete a sequence (cascades steps + enrollments)
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Sequence ID required' }, { status: 400 })
  }

  await prisma.emailSequence.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
