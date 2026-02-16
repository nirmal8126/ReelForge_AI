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

    const quoteJob = await prisma.quoteJob.findUnique({
      where: { id: params.id },
    })

    if (!quoteJob) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quoteJob.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(quoteJob)
  } catch (error) {
    console.error('GET /api/quotes/[id] error:', error)
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

    const quoteJob = await prisma.quoteJob.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, status: true },
    })

    if (!quoteJob) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quoteJob.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prevent deleting jobs that are actively processing
    const activeStatuses = [
      'TEXT_GENERATING', 'IMAGE_GENERATING', 'VOICE_GENERATING',
      'COMPOSING', 'UPLOADING',
    ]
    if (activeStatuses.includes(quoteJob.status)) {
      return NextResponse.json(
        { error: 'Cannot delete a quote that is currently being processed' },
        { status: 409 }
      )
    }

    await prisma.quoteJob.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/quotes/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
