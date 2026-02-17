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

    const challengeJob = await prisma.challengeJob.findUnique({
      where: { id: params.id },
    })

    if (!challengeJob) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    if (challengeJob.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(challengeJob)
  } catch (error) {
    console.error('GET /api/challenges/[id] error:', error)
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

    const challengeJob = await prisma.challengeJob.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, status: true },
    })

    if (!challengeJob) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    if (challengeJob.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prevent deleting jobs that are actively processing
    const activeStatuses = ['CONTENT_GENERATING', 'COMPOSING', 'UPLOADING']
    if (activeStatuses.includes(challengeJob.status)) {
      return NextResponse.json(
        { error: 'Cannot delete a challenge that is currently being processed' },
        { status: 409 }
      )
    }

    await prisma.challengeJob.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/challenges/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
