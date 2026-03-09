import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma, Prisma } from '@reelforge/db'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// GET /api/templates — browse templates
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const moduleType = searchParams.get('moduleType')
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const featured = searchParams.get('featured')
  const mine = searchParams.get('mine')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)))
  const skip = (page - 1) * limit

  // Build where clause
  const conditions: Prisma.ContentTemplateWhereInput[] = []

  // Show system templates + user's own templates
  if (mine === 'true') {
    conditions.push({ userId: session.user.id })
  } else {
    conditions.push({
      OR: [
        { isSystem: true, isPublic: true },
        { userId: session.user.id },
      ],
    })
  }

  if (moduleType) {
    conditions.push({
      moduleType: moduleType as 'REEL' | 'LONG_FORM' | 'QUOTE' | 'CHALLENGE' | 'GAMEPLAY' | 'IMAGE_STUDIO' | 'CARTOON',
    })
  }

  if (category) {
    conditions.push({ category })
  }

  if (featured === 'true') {
    conditions.push({ isFeatured: true })
  }

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search } },
        { description: { contains: search } },
        { category: { contains: search } },
      ],
    })
  }

  const where: Prisma.ContentTemplateWhereInput =
    conditions.length > 0 ? { AND: conditions } : {}

  const [templates, total] = await Promise.all([
    prisma.contentTemplate.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { useCount: 'desc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.contentTemplate.count({ where }),
  ])

  // Get distinct categories for filter
  const categories = await prisma.contentTemplate.groupBy({
    by: ['category'],
    where: {
      OR: [
        { isSystem: true, isPublic: true },
        { userId: session.user.id },
      ],
    },
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  })

  return NextResponse.json({
    templates,
    categories: categories.map((c) => ({ name: c.category, count: c._count })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

// ---------------------------------------------------------------------------
// POST /api/templates — create custom template
// ---------------------------------------------------------------------------

const createTemplateSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  moduleType: z.enum(['REEL', 'LONG_FORM', 'QUOTE', 'CHALLENGE', 'GAMEPLAY', 'IMAGE_STUDIO', 'CARTOON']),
  category: z.string().min(1).max(50),
  tags: z.array(z.string()).optional(),
  promptTemplate: z.string().min(10).max(5000),
  defaultSettings: z.record(z.unknown()),
  themeConfig: z.record(z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = createTemplateSchema.parse(body)

    const template = await prisma.contentTemplate.create({
      data: {
        userId: session.user.id,
        name: data.name,
        description: data.description || null,
        moduleType: data.moduleType,
        category: data.category,
        tags: data.tags ? (data.tags as Prisma.InputJsonValue) : Prisma.JsonNull,
        promptTemplate: data.promptTemplate,
        defaultSettings: data.defaultSettings as Prisma.InputJsonValue,
        themeConfig: data.themeConfig
          ? (data.themeConfig as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        isSystem: false,
        isPublic: false,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('POST /api/templates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
