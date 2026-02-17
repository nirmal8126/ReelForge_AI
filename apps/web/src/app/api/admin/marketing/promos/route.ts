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

// GET /api/admin/marketing/promos — list all promo codes
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { redemptions: true } },
    },
  })

  return NextResponse.json({ promos })
}

const promoSchema = z.object({
  code: z.string().min(2).max(50).transform((v) => v.toUpperCase().replace(/\s/g, '')),
  description: z.string().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'CREDIT_BONUS']),
  discountValue: z.number().int().min(0),
  bonusCredits: z.number().int().min(0).default(0),
  maxUses: z.number().int().min(1).optional().nullable(),
  targetPlans: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().default(true),
  startsAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
})

// POST /api/admin/marketing/promos — create a promo code
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = promoSchema.parse(body)

    // Check uniqueness
    const existing = await prisma.promoCode.findUnique({ where: { code: data.code } })
    if (existing) {
      return NextResponse.json({ error: 'Promo code already exists' }, { status: 400 })
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: data.code,
        description: data.description || null,
        discountType: data.discountType as any,
        discountValue: data.discountValue,
        bonusCredits: data.bonusCredits,
        maxUses: data.maxUses || null,
        targetPlans: data.targetPlans || null,
        isActive: data.isActive,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    })

    return NextResponse.json({ promo })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Promo create error:', err)
    return NextResponse.json({ error: 'Failed to create promo code' }, { status: 500 })
  }
}

// PUT /api/admin/marketing/promos — update a promo code
export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) {
      return NextResponse.json({ error: 'Promo ID required' }, { status: 400 })
    }

    const data = promoSchema.parse(rest)

    const promo = await prisma.promoCode.update({
      where: { id },
      data: {
        code: data.code,
        description: data.description || null,
        discountType: data.discountType as any,
        discountValue: data.discountValue,
        bonusCredits: data.bonusCredits,
        maxUses: data.maxUses || null,
        targetPlans: data.targetPlans || null,
        isActive: data.isActive,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    })

    return NextResponse.json({ promo })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Promo update error:', err)
    return NextResponse.json({ error: 'Failed to update promo code' }, { status: 500 })
  }
}

// DELETE /api/admin/marketing/promos — delete a promo code
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Promo ID required' }, { status: 400 })
  }

  await prisma.promoCode.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
