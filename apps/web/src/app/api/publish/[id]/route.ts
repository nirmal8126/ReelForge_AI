import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

// ---------------------------------------------------------------------------
// GET /api/publish/[id] — get a specific publish record
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const record = await prisma.publishRecord.findFirst({
    where: { id, userId: session.user.id },
    include: {
      socialAccount: {
        select: {
          platform: true,
          accountName: true,
          accountAvatar: true,
        },
      },
    },
  })

  if (!record) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  return NextResponse.json({ record })
}

// ---------------------------------------------------------------------------
// DELETE /api/publish/[id] — cancel a pending publish
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const record = await prisma.publishRecord.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!record) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  if (record.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Can only cancel pending publishes' },
      { status: 400 }
    )
  }

  await prisma.publishRecord.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
