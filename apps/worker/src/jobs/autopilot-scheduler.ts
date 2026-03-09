import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Next-run calculator
// ---------------------------------------------------------------------------

function calculateNextRunAt(
  frequency: string,
  timezone: string,
  scheduledTime: string,
  cronExpression?: string | null
): Date {
  const now = new Date();

  // Parse HH:mm
  const [hours, minutes] = scheduledTime.split(':').map(Number);

  // Create next run date in UTC (simplified — timezone offset not applied here)
  const next = new Date(now);
  next.setUTCHours(hours, minutes, 0, 0);

  // If time already passed today, start from tomorrow
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  switch (frequency) {
    case 'DAILY':
      // Already set to next occurrence
      break;
    case 'WEEKLY':
      // Advance to 7 days from last run
      next.setUTCDate(next.getUTCDate() + 6); // +6 because we already added 1
      break;
    case 'BIWEEKLY':
      next.setUTCDate(next.getUTCDate() + 13);
      break;
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case 'CUSTOM':
      // For custom cron, just set to next day as fallback
      // In production, parse cron expression properly
      break;
  }

  return next;
}

// ---------------------------------------------------------------------------
// Get next topic from the topic pool
// ---------------------------------------------------------------------------

function getNextTopic(schedule: {
  customTopics: unknown;
  topicIndex: number;
  useTrendingTopics: boolean;
}): { topic: string; newIndex: number } {
  const topics = schedule.customTopics as string[] | null;

  if (!topics || topics.length === 0) {
    return { topic: 'Create engaging content on a trending topic', newIndex: 0 };
  }

  // Rotate through topics
  const index = schedule.topicIndex % topics.length;
  const topic = topics[index];
  return { topic, newIndex: index + 1 };
}

// ---------------------------------------------------------------------------
// Module-specific job creators
// ---------------------------------------------------------------------------

type ScheduleWithUser = Awaited<ReturnType<typeof getScheduleWithUser>>;

async function getScheduleWithUser(scheduleId: string) {
  return prisma.autopilotSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      user: {
        select: {
          id: true,
          subscription: {
            select: { plan: true, jobsLimit: true, jobsUsed: true },
          },
        },
      },
    },
  });
}

async function createReelJob(schedule: NonNullable<ScheduleWithUser>, topic: string) {
  const plan = schedule.user.subscription?.plan || 'FREE';

  const reelJob = await prisma.reelJob.create({
    data: {
      userId: schedule.userId,
      channelProfileId: schedule.channelProfileId || null,
      title: topic.slice(0, 80),
      prompt: topic,
      style: schedule.style || null,
      language: schedule.language,
      voiceId: schedule.voiceId || null,
      durationSeconds: schedule.durationSeconds,
      aspectRatio: schedule.aspectRatio,
      status: 'QUEUED',
      creditsCost: schedule.durationSeconds <= 15 ? 1 : schedule.durationSeconds <= 30 ? 2 : 3,
    },
  });

  // Enqueue via HTTP to the web app's queue (worker doesn't have direct queue access for creating)
  await callInternalApi('/api/internal/autopilot/enqueue', {
    moduleType: 'REEL',
    jobId: reelJob.id,
    userId: schedule.userId,
    plan,
    scheduleData: {
      prompt: topic,
      style: schedule.style,
      language: schedule.language,
      voiceId: schedule.voiceId,
      durationSeconds: schedule.durationSeconds,
      aspectRatio: schedule.aspectRatio,
      channelProfileId: schedule.channelProfileId,
    },
  });

  return reelJob.id;
}

async function createLongFormJob(schedule: NonNullable<ScheduleWithUser>, topic: string) {
  const plan = schedule.user.subscription?.plan || 'FREE';
  const settings = (schedule.moduleSettings || {}) as Record<string, unknown>;

  const longFormJob = await prisma.longFormJob.create({
    data: {
      userId: schedule.userId,
      channelProfileId: schedule.channelProfileId || null,
      autopilotScheduleId: schedule.id,
      title: topic.slice(0, 80),
      prompt: topic,
      durationMinutes: schedule.durationMinutes,
      style: schedule.style || null,
      language: schedule.language,
      voiceId: schedule.voiceId || null,
      aspectRatio: schedule.aspectRatio || '16:9',
      aiClipRatio: (settings.aiClipRatio as number) || 0.3,
      useStockFootage: (settings.useStockFootage as boolean) ?? true,
      useStaticVisuals: (settings.useStaticVisuals as boolean) ?? true,
      publishToYouTube: false,
      status: 'QUEUED',
      creditsCost: schedule.durationMinutes <= 5 ? 3 : schedule.durationMinutes <= 10 ? 5 : schedule.durationMinutes <= 15 ? 7 : schedule.durationMinutes <= 20 ? 9 : 12,
    },
  });

  await callInternalApi('/api/internal/autopilot/enqueue', {
    moduleType: 'LONG_FORM',
    jobId: longFormJob.id,
    userId: schedule.userId,
    plan,
    scheduleData: {
      prompt: topic,
      title: topic.slice(0, 80),
      durationMinutes: schedule.durationMinutes,
      style: schedule.style,
      language: schedule.language,
      voiceId: schedule.voiceId,
      aspectRatio: schedule.aspectRatio || '16:9',
      aiClipRatio: (settings.aiClipRatio as number) || 0.3,
      useStockFootage: (settings.useStockFootage as boolean) ?? true,
      useStaticVisuals: (settings.useStaticVisuals as boolean) ?? true,
      publishToYouTube: false,
      channelProfileId: schedule.channelProfileId,
    },
  });

  return longFormJob.id;
}

