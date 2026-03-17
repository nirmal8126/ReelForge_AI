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
  cronExpression?: string | null,
  hourlyInterval: number = 1,
  minuteInterval: number = 30,
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
    case 'EVERY_MINUTES': {
      // Next run = now + minuteInterval minutes
      const interval = Math.max(5, minuteInterval);
      return new Date(now.getTime() + interval * 60 * 1000);
    }
    case 'HOURLY': {
      // Next run = now + hourlyInterval hours
      const interval = Math.max(1, hourlyInterval);
      const nextRun = new Date(now.getTime() + interval * 60 * 60 * 1000);
      return nextRun;
    }
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
// Title generation helpers
// ---------------------------------------------------------------------------

/**
 * Generate a clean, concise title from a topic/prompt.
 * - Strips leading "Create a...", "Make a...", etc.
 * - Capitalizes first letter of each major word
 * - Truncates to maxLen characters
 */
function generateTitle(topic: string, maxLen = 80): string {
  // Remove common prompt prefixes
  let title = topic
    .replace(/^(create|make|generate|write|produce|build)\s+(a|an|the)?\s*/i, '')
    .replace(/^(about|on|regarding)\s+/i, '')
    .trim();

  // Take the first sentence if it's a long prompt
  const firstSentence = title.split(/[.!?\n]/)[0].trim();
  if (firstSentence.length > 10) {
    title = firstSentence;
  }

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Truncate
  if (title.length > maxLen) {
    title = title.slice(0, maxLen - 3).replace(/\s+\S*$/, '') + '...';
  }

  return title || 'Untitled';
}

// ---------------------------------------------------------------------------
// Credit cost calculator — mirrors apps/web/src/lib/credit-cost.ts
// ---------------------------------------------------------------------------

function calculateCreditCost(schedule: { moduleType: string; durationSeconds: number; durationMinutes: number; moduleSettings?: unknown }): number {
  const settings = (schedule.moduleSettings || {}) as Record<string, unknown>;

  switch (schedule.moduleType) {
    case 'REEL':
      return schedule.durationSeconds <= 15 ? 1 : schedule.durationSeconds <= 30 ? 2 : 3;
    case 'LONG_FORM':
      return schedule.durationMinutes <= 5 ? 3 : schedule.durationMinutes <= 10 ? 5 : schedule.durationMinutes <= 15 ? 7 : schedule.durationMinutes <= 20 ? 9 : 12;
    case 'QUOTE':
      return 1;
    case 'CHALLENGE': {
      const numQ = (settings.numQuestions as number) || 3;
      const voice = (settings.voiceEnabled as boolean) || false;
      return numQ >= 5 ? (voice ? 3 : 2) : (voice ? 2 : 1);
    }
    case 'GAMEPLAY': {
      const dur = (settings.duration as number) || schedule.durationSeconds || 30;
      return dur <= 15 ? 1 : dur <= 30 ? 2 : 3;
    }
    case 'CARTOON':
      return 5;
    case 'IMAGE_STUDIO': {
      const imgCount = (settings.imageCount as number) || 1;
      const voiceOn = (settings.voiceEnabled as boolean) || false;
      return imgCount >= 4 && voiceOn ? 3 : (imgCount >= 2 || voiceOn) ? 2 : 1;
    }
    default:
      return 1;
  }
}

// ---------------------------------------------------------------------------
// Credit check — mirrors apps/web/src/lib/module-config.ts checkModuleCredits
// ---------------------------------------------------------------------------

const MODULE_ID_MAP: Record<string, string> = {
  REEL: 'reels',
  LONG_FORM: 'long_form',
  QUOTE: 'quotes',
  CHALLENGE: 'challenges',
  GAMEPLAY: 'gameplay',
  CARTOON: 'cartoon_studio',
  IMAGE_STUDIO: 'image_studio',
};

type CreditCheckResult =
  | { ok: true; creditsCost: number }
  | { ok: false; error: string };

