import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const job = await prisma.longFormJob.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        channelProfile: {
          select: {
            id: true,
            name: true,
            niche: true,
            tone: true,
            primaryColor: true,
          },
        },
        segments: {
          orderBy: { segmentIndex: 'asc' },
        },
        youtubeMetadata: true,
        calendarEntry: {
          select: {
            id: true,
            title: true,
            scheduledDate: true,
          },
        },
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ job })
  } catch (error) {
    console.error('Long-form job fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Check ownership
    const job = await prisma.longFormJob.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Prevent deletion of processing jobs
    if (
      job.status !== 'COMPLETED' &&
      job.status !== 'FAILED' &&
      job.status !== 'QUEUED'
    ) {
      return NextResponse.json(
        { error: 'Cannot delete job while it is processing' },
        { status: 400 }
      )
    }

    // Delete job (segments will cascade delete due to onDelete: Cascade)
    await prisma.longFormJob.delete({
      where: { id: params.id },
    })

    // TODO: If job is QUEUED, remove from BullMQ queue

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Long-form job deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