async function createQuoteJob(schedule: NonNullable<ScheduleWithUser>, topic: string) {
  const plan = schedule.user.subscription?.plan || 'FREE';
  const settings = (schedule.moduleSettings || {}) as Record<string, unknown>;

  const quoteJob = await prisma.quoteJob.create({
    data: {
      userId: schedule.userId,
      prompt: topic,
      category: (settings.category as string) || 'motivational',
      language: schedule.language,
      status: 'QUEUED',
      creditsCost: 1,
    },
  });

  await callInternalApi('/api/internal/autopilot/enqueue', {
    moduleType: 'QUOTE',
    jobId: quoteJob.id,
    userId: schedule.userId,
    plan,
    scheduleData: {
      prompt: topic,
      category: (settings.category as string) || 'motivational',
      language: schedule.language,
      quoteLength: (settings.quoteLength as string) || 'medium',
    },
  });

  return quoteJob.id;
}

async function createChallengeJob(schedule: NonNullable<ScheduleWithUser>, topic: string) {
  const plan = schedule.user.subscription?.plan || 'FREE';
  const settings = (schedule.moduleSettings || {}) as Record<string, unknown>;

  const challengeType = (settings.challengeType as string) || 'gk_quiz';
  const numQuestions = (settings.numQuestions as number) || 3;
  const voiceEnabled = (settings.voiceEnabled as boolean) || false;

  const challengeJob = await prisma.challengeJob.create({
    data: {
      userId: schedule.userId,
      challengeType,
      category: (settings.category as string) || 'general',
      difficulty: (settings.difficulty as string) || 'medium',
      numQuestions,
      timerSeconds: (settings.timerSeconds as number) || 5,
      language: schedule.language,
      prompt: topic || null,
      templateStyle: (settings.templateStyle as string) || 'neon',
      voiceEnabled,
      voiceId: schedule.voiceId || null,
      status: 'QUEUED',
      creditsCost: numQuestions >= 5 ? (voiceEnabled ? 3 : 2) : (voiceEnabled ? 2 : 1),
    },
  });

  await callInternalApi('/api/internal/autopilot/enqueue', {
    moduleType: 'CHALLENGE',
    jobId: challengeJob.id,
    userId: schedule.userId,
    plan,
    scheduleData: {
      challengeType,
      category: (settings.category as string) || 'general',
      difficulty: (settings.difficulty as string) || 'medium',
      numQuestions,
      timerSeconds: (settings.timerSeconds as number) || 5,
      language: schedule.language,
      prompt: topic,
      templateStyle: (settings.templateStyle as string) || 'neon',
      voiceEnabled,
      voiceId: schedule.voiceId,
    },
  });

  return challengeJob.id;
}

async function createGameplayJob(schedule: NonNullable<ScheduleWithUser>, topic: string) {
  const plan = schedule.user.subscription?.plan || 'FREE';
  const settings = (schedule.moduleSettings || {}) as Record<string, unknown>;

  const duration = (settings.duration as number) || schedule.durationSeconds || 30;

  const template = ((settings.template as string) || 'ENDLESS_RUNNER') as 'ENDLESS_RUNNER' | 'BALL_MAZE' | 'OBSTACLE_TOWER' | 'COLOR_SWITCH';

  const gameplayJob = await prisma.gameplayJob.create({
    data: {
      userId: schedule.userId,
      template,
      theme: (settings.theme as string) || 'neon',
      difficulty: (settings.difficulty as string) || 'medium',
      duration,
      aspectRatio: schedule.aspectRatio || '9:16',
      musicStyle: (settings.musicStyle as string) || 'upbeat',
      gameTitle: (settings.gameTitle as string) || null,
      showScore: (settings.showScore as boolean) ?? true,
      ctaText: (settings.ctaText as string) || null,
      status: 'QUEUED',
      creditsCost: duration <= 15 ? 1 : duration <= 30 ? 2 : 3,
    },
  });

  await callInternalApi('/api/internal/autopilot/enqueue', {
    moduleType: 'GAMEPLAY',
    jobId: gameplayJob.id,
    userId: schedule.userId,
    plan,
    scheduleData: {
      template: (settings.template as string) || 'ENDLESS_RUNNER',
      theme: (settings.theme as string) || 'neon',
      difficulty: (settings.difficulty as string) || 'medium',
      duration,
      aspectRatio: schedule.aspectRatio || '9:16',
      musicStyle: (settings.musicStyle as string) || 'upbeat',
      gameTitle: settings.gameTitle,
      showScore: (settings.showScore as boolean) ?? true,
      ctaText: settings.ctaText,
    },
  });

  return gameplayJob.id;
}

