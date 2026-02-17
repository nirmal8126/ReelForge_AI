import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
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

// GET /api/admin/marketing/segments/[id]/preview
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const segment = await prisma.userSegment.findUnique({
    where: { id: params.id },
  })

  if (!segment) {
    return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
  }

  const rules = segment.rules as unknown as SegmentRules
  const where = resolveSegmentRules(rules)

  const [count, sampleUsers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, country: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Update cached count
  await prisma.userSegment.update({
    where: { id: params.id },
    data: { cachedCount: count, lastCountAt: new Date() },
  })

  return NextResponse.json({ count, sampleUsers })
}
