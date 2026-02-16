import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

/**
 * Split sentences from text. Handles common sentence-ending punctuation.
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries while keeping the delimiters
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g)
  if (!sentences) return [text]
  // Check for any trailing text without sentence-ending punctuation
  const joined = sentences.join('')
  if (joined.length < text.length) {
    sentences.push(text.slice(joined.length))
  }
  return sentences.filter((s) => s.trim().length > 0)
}

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

    const body = await req.json()
    const { splitPoint } = body as { splitPoint: number }

    if (typeof splitPoint !== 'number' || splitPoint <= 0 || splitPoint >= 1) {
      return NextResponse.json(
        { error: 'splitPoint must be a number between 0 and 1 (exclusive)' },
        { status: 400 }
      )
    }

    // Split the script text by sentences
    const sentences = splitIntoSentences(segment.scriptText)
    const splitIndex = Math.max(1, Math.round(sentences.length * splitPoint))

    const firstHalfText = sentences.slice(0, splitIndex).join('').trim()
    const secondHalfText = sentences.slice(splitIndex).join('').trim()

    // If we can't split the text (e.g., only one sentence), return error
    if (!firstHalfText || !secondHalfText) {
      return NextResponse.json(
        { error: 'Cannot split segment: not enough sentences to split at the given point' },
        { status: 400 }
      )
    }

    // Calculate durations proportionally
    const totalDuration = segment.endTime - segment.startTime
    const firstDuration = totalDuration * splitPoint
    const secondDuration = totalDuration - firstDuration

    // Get all segments for re-indexing
    const allSegments = await prisma.longFormSegment.findMany({
      where: { longFormJobId: params.id },
      orderBy: { segmentIndex: 'asc' },
    })

    // Build new segments list: insert second half right after the original
    const targetIndex = allSegments.findIndex((s) => s.id === params.segmentId)
    const newSegmentsList = [
      ...allSegments.slice(0, targetIndex),
      { ...allSegments[targetIndex], scriptText: firstHalfText, _isFirst: true as const },
      {
        ...allSegments[targetIndex],
        id: '__new__',
        title: segment.title + ' (pt. 2)',
        scriptText: secondHalfText,
        _isFirst: false as const,
      },
      ...allSegments.slice(targetIndex + 1),
    ]

    // Calculate timing for all segments
    let cumTime = 0
    const timedSegments = newSegmentsList.map((seg, index) => {
      let duration: number
      if (seg.id === params.segmentId) {
        duration = firstDuration
      } else if (seg.id === '__new__') {
        duration = secondDuration
      } else {
        duration = seg.endTime - seg.startTime
      }
      const startTime = cumTime
      const endTime = cumTime + duration
      cumTime = endTime
      return { ...seg, segmentIndex: index, startTime, endTime, duration }
    })

    // Execute in transaction
    await prisma.$transaction([
      // Step 1: Set all existing segment indices to negative to avoid unique constraint
      ...allSegments.map((seg, i) =>
        prisma.longFormSegment.update({
          where: { id: seg.id },
          data: { segmentIndex: -(i + 1) },
        })
      ),
      // Step 2: Update the original segment (first half)
      prisma.longFormSegment.update({
        where: { id: params.segmentId },
        data: {
          scriptText: firstHalfText,
          segmentIndex: timedSegments.find((s) => s.id === params.segmentId)!.segmentIndex,
          startTime: timedSegments.find((s) => s.id === params.segmentId)!.startTime,
          endTime: timedSegments.find((s) => s.id === params.segmentId)!.endTime,
        },
      }),
      // Step 3: Create the new segment (second half)
      prisma.longFormSegment.create({
        data: {
          longFormJobId: params.id,
          segmentIndex: timedSegments.find((s) => s.id === '__new__')!.segmentIndex,
          title: segment.title + ' (pt. 2)',
          scriptText: secondHalfText,
          startTime: timedSegments.find((s) => s.id === '__new__')!.startTime,
          endTime: timedSegments.find((s) => s.id === '__new__')!.endTime,
          visualType: segment.visualType,
          assetUrl: segment.assetUrl,
          assetMetadata: segment.assetMetadata ?? undefined,
          transitionType: segment.transitionType,
          captionsEnabled: segment.captionsEnabled,
          titleOverlay: segment.titleOverlay,
          status: segment.status,
        },
      }),
      // Step 4: Update indices and timing for all other existing segments
      ...allSegments
        .filter((s) => s.id !== params.segmentId)
        .map((seg) => {
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
    console.error('Segment split error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
