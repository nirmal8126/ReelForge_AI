import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

// GET /api/templates/:id — get template details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const template = await prisma.contentTemplate.findFirst({
    where: {
      id,
      OR: [
        { isSystem: true, isPublic: true },
        { userId: session.user.id },
      ],
    },
  })

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  return NextResponse.json({ template })
}

// DELETE /api/templates/:id — delete own template
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const isAdmin = (session.user as Record<string, unknown>).role === 'ADMIN'

  const template = await prisma.contentTemplate.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId: session.user.id }),
    },
  })

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  await prisma.contentTemplate.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
