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

    const gameplayJob = await prisma.gameplayJob.findUnique({
      where: { id: params.id },
    })

    if (!gameplayJob) {
      return NextResponse.json({ error: 'Gameplay job not found' }, { status: 404 })
    }

    if (gameplayJob.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(gameplayJob)
  } catch (error) {
    console.error('GET /api/gameplay/[id] error:', error)
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

    const gameplayJob = await prisma.gameplayJob.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, status: true },
    })

    if (!gameplayJob) {
      return NextResponse.json({ error: 'Gameplay job not found' }, { status: 404 })
    }

    if (gameplayJob.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prevent deleting jobs that are actively processing
    const activeStatuses = ['CONFIG_GENERATING', 'RENDERING', 'ENCODING', 'UPLOADING']
    if (activeStatuses.includes(gameplayJob.status)) {
      return NextResponse.json(
        { error: 'Cannot delete a gameplay job that is currently being processed' },
        { status: 409 }
      )
    }

    await prisma.gameplayJob.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/gameplay/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
