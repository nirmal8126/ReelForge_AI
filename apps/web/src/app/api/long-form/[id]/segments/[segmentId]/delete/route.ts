import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; segmentId: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Verify job ownership
    const job = await prisma.longFormJob.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { id: true, status: true },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'COMPLETED' && job.status !== 'RECOMPOSING') {
      return NextResponse.json({ error: 'Job must be completed to edit segments' }, { status: 400 })
    }

    // Verify segment belongs to this job
    const segment = await prisma.longFormSegment.findFirst({
      where: { id: params.segmentId, longFormJobId: params.id },
    })

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    // Get all segments for this job
    const allSegments = await prisma.longFormSegment.findMany({
      where: { longFormJobId: params.id },
      orderBy: { segmentIndex: 'asc' },
    })

    if (allSegments.length <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last segment' }, { status: 400 })
    }

    // Remove the target segment from the list
    const remaining = allSegments.filter((s) => s.id !== params.segmentId)

    // Use a transaction: delete the segment, then re-index remaining ones
    // To avoid unique constraint violations on [longFormJobId, segmentIndex],
    // first set all indices to negative values, then set correct values
    await prisma.$transaction([
      // Delete the segment
      prisma.longFormSegment.delete({
        where: { id: params.segmentId },
      }),
      // Set remaining segment indices to negative (temporary) to avoid unique constraint
      ...remaining.map((seg, index) =>
        prisma.longFormSegment.update({
          where: { id: seg.id },
          data: { segmentIndex: -(index + 1) },
        })
      ),
      // Now set correct indices and recalculate timing
      ...remaining.map((seg, index) => {
        const duration = seg.endTime - seg.startTime
        const startTime = remaining
          .slice(0, index)
          .reduce((acc, s) => acc + (s.endTime - s.startTime), 0)
        const endTime = startTime + duration

        return prisma.longFormSegment.update({
          where: { id: seg.id },
          data: {
            segmentIndex: index,
            startTime,
            endTime,
          },
        })
      }),
    ])

    // Return updated segments
    const updated = await prisma.longFormSegment.findMany({
      where: { longFormJobId: params.id },
      orderBy: { segmentIndex: 'asc' },
    })

    return NextResponse.json({ segments: updated })
  } catch (error) {
    console.error('Segment delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
