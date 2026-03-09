import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

// ---------------------------------------------------------------------------
// GET /api/automation/logs — list automation execution logs
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const scheduleId = searchParams.get('scheduleId')
  const publishStatus = searchParams.get('publishStatus')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { userId: session.user.id }
  if (scheduleId) where.autopilotScheduleId = scheduleId
  if (publishStatus) where.publishStatus = publishStatus

  const [logs, total] = await Promise.all([
    prisma.autopilotLog.findMany({
      where,
      include: {
        autopilotSchedule: {
          select: { id: true, name: true, moduleType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.autopilotLog.count({ where }),
  ])

  return NextResponse.json({
    logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

// ---------------------------------------------------------------------------
// PATCH /api/automation/logs — approve/reject a pending log
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { logId, action, reviewNote } = body as {
    logId: string
    action: 'approve' | 'reject'
    reviewNote?: string
  }

  if (!logId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const log = await prisma.autopilotLog.findFirst({
    where: { id: logId, userId: session.user.id, publishStatus: 'AWAITING_APPROVAL' },
  })

  if (!log) {
    return NextResponse.json({ error: 'Log not found or not awaiting approval' }, { status: 404 })
  }

  if (action === 'approve') {
    const publishDelay = log.scheduledPublishAt
      ? log.scheduledPublishAt
      : new Date() // publish immediately

    await prisma.autopilotLog.update({
      where: { id: logId },
      data: {
        publishStatus: 'SCHEDULED',
        approvedAt: new Date(),
        scheduledPublishAt: publishDelay,
        reviewNote: reviewNote || null,
      },
    })
  } else {
    await prisma.autopilotLog.update({
      where: { id: logId },
      data: {
        publishStatus: 'SKIPPED',
        rejectedAt: new Date(),
        reviewNote: reviewNote || null,
      },
    })
  }

  return NextResponse.json({ success: true })
}
