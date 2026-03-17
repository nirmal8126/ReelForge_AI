import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { getRegionForCountry } from '@/lib/pricing'

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

// ---------------------------------------------------------------------------
// GET /api/admin/pricing — list all pricing regions (auto-seeds GLOBAL)
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  let regions = await prisma.pricingRegion.findMany({
    include: { planPrices: true, creditPrices: true },
    orderBy: { createdAt: 'asc' },
  })

  // Auto-seed GLOBAL if empty
  if (regions.length === 0) {
    await getRegionForCountry('US')
    regions = await prisma.pricingRegion.findMany({
      include: { planPrices: true, creditPrices: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  return NextResponse.json({ regions })
}

// ---------------------------------------------------------------------------
// POST /api/admin/pricing — create a new pricing region
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const { name, currency, currencySymbol, countries, isDefault, planPrices, creditPrices } = body

  if (!name || !currency || !currencySymbol) {
    return NextResponse.json({ error: 'name, currency, currencySymbol are required' }, { status: 400 })
  }

  // If setting as default, unset other defaults
  if (isDefault) {
    await prisma.pricingRegion.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
  }

  const region = await prisma.pricingRegion.create({
    data: {
      name: name.toUpperCase(),
      currency: currency.toLowerCase(),
      currencySymbol,
      countries: countries || [],
      isDefault: isDefault || false,
      planPrices: {
        create: Array.isArray(planPrices)
          ? planPrices.map((p: { plan: string; priceAmount: number; stripePriceId?: string }) => ({
              plan: p.plan as 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE',
              priceAmount: p.priceAmount,
              stripePriceId: p.stripePriceId || null,
            }))
          : [],
      },
      creditPrices: {
        create: Array.isArray(creditPrices)
          ? creditPrices.map((c: { credits: number; priceAmount: number; label: string }) => ({
              credits: c.credits,
              priceAmount: c.priceAmount,
              label: c.label,
            }))
          : [],
      },
    },
    include: { planPrices: true, creditPrices: true },
  })

  return NextResponse.json({ region }, { status: 201 })
}

// ---------------------------------------------------------------------------
// PUT /api/admin/pricing — update a pricing region
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const { id, name, currency, currencySymbol, countries, isDefault, planPrices, creditPrices } = body

  if (!id) {
    return NextResponse.json({ error: 'Region id is required' }, { status: 400 })
  }

  const existing = await prisma.pricingRegion.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Region not found' }, { status: 404 })
  }

  // If setting as default, unset other defaults
  if (isDefault) {
    await prisma.pricingRegion.updateMany({
      where: { isDefault: true, NOT: { id } },
      data: { isDefault: false },
    })
  }

  // Update region core fields
  await prisma.pricingRegion.update({
    where: { id },
    data: {
      ...(name && { name: name.toUpperCase() }),
      ...(currency && { currency: currency.toLowerCase() }),
      ...(currencySymbol && { currencySymbol }),
      ...(countries !== undefined && { countries }),
      ...(isDefault !== undefined && { isDefault }),
    },
  })

  // Upsert plan prices
  if (Array.isArray(planPrices)) {
    for (const p of planPrices as { plan: string; priceAmount: number; stripePriceId?: string }[]) {
      await prisma.regionPlanPrice.upsert({
        where: { regionId_plan: { regionId: id, plan: p.plan as 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE' } },
        update: { priceAmount: p.priceAmount, stripePriceId: p.stripePriceId || null },
        create: {
          regionId: id,
          plan: p.plan as 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE',
          priceAmount: p.priceAmount,
          stripePriceId: p.stripePriceId || null,
        },
      })
    }
  }

  // Upsert credit prices
  if (Array.isArray(creditPrices)) {
    for (const c of creditPrices as { credits: number; priceAmount: number; label: string }[]) {
      await prisma.regionCreditPrice.upsert({
        where: { regionId_credits: { regionId: id, credits: c.credits } },
        update: { priceAmount: c.priceAmount, label: c.label },
        create: {
          regionId: id,
          credits: c.credits,
          priceAmount: c.priceAmount,
          label: c.label,
        },
      })
    }
  }

  const updated = await prisma.pricingRegion.findUnique({
    where: { id },
    include: { planPrices: true, creditPrices: true },
  })

  return NextResponse.json({ region: updated })
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/pricing — delete a pricing region
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Region id is required' }, { status: 400 })
  }

  const region = await prisma.pricingRegion.findUnique({ where: { id } })
  if (!region) {
    return NextResponse.json({ error: 'Region not found' }, { status: 404 })
  }

  if (region.isDefault) {
    return NextResponse.json({ error: 'Cannot delete the default region' }, { status: 400 })
  }

  await prisma.pricingRegion.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
