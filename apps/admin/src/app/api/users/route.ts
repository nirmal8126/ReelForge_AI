import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 50

  const where = q ? {
    OR: [
      { name: { contains: q } },
      { email: { contains: q } },
    ],
  } : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        subscription: { select: { plan: true, status: true, jobsUsed: true } },
        _count: { select: { reelJobs: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) })
}
