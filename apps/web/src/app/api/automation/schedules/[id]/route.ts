import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma, Prisma } from '@reelforge/db'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// GET /api/automation/schedules/:id — get schedule details with logs
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

  const schedule = await prisma.autopilotSchedule.findFirst({
    where: { id, userId: session.user.id },
    include: {
      channelProfile: { select: { id: true, name: true } },
      logs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      _count: {
        select: { logs: true },
      },
    },
  })

  if (!schedule) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  return NextResponse.json({ schedule })
}

// ---------------------------------------------------------------------------
// PATCH /api/automation/schedules/:id — update schedule
// ---------------------------------------------------------------------------

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  isActive: z.boolean().optional(),
  channelProfileId: z.string().nullable().optional(),
  frequency: z.enum(['EVERY_MINUTES', 'HOURLY', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM']).optional(),
  minuteInterval: z.number().int().min(5).max(45).optional(),
  hourlyInterval: z.number().int().min(1).max(12).optional(),
  cronExpression: z.string().max(100).nullable().optional(),
  timezone: z.string().max(50).optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  useTrendingTopics: z.boolean().optional(),
  trendingCategories: z.array(z.string()).nullable().optional(),
  customTopics: z.array(z.string().min(1)).nullable().optional(),
  durationSeconds: z.number().int().min(15).max(90).optional(),
  durationMinutes: z.number().int().min(5).max(30).optional(),
  aspectRatio: z.string().max(10).optional(),
  style: z.string().max(100).nullable().optional(),
  language: z.string().regex(/^[a-z]{2}$/).optional(),
  voiceId: z.string().max(100).nullable().optional(),
  moduleSettings: z.record(z.unknown()).nullable().optional(),
  autoPublish: z.boolean().optional(),
  publishDelay: z.number().int().min(0).max(1440).optional(),
  requireApproval: z.boolean().optional(),
  publishTargets: z.array(z.object({
    socialAccountId: z.string(),
    format: z.string().optional(),
  })).nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Verify ownership
    const existing = await prisma.autopilotSchedule.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = updateScheduleSchema.parse(body)

    // Recalculate nextRunAt if schedule timing changed
    let nextRunAt = existing.nextRunAt
    if (data.scheduledTime || data.frequency || data.minuteInterval || data.hourlyInterval || data.isActive === true) {
      const freq = data.frequency || existing.frequency
      const now = new Date()
      if (freq === 'EVERY_MINUTES') {
        const interval = Math.max(5, data.minuteInterval ?? existing.minuteInterval)
        nextRunAt = new Date(now.getTime() + interval * 60 * 1000)
      } else if (freq === 'HOURLY') {
        const interval = Math.max(1, data.hourlyInterval ?? existing.hourlyInterval)
        nextRunAt = new Date(now)
        nextRunAt.setUTCMinutes(0, 0, 0)
        nextRunAt.setUTCHours(nextRunAt.getUTCHours() + interval)
      } else {
        const time = data.scheduledTime || existing.scheduledTime
        const [hours, minutes] = time.split(':').map(Number)
        nextRunAt = new Date(now)
        nextRunAt.setUTCHours(hours, minutes, 0, 0)
        if (nextRunAt <= now) {
          nextRunAt.setUTCDate(nextRunAt.getUTCDate() + 1)
        }
      }
    }

    // If deactivated, clear nextRunAt
    if (data.isActive === false) {
      nextRunAt = null
    }

    // Build update data — handle JSON fields properly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { nextRunAt }

    // Simple scalar fields
    const scalarFields = [
      'name', 'isActive', 'frequency', 'minuteInterval', 'hourlyInterval', 'timezone', 'scheduledTime',
      'useTrendingTopics', 'durationSeconds', 'durationMinutes',
      'aspectRatio', 'language', 'autoPublish', 'publishDelay', 'requireApproval',
    ] as const
    for (const key of scalarFields) {
      if (data[key] !== undefined) updateData[key] = data[key]
    }

    // Nullable string fields
    const nullableStrings = ['cronExpression', 'style', 'voiceId', 'channelProfileId'] as const
    for (const key of nullableStrings) {
      if (data[key] !== undefined) updateData[key] = data[key]
    }

    // JSON fields (need Prisma.JsonNull for null)
    const jsonFields = ['trendingCategories', 'customTopics', 'moduleSettings', 'publishTargets'] as const
    for (const key of jsonFields) {
      if (data[key] !== undefined) {
        updateData[key] = data[key] === null ? Prisma.JsonNull : data[key]
      }
    }

    const schedule = await prisma.autopilotSchedule.update({
      where: { id },
      data: updateData,
      include: {
        channelProfile: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ schedule })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('PATCH /api/automation/schedules/:id error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/automation/schedules/:id — delete schedule
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

  const existing = await prisma.autopilotSchedule.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  // Delete associated logs first
  await prisma.autopilotLog.deleteMany({
    where: { autopilotScheduleId: id },
  })

  await prisma.autopilotSchedule.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
