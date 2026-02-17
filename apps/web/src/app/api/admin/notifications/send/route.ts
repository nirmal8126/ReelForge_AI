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

const sendSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'PROMOTION', 'ANNOUNCEMENT', 'NEW_FEATURE', 'SYSTEM']).default('INFO'),
  linkUrl: z.string().max(500).optional().nullable(),
  target: z.object({
    type: z.enum(['all', 'plans', 'countries', 'user']),
    plans: z.array(z.string()).optional(),
    countries: z.array(z.string()).optional(),
    userId: z.string().optional(),
  }),
})

// POST /api/admin/notifications/send — send notifications to targeted users
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = sendSchema.parse(body)

    // Build user query based on target
    const where: any = { isActive: true }

    switch (data.target.type) {
      case 'plans':
        if (data.target.plans && data.target.plans.length > 0) {
          where.subscription = { plan: { in: data.target.plans } }
        }
        break
      case 'countries':
        if (data.target.countries && data.target.countries.length > 0) {
          where.country = { in: data.target.countries }
        }
        break
      case 'user':
        if (data.target.userId) {
          where.id = data.target.userId
        }
        break
      // 'all' — no additional filter
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    })

    if (users.length === 0) {
      return NextResponse.json({ error: 'No matching users found' }, { status: 400 })
    }

    // Bulk create notifications
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title: data.title,
        message: data.message,
        type: data.type as any,
        linkUrl: data.linkUrl || null,
      })),
    })

    return NextResponse.json({ success: true, count: users.length })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Notification send error:', err)
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
  }
}
