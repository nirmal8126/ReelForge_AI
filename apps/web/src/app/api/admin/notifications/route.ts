import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

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

// GET /api/admin/notifications — list sent notification batches
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  // Get distinct notification batches grouped by title + type + approximate time
  const batches = await prisma.notification.groupBy({
    by: ['title', 'message', 'type', 'linkUrl'],
    _count: { id: true },
    _min: { createdAt: true },
    orderBy: { _min: { createdAt: 'desc' } },
    take: 50,
  })

  return NextResponse.json({ batches })
}
