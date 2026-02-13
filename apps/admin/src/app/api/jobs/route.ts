import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'
import { getAdminSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || undefined
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 50

  const where = status ? { status: status as any } : {}

  const [jobs, total] = await Promise.all([
    prisma.reelJob.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.reelJob.count({ where }),
  ])

  return NextResponse.json({ jobs, total, page, pages: Math.ceil(total / limit) })
}
