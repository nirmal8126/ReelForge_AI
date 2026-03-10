import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma, Prisma } from '@reelforge/db'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createScheduleSchema = z.object({
  name: z.string().min(1).max(150),
  moduleType: z.enum(['REEL', 'LONG_FORM', 'QUOTE', 'CHALLENGE', 'GAMEPLAY', 'IMAGE_STUDIO', 'CARTOON']),
  channelProfileId: z.string().nullable().optional(),

  // Schedule
  frequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM']).default('WEEKLY'),
  hourlyInterval: z.number().int().min(1).max(12).default(1),
  cronExpression: z.string().max(100).nullable().optional(),
  timezone: z.string().max(50).default('UTC'),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),

  // Topics
  useTrendingTopics: z.boolean().default(false),
  trendingCategories: z.array(z.string()).nullable().optional(),
  customTopics: z.array(z.string().min(1)).nullable().optional(),

  // Video settings
  durationSeconds: z.number().int().min(15).max(90).default(30),
  durationMinutes: z.number().int().min(5).max(30).default(10),
  aspectRatio: z.string().max(10).default('9:16'),
  style: z.string().max(100).nullable().optional(),
  language: z.string().regex(/^[a-z]{2}$/).default('hi'),
  voiceId: z.string().max(100).nullable().optional(),

  // Module-specific settings
  moduleSettings: z.record(z.unknown()).nullable().optional(),

  // Auto-publish
  autoPublish: z.boolean().default(false),
  publishDelay: z.number().int().min(0).max(1440).default(0), // max 24 hours
  requireApproval: z.boolean().default(false),
  publishTargets: z.array(z.object({
    socialAccountId: z.string(),
    format: z.string().optional(),
  })).nullable().optional(),
})

// ---------------------------------------------------------------------------
// POST /api/automation/schedules — create new automation schedule
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = createScheduleSchema.parse(body)

    // Validate channel profile if provided
    if (data.channelProfileId) {
      const profile = await prisma.channelProfile.findFirst({
        where: { id: data.channelProfileId, userId: session.user.id },
      })
      if (!profile) {
        return NextResponse.json({ error: 'Channel profile not found' }, { status: 404 })
      }
    }

    // Validate publish targets belong to user
    if (data.publishTargets && data.publishTargets.length > 0) {
      const accountIds = data.publishTargets.map(t => t.socialAccountId)
      const accounts = await prisma.socialAccount.findMany({
        where: { id: { in: accountIds }, userId: session.user.id, isActive: true },
      })
      if (accounts.length !== accountIds.length) {
        return NextResponse.json({ error: 'One or more social accounts are invalid' }, { status: 400 })
      }
    }

    // Calculate first run time
    const now = new Date()
    let nextRunAt: Date
    if (data.frequency === 'HOURLY') {
      // First run = now + hourlyInterval hours, aligned to top of hour
      nextRunAt = new Date(now)
      nextRunAt.setUTCMinutes(0, 0, 0)
      nextRunAt.setUTCHours(nextRunAt.getUTCHours() + data.hourlyInterval)
    } else {
      const [hours, minutes] = data.scheduledTime.split(':').map(Number)
      nextRunAt = new Date(now)
      nextRunAt.setUTCHours(hours, minutes, 0, 0)
      if (nextRunAt <= now) {
        nextRunAt.setUTCDate(nextRunAt.getUTCDate() + 1)
      }
    }

    const schedule = await prisma.autopilotSchedule.create({
      data: {
        userId: session.user.id,
        channelProfileId: data.channelProfileId || null,
        name: data.name,
        moduleType: data.moduleType,
        frequency: data.frequency,
        hourlyInterval: data.hourlyInterval,
        cronExpression: data.cronExpression || null,
        timezone: data.timezone,
        scheduledTime: data.scheduledTime,
        useTrendingTopics: data.useTrendingTopics,
        trendingCategories: data.trendingCategories ?? Prisma.JsonNull,
        customTopics: data.customTopics ?? Prisma.JsonNull,
        durationSeconds: data.durationSeconds,
        durationMinutes: data.durationMinutes,
        aspectRatio: data.aspectRatio,
        style: data.style || null,
        language: data.language,
        voiceId: data.voiceId || null,
        moduleSettings: data.moduleSettings
          ? (data.moduleSettings as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        autoPublish: data.autoPublish,
        publishDelay: data.publishDelay,
        requireApproval: data.requireApproval,
        publishTargets: data.publishTargets
          ? (data.publishTargets as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        nextRunAt,
        isActive: true,
      },
      include: {
        channelProfile: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ schedule }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('POST /api/automation/schedules error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/automation/schedules — list user's automation schedules
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const moduleType = searchParams.get('moduleType')

  const where: Record<string, unknown> = { userId: session.user.id }
  if (moduleType) where.moduleType = moduleType

  const schedules = await prisma.autopilotSchedule.findMany({
    where,
    include: {
      channelProfile: { select: { id: true, name: true } },
      _count: {
        select: { logs: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ schedules })
}
