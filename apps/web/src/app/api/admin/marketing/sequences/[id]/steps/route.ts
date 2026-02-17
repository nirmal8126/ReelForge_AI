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

// GET /api/admin/marketing/sequences/[id]/steps — list steps for a sequence
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = await params

  const steps = await prisma.emailSequenceStep.findMany({
    where: { sequenceId: id },
    orderBy: { stepOrder: 'asc' },
  })

  return NextResponse.json({ steps })
}

const stepSchema = z.object({
  stepOrder: z.number().int().min(0),
  delayDays: z.number().int().min(0),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
})

// POST /api/admin/marketing/sequences/[id]/steps — add a step
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const data = stepSchema.parse(body)

    const step = await prisma.emailSequenceStep.create({
      data: {
        sequenceId: id,
        stepOrder: data.stepOrder,
        delayDays: data.delayDays,
        subject: data.subject,
        body: data.body,
      },
    })

    return NextResponse.json({ step })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to add step' }, { status: 500 })
  }
}

// PUT /api/admin/marketing/sequences/[id]/steps — update a step
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  await params // validate route

  try {
    const body = await req.json()
    const { stepId, ...rest } = body
    if (!stepId) {
      return NextResponse.json({ error: 'Step ID required' }, { status: 400 })
    }

    const data = stepSchema.parse(rest)

    const step = await prisma.emailSequenceStep.update({
      where: { id: stepId },
      data: {
        stepOrder: data.stepOrder,
        delayDays: data.delayDays,
        subject: data.subject,
        body: data.body,
      },
    })

    return NextResponse.json({ step })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to update step' }, { status: 500 })
  }
}

// DELETE /api/admin/marketing/sequences/[id]/steps — delete a step
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  await params

  const { searchParams } = new URL(req.url)
  const stepId = searchParams.get('stepId')
  if (!stepId) {
    return NextResponse.json({ error: 'Step ID required' }, { status: 400 })
  }

  await prisma.emailSequenceStep.delete({ where: { id: stepId } })

  return NextResponse.json({ success: true })
}