// ---------------------------------------------------------------------------
// Internal API caller (worker → web app)
// ---------------------------------------------------------------------------

async function callInternalApi(path: string, body: Record<string, unknown>) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.WEB_APP_URL || 'http://localhost:3000';
  const secret = process.env.WORKER_CALLBACK_SECRET;

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-worker-secret': secret || '',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Internal API ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Main scheduler processor
// ---------------------------------------------------------------------------

export async function processAutopilotScheduler(job: Job) {
  logger.info({ jobId: job.id }, 'Running autopilot scheduler check');

  const now = new Date();

  // Find all active schedules due for execution
  const dueSchedules = await prisma.autopilotSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
    },
    include: {
      user: {
        select: {
          id: true,
          isActive: true,
          subscription: {
            select: { plan: true, status: true, jobsLimit: true, jobsUsed: true },
          },
        },
      },
    },
    take: 50, // Process max 50 schedules per run
  });

  logger.info({ count: dueSchedules.length }, 'Found due autopilot schedules');

  let processed = 0;
  let failed = 0;

  for (const schedule of dueSchedules) {
    try {
      // Skip if user is inactive or has no active subscription
      if (!schedule.user.isActive) {
        logger.warn({ scheduleId: schedule.id, userId: schedule.userId }, 'Skipping — user inactive');
        continue;
      }

      if (schedule.user.subscription?.status !== 'ACTIVE' && schedule.user.subscription?.status !== 'TRIALING') {
        logger.warn({ scheduleId: schedule.id }, 'Skipping — no active subscription');
        continue;
      }

      // Get next topic
      const { topic, newIndex } = getNextTopic(schedule);

      // Create the job based on module type
      let jobId: string;

      switch (schedule.moduleType) {
        case 'REEL':
          jobId = await createReelJob(schedule as NonNullable<ScheduleWithUser>, topic);
          break;
        case 'LONG_FORM':
          jobId = await createLongFormJob(schedule as NonNullable<ScheduleWithUser>, topic);
          break;
        case 'QUOTE':
          jobId = await createQuoteJob(schedule as NonNullable<ScheduleWithUser>, topic);
          break;
        case 'CHALLENGE':
          jobId = await createChallengeJob(schedule as NonNullable<ScheduleWithUser>, topic);
          break;
        case 'GAMEPLAY':
          jobId = await createGameplayJob(schedule as NonNullable<ScheduleWithUser>, topic);
          break;
        default:
          logger.warn({ moduleType: schedule.moduleType }, 'Unsupported module type');
          continue;
      }

      // Create autopilot log
      const publishDelay = schedule.publishDelay || 0;
      const scheduledPublishAt = publishDelay > 0
        ? new Date(Date.now() + publishDelay * 60 * 1000)
        : null;

      await prisma.autopilotLog.create({
        data: {
          autopilotScheduleId: schedule.id,
          userId: schedule.userId,
          moduleType: schedule.moduleType,
          jobId,
          status: 'GENERATING',
          topic,
          publishStatus: schedule.autoPublish
            ? (schedule.requireApproval ? 'AWAITING_APPROVAL' : 'PENDING')
            : 'SKIPPED',
          requiresApproval: schedule.requireApproval,
          scheduledPublishAt,
        },
      });

      // Update schedule: next run, stats, topic index
      const nextRunAt = calculateNextRunAt(
        schedule.frequency,
        schedule.timezone,
        schedule.scheduledTime,
        schedule.cronExpression
      );

      await prisma.autopilotSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt,
          topicIndex: newIndex,
          totalGenerated: { increment: 1 },
        },
      });

      logger.info({
        scheduleId: schedule.id,
        moduleType: schedule.moduleType,
        jobId,
        topic: topic.slice(0, 50),
        nextRunAt,
      }, 'Autopilot job created successfully');

      processed++;
    } catch (err) {
      failed++;
      logger.error({
        scheduleId: schedule.id,
        err: err instanceof Error ? err.message : String(err),
      }, 'Failed to process autopilot schedule');

      // Update failed count
      await prisma.autopilotSchedule.update({
        where: { id: schedule.id },
        data: { totalFailed: { increment: 1 } },
      }).catch(() => {}); // Don't fail the whole batch
    }
  }

  logger.info({ processed, failed, total: dueSchedules.length }, 'Autopilot scheduler run complete');

  return { processed, failed, total: dueSchedules.length };
}
