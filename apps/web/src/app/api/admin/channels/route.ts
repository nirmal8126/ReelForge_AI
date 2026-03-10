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
    return { error: 'Forbidden — Super Admin access required', status: 403 }
  }
  return { userId: session.user.id }
}

// GET /api/admin/channels — list all channel profiles with owner info
export async function GET(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const url = new URL(req.url)
  const search = url.searchParams.get('search') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = 20

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { niche: { contains: search } },
          { user: { name: { contains: search } } },
          { user: { email: { contains: search } } },
        ],
      }
    : {}

  const [profiles, total] = await Promise.all([
    prisma.channelProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { reelJobs: true, longFormJobs: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.channelProfile.count({ where }),
  ])

  return NextResponse.json({
    profiles,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

// DELETE /api/admin/channels?id=xxx — admin delete a channel profile
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const profile = await prisma.channelProfile.findUnique({
    where: { id },
    include: { _count: { select: { reelJobs: true, longFormJobs: true } } },
  })

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const totalJobs = profile._count.reelJobs + profile._count.longFormJobs
  if (totalJobs > 0) {
    return NextResponse.json(
      { error: `Cannot delete — profile has ${totalJobs} job(s) attached` },
      { status: 400 }
    )
  }

  await prisma.channelProfile.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
