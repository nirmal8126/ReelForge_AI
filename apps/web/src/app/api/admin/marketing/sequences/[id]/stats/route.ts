import { NextRequest, NextResponse } from 'next/server'
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

// GET /api/admin/marketing/sequences/[id]/stats — enrollment stats
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = await params

  const [active, completed, unsubscribed, total] = await Promise.all([
    prisma.sequenceEnrollment.count({ where: { sequenceId: id, status: 'ACTIVE' } }),
    prisma.sequenceEnrollment.count({ where: { sequenceId: id, status: 'COMPLETED' } }),
    prisma.sequenceEnrollment.count({ where: { sequenceId: id, status: 'UNSUBSCRIBED' } }),
    prisma.sequenceEnrollment.count({ where: { sequenceId: id } }),
  ])

  return NextResponse.json({ stats: { active, completed, unsubscribed, total } })
}
