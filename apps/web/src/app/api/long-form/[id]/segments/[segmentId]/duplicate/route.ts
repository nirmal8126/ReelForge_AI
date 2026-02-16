import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

export async function POST(
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

    // Get all segments for re-indexing
    const allSegments = await prisma.longFormSegment.findMany({
      where: { longFormJobId: params.id },
      orderBy: { segmentIndex: 'asc' },
    })

    // Build new segments list: insert duplicate right after the original
    const targetIndex = allSegments.findIndex((s) => s.id === params.segmentId)
    const duplicateDuration = segment.endTime - segment.startTime

    // Calculate timing for all segments including the duplicate
    const segmentsWithDuplicate = [
      ...allSegments.slice(0, targetIndex + 1),
      { id: '__duplicate__', duration: duplicateDuration },
      ...allSegments.slice(targetIndex + 1),
    ]

    let cumTime = 0
    const timedSegments = segmentsWithDuplicate.map((seg, index) => {
      const duration = seg.id === '__duplicate__'
        ? duplicateDuration
        : (seg as typeof allSegments[number]).endTime - (seg as typeof allSegments[number]).startTime
      const startTime = cumTime
      const endTime = cumTime + duration
      cumTime = endTime
      return { id: seg.id, segmentIndex: index, startTime, endTime }
    })

    const duplicateTimed = timedSegments.find((s) => s.id === '__duplicate__')!

    // Execute in transaction
    await prisma.$transaction([
      // Step 1: Set all existing segment indices to negative to avoid unique constraint
      ...allSegments.map((seg, i) =>
        prisma.longFormSegment.update({
          where: { id: seg.id },
          data: { segmentIndex: -(i + 1) },
        })
      ),
      // Step 2: Create the duplicate segment
      prisma.longFormSegment.create({
        data: {
          longFormJobId: params.id,
          segmentIndex: duplicateTimed.segmentIndex,
          title: segment.title + ' (copy)',
          scriptText: segment.scriptText,
          startTime: duplicateTimed.startTime,
          endTime: duplicateTimed.endTime,
          visualType: segment.visualType,
          assetUrl: segment.assetUrl,
          assetMetadata: segment.assetMetadata ?? undefined,
          transitionType: segment.transitionType,
          captionsEnabled: segment.captionsEnabled,
          titleOverlay: segment.titleOverlay,
          status: segment.status,
        },
      }),
      // Step 3: Update indices and timing for all existing segments
      ...allSegments.map((seg) => {
        const timed = timedSegments.find((t) => t.id === seg.id)!
        return prisma.longFormSegment.update({
          where: { id: seg.id },
          data: {
            segmentIndex: timed.segmentIndex,
            startTime: timed.startTime,
            endTime: timed.endTime,
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
    console.error('Segment duplicate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
