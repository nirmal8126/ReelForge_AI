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

// POST /api/admin/marketing/experiments/[id]/winner — declare a winner
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const { id } = params
    const body = await req.json()
    const { winnerId } = body

    if (!winnerId) {
      return NextResponse.json({ error: 'winnerId required' }, { status: 400 })
    }

    const experiment = await prisma.bannerExperiment.findUnique({ where: { id } })
    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }
    if (experiment.status !== 'RUNNING') {
      return NextResponse.json({ error: 'Experiment is not running' }, { status: 400 })
    }

    // Determine loser
    const loserId = winnerId === experiment.bannerAId
      ? experiment.bannerBId
      : experiment.bannerAId

    // Mark experiment as completed
    await prisma.bannerExperiment.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        winnerBannerId: winnerId,
        endedAt: new Date(),
      },
    })

    // Deactivate the losing banner
    await prisma.banner.update({
      where: { id: loserId },
      data: { isActive: false },
    })

    // Clear experiment references
    await prisma.banner.updateMany({
      where: { experimentId: id },
      data: { experimentId: null },
    })

    return NextResponse.json({ success: true, winnerId, loserId })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to declare winner' }, { status: 500 })
  }
}
