import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reelJob = await prisma.reelJob.findUnique({
      where: { id: params.id },
      include: {
        channelProfile: {
          select: { id: true, name: true, niche: true, platform: true },
        },
      },
    })

    if (!reelJob) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 })
    }

    if (reelJob.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(reelJob)
  } catch (error) {
    console.error('GET /api/reels/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reelJob = await prisma.reelJob.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, status: true },
    })

    if (!reelJob) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 })
    }

    if (reelJob.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prevent deleting jobs that are actively processing
    const activeStatuses = [
      'PROCESSING', 'SCRIPT_GENERATING', 'VOICE_GENERATING',
      'VIDEO_GENERATING', 'COMPOSING', 'UPLOADING',
    ]
    if (activeStatuses.includes(reelJob.status)) {
      return NextResponse.json(
        { error: 'Cannot delete a reel that is currently being processed' },
        { status: 409 }
      )
    }

    await prisma.reelJob.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/reels/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
