import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

export async function PATCH(
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

    // Only allow updating specific fields
    const updateData: Record<string, unknown> = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.scriptText !== undefined) updateData.scriptText = body.scriptText
    if (body.assetUrl !== undefined) updateData.assetUrl = body.assetUrl
    if (body.visualType !== undefined) updateData.visualType = body.visualType
    if (body.transitionType !== undefined) updateData.transitionType = body.transitionType
    if (body.captionsEnabled !== undefined) updateData.captionsEnabled = body.captionsEnabled
    if (body.titleOverlay !== undefined) updateData.titleOverlay = body.titleOverlay

    const updated = await prisma.longFormSegment.update({
      where: { id: params.segmentId },
      data: updateData,
    })

    return NextResponse.json({ segment: updated })
  } catch (error) {
    console.error('Segment update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