async function checkAutopilotCredits(
  userId: string,
  moduleType: string,
  creditCost: number,
): Promise<CreditCheckResult> {
  const moduleId = MODULE_ID_MAP[moduleType];
  if (!moduleId) return { ok: false, error: `Unknown module type: ${moduleType}` };

  // Check if module is enabled
  const moduleConfig = await prisma.moduleConfig.findUnique({ where: { moduleId } });
  if (moduleConfig && !moduleConfig.isEnabled) {
    return { ok: false, error: `Module ${moduleId} is disabled` };
  }

  // Free module — skip checks
  if (moduleConfig?.isFree) {
    return { ok: true, creditsCost: 0 };
  }

  // Check subscription
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) {
    return { ok: false, error: 'No active subscription' };
  }

  const hasUnlimitedJobs = subscription.jobsLimit === -1;
  const hasQuota = hasUnlimitedJobs || subscription.jobsUsed < subscription.jobsLimit;

  if (hasQuota) {
    // Use monthly quota
    await prisma.subscription.update({
      where: { userId },
      data: { jobsUsed: { increment: 1 } },
    });
    return { ok: true, creditsCost: 0 };
  }

  // Over quota — check credit balance
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  });

  if (!user || user.creditsBalance < creditCost) {
    return {
      ok: false,
      error: `Quota exceeded. Need ${creditCost} credits, have ${user?.creditsBalance || 0}`,
    };
  }

  // Deduct credits atomically
  const moduleName = moduleConfig?.moduleName || moduleId;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { creditsBalance: { decrement: creditCost } },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount: -creditCost,
        type: 'JOB_DEBIT',
        description: `${moduleName} autopilot generation (over quota)`,
        balanceAfter: user.creditsBalance - creditCost,
      },
    }),
  ]);

  return { ok: true, creditsCost: creditCost };
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

  const reelTitle = generateTitle(topic, 80);

  const reelJob = await prisma.reelJob.create({
    data: {
      userId: schedule.userId,
      channelProfileId: schedule.channelProfileId || null,
      title: reelTitle,
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
      title: reelTitle,
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

  const longFormTitle = generateTitle(topic, 80);

  const longFormJob = await prisma.longFormJob.create({
    data: {
      userId: schedule.userId,
      channelProfileId: schedule.channelProfileId || null,
      autopilotScheduleId: schedule.id,
      title: longFormTitle,
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
      title: longFormTitle,
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

async function createCartoonJob(schedule: NonNullable<ScheduleWithUser>, topic: string) {
  const plan = schedule.user.subscription?.plan || 'FREE';
  const settings = (schedule.moduleSettings || {}) as Record<string, unknown>;

  const seriesId = settings.seriesId as string | undefined;

  if (!seriesId) {
    throw new Error('CARTOON schedule missing seriesId in moduleSettings');
  }

  // Fetch the series to get language, aspectRatio, narratorVoiceId
  const series = await prisma.cartoonSeries.findUnique({
    where: { id: seriesId },
    select: {
      id: true,
      language: true,
      aspectRatio: true,
      narratorVoiceId: true,
      _count: { select: { episodes: true } },
    },
  });

  if (!series) {
    throw new Error(`Cartoon series ${seriesId} not found`);
  }

  const episodeNumber = series._count.episodes + 1;

  // Use a placeholder title — the processor will replace it with a proper title
  // derived from the AI-generated story scenes
  const placeholderTitle = `Episode ${episodeNumber}`;

  const episode = await prisma.cartoonEpisode.create({
    data: {
      seriesId,
      title: placeholderTitle,
      prompt: topic,
      episodeNumber,
      status: 'QUEUED',
      creditsCost: 5,
    },
  });

  await callInternalApi('/api/internal/autopilot/enqueue', {
    moduleType: 'CARTOON',
    jobId: episode.id,
    userId: schedule.userId,
    plan,
    scheduleData: {
      episodeId: episode.id,
      seriesId,
      prompt: topic,
      title: placeholderTitle,
      language: series.language || schedule.language,
      aspectRatio: series.aspectRatio || '16:9',
      narratorVoiceId: series.narratorVoiceId || (settings.narratorVoiceId as string) || undefined,
      durationSeconds: schedule.durationSeconds || 30,
    },
  });

  return episode.id;
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

      // Calculate credit cost for this job
      const creditCost = calculateCreditCost(schedule);

      // Check credits/quota before creating the job
      const creditCheck = await checkAutopilotCredits(schedule.userId, schedule.moduleType, creditCost);
      if (!creditCheck.ok) {
        logger.warn({
          scheduleId: schedule.id,
          userId: schedule.userId,
          moduleType: schedule.moduleType,
          error: creditCheck.error,
        }, 'Skipping autopilot job — insufficient credits/quota');

        // Log the skip
        await prisma.autopilotLog.create({
          data: {
            autopilotScheduleId: schedule.id,
            userId: schedule.userId,
            moduleType: schedule.moduleType,
            jobId: '',
            status: 'FAILED',
            topic,
            publishStatus: 'SKIPPED',
            errorMessage: creditCheck.error,
          },
        });

        // Still advance the schedule so it doesn't retry endlessly
        const nextRunAt = calculateNextRunAt(
          schedule.frequency, schedule.timezone, schedule.scheduledTime,
          schedule.cronExpression, schedule.hourlyInterval, schedule.minuteInterval,
        );
        await prisma.autopilotSchedule.update({
          where: { id: schedule.id },
          data: { lastRunAt: now, nextRunAt, totalFailed: { increment: 1 } },
        });

        failed++;
        continue;
      }

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
        case 'CARTOON':
          jobId = await createCartoonJob(schedule as NonNullable<ScheduleWithUser>, topic);
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
        schedule.cronExpression,
        schedule.hourlyInterval,
        schedule.minuteInterval,
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
