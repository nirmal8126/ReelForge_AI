import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const job = await prisma.longFormJob.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { id: true, status: true },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'COMPLETED' && job.status !== 'RECOMPOSING') {
      return NextResponse.json({ error: 'Job must be completed to reorder segments' }, { status: 400 })
    }

    const { segmentIds } = await req.json() as { segmentIds: string[] }

    if (!Array.isArray(segmentIds) || segmentIds.length === 0) {
      return NextResponse.json({ error: 'segmentIds array is required' }, { status: 400 })
    }

    // Get all segments to recalculate timing
    const segments = await prisma.longFormSegment.findMany({
      where: { longFormJobId: params.id },
      orderBy: { segmentIndex: 'asc' },
    })

    const segmentMap = new Map(segments.map((s) => [s.id, s]))

    // Validate all IDs exist
    for (const id of segmentIds) {
      if (!segmentMap.has(id)) {
        return NextResponse.json({ error: `Segment ${id} not found` }, { status: 400 })
      }
    }

    // Update indices and recalculate start/end times
    let cumTime = 0
    const updates = segmentIds.map((id, index) => {
      const seg = segmentMap.get(id)!
      const duration = seg.endTime - seg.startTime
      const startTime = cumTime
      const endTime = cumTime + duration
      cumTime = endTime

      return prisma.longFormSegment.update({
        where: { id },
        data: { segmentIndex: index, startTime, endTime },
      })
    })

    await prisma.$transaction(updates)

    // Return updated segments
    const updated = await prisma.longFormSegment.findMany({
      where: { longFormJobId: params.id },
      orderBy: { segmentIndex: 'asc' },
    })

    return NextResponse.json({ segments: updated })
  } catch (error) {
    console.error('Segment reorder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
