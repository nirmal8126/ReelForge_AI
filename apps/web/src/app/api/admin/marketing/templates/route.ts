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

function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g) || []
  const vars = matches.map((m) => m.replace(/\{\{|\}\}/g, ''))
  return Array.from(new Set(vars))
}

const templateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(['WELCOME', 'PROMOTIONAL', 'NEWSLETTER', 'TRANSACTIONAL', 'NOTIFICATION', 'CUSTOM']).optional(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  isActive: z.boolean().optional(),
})

// GET /api/admin/marketing/templates
export async function GET(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  const where: any = {}
  if (category) where.category = category
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { subject: { contains: search } },
    ]
  }

  const templates = await prisma.emailTemplate.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ templates })
}

// POST /api/admin/marketing/templates
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = templateSchema.parse(body)
    const variables = extractVariables(data.body)

    const template = await prisma.emailTemplate.create({
      data: {
        name: data.name,
        category: data.category || 'CUSTOM',
        subject: data.subject,
        body: data.body,
        variables,
        isActive: data.isActive ?? true,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to create template' }, { status: 500 })
  }
}

// PUT /api/admin/marketing/templates
export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
    }

    const data = templateSchema.partial().parse(rest)
    const updateData: any = { ...data }

    if (data.body) {
      updateData.variables = extractVariables(data.body)
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ template })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to update template' }, { status: 500 })
  }
}

// DELETE /api/admin/marketing/templates
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
  }

  await prisma.emailTemplate.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
