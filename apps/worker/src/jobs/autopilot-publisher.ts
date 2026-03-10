import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Job type → Prisma model mapping
// ---------------------------------------------------------------------------

const MODULE_TO_MODEL: Record<string, string> = {
  REEL: 'reelJob',
  LONG_FORM: 'longFormJob',
  QUOTE: 'quoteJob',
  CHALLENGE: 'challengeJob',
  GAMEPLAY: 'gameplayJob',
  IMAGE_STUDIO: 'imageStudioJob',
  CARTOON: 'cartoonEpisode',
};

const MODULE_TO_JOB_TYPE: Record<string, string> = {
  REEL: 'reel',
  LONG_FORM: 'long_form',
  QUOTE: 'quote',
  CHALLENGE: 'challenge',
  GAMEPLAY: 'gameplay',
  IMAGE_STUDIO: 'image_studio',
  CARTOON: 'cartoon',
};

// ---------------------------------------------------------------------------
// Resolve media URL from a completed job
// ---------------------------------------------------------------------------

async function getJobMedia(moduleType: string, jobId: string): Promise<{
  mediaUrl: string | null;
  title: string;
  description: string;
  hashtags: string;
  isImage: boolean;
  textContent: string | null;
}> {
  const empty = { mediaUrl: null, title: '', description: '', hashtags: '', isImage: false, textContent: null };
  const modelName = MODULE_TO_MODEL[moduleType];
  if (!modelName) return empty;

  // Build select based on module type — fetch title, description, hashtags, media
  const baseSelect: Record<string, boolean> = { status: true, hashtags: true };

  if (moduleType === 'QUOTE') {
    Object.assign(baseSelect, { imageUrl: true, videoUrl: true, quoteText: true });
  } else if (moduleType === 'CARTOON') {
    Object.assign(baseSelect, { outputUrl: true, title: true, synopsis: true, seriesId: true });
  } else {
    // REEL, LONG_FORM, CHALLENGE, GAMEPLAY, IMAGE_STUDIO
    Object.assign(baseSelect, { outputUrl: true, title: true, prompt: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = await (prisma as any)[modelName].findUnique({
    where: { id: jobId },
    select: baseSelect,
  });

  if (!job || job.status !== 'COMPLETED') return empty;

  const hashtags = job.hashtags || '';

  if (moduleType === 'QUOTE') {
    return {
      mediaUrl: job.videoUrl || job.imageUrl || null,
      title: job.quoteText?.slice(0, 100) || 'Quote',
      description: job.quoteText || '',
      hashtags,
      isImage: !!job.imageUrl && !job.videoUrl,
      textContent: !job.videoUrl && !job.imageUrl ? job.quoteText : null,
    };
  }

  if (moduleType === 'CARTOON') {
    // Fetch series name for a richer title
    let seriesName = '';
    if (job.seriesId) {
      const series = await prisma.cartoonSeries.findUnique({
        where: { id: job.seriesId },
        select: { name: true },
      });
      seriesName = series?.name || '';
    }
    const title = job.title || 'Cartoon Episode';
    const description = seriesName
      ? `${seriesName} | ${job.synopsis || job.title || ''}`
      : job.synopsis || job.title || '';

    return {
      mediaUrl: job.outputUrl || null,
      title,
      description,
      hashtags,
      isImage: false,
      textContent: null,
    };
  }

  // REEL, LONG_FORM, CHALLENGE, GAMEPLAY, IMAGE_STUDIO
  return {
    mediaUrl: job.outputUrl || null,
    title: job.title || '',
    description: job.prompt || job.title || '',
    hashtags,
    isImage: false,
    textContent: null,
  };
}

// ---------------------------------------------------------------------------
// Publish to a single platform via internal API
// ---------------------------------------------------------------------------

async function publishToPlatformViaApi(params: {
  userId: string;
  socialAccountId: string;
  jobType: string;
  jobId: string;
  mediaUrl: string;
  title: string;
  description: string;
  hashtags: string;
  isImage: boolean;
  textContent: string | null;
  format?: string;
}): Promise<{ success: boolean; platformPostId?: string; platformUrl?: string; error?: string }> {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.WEB_APP_URL || 'http://localhost:3000';
  const secret = process.env.WORKER_CALLBACK_SECRET;

  const res = await fetch(`${baseUrl}/api/internal/autopilot/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-worker-secret': secret || '',
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { success: false, error: `API call failed: ${res.status} ${text}` };
  }

  return res.json() as Promise<{ success: boolean; platformPostId?: string; platformUrl?: string; error?: string }>;
}

// ---------------------------------------------------------------------------
// Main auto-publish processor
// ---------------------------------------------------------------------------

export async function processAutopilotPublisher(job: Job) {
  logger.info({ jobId: job.id }, 'Running autopilot publisher check');

  const now = new Date();

  // Find logs ready to publish:
  // 1. Status is COMPLETED (job finished generating)
  // 2. publishStatus is SCHEDULED (approved or no approval needed)
  // 3. scheduledPublishAt <= now (publish delay has passed)
  const readyToPublish = await prisma.autopilotLog.findMany({
    where: {
      status: 'COMPLETED',
      publishStatus: 'SCHEDULED',
      scheduledPublishAt: { lte: now },
    },
    include: {
      autopilotSchedule: {
        select: {
          publishTargets: true,
          autoPublish: true,
        },
      },
    },
    take: 20, // Process max 20 per run
  });

  // Also find logs where job completed but publishStatus is still PENDING
  // (meaning the job just finished and we need to check if it should be scheduled)
  const pendingLogs = await prisma.autopilotLog.findMany({
    where: {
      publishStatus: 'PENDING',
      status: 'GENERATING', // Still marked as generating
    },
    take: 50,
  });

  // Check if pending jobs have completed
  for (const log of pendingLogs) {
    try {
      const modelName = MODULE_TO_MODEL[log.moduleType];
      if (!modelName) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobRecord = await (prisma as any)[modelName].findUnique({
        where: { id: log.jobId },
        select: { status: true },
      });

      if (!jobRecord) continue;

      if (jobRecord.status === 'COMPLETED') {
        // Job finished — update log status and schedule publish
        const publishAt = log.scheduledPublishAt || now;

        await prisma.autopilotLog.update({
          where: { id: log.id },
          data: {
            status: 'COMPLETED',
            publishStatus: log.requiresApproval ? 'AWAITING_APPROVAL' : 'SCHEDULED',
            scheduledPublishAt: log.requiresApproval ? null : publishAt,
          },
        });

        logger.info({
          logId: log.id,
          jobId: log.jobId,
          publishStatus: log.requiresApproval ? 'AWAITING_APPROVAL' : 'SCHEDULED',
        }, 'Autopilot job completed, updated publish status');
      } else if (jobRecord.status === 'FAILED') {
        await prisma.autopilotLog.update({
          where: { id: log.id },
          data: {
            status: 'FAILED',
            publishStatus: 'FAILED',
            errorMessage: 'Job generation failed',
          },
        });

        // Update schedule failed count
        await prisma.autopilotSchedule.update({
          where: { id: log.autopilotScheduleId },
          data: { totalFailed: { increment: 1 } },
        }).catch(() => {});
      }
    } catch (err) {
      logger.error({
        logId: log.id,
        err: err instanceof Error ? err.message : String(err),
      }, 'Error checking pending autopilot log');
    }
  }

  // Now publish the ready ones
  let published = 0;
  let publishFailed = 0;

  for (const log of readyToPublish) {
    try {
      const targets = log.autopilotSchedule.publishTargets as Array<{
        socialAccountId: string;
        format?: string;
      }> | null;

      if (!targets || targets.length === 0) {
        // No publish targets configured, mark as skipped
        await prisma.autopilotLog.update({
          where: { id: log.id },
          data: { publishStatus: 'SKIPPED' },
        });
        continue;
      }

      // Mark as publishing
      await prisma.autopilotLog.update({
        where: { id: log.id },
        data: { publishStatus: 'PUBLISHING' },
      });

      // Get job media
      const media = await getJobMedia(log.moduleType, log.jobId);

      if (!media.mediaUrl && !media.textContent) {
        await prisma.autopilotLog.update({
          where: { id: log.id },
          data: {
            publishStatus: 'FAILED',
            errorMessage: 'No media output available for publishing',
          },
        });
        publishFailed++;
        continue;
      }

      // Publish to each target platform
      const jobType = MODULE_TO_JOB_TYPE[log.moduleType] || 'reel';
      const results: Array<{
        socialAccountId: string;
        success: boolean;
        platformPostId?: string;
        platformUrl?: string;
        error?: string;
      }> = [];

      // Compose full description with hashtags for publishing
      const fullDescription = [media.description, media.hashtags]
        .filter(Boolean)
        .join('\n\n');

      for (const target of targets) {
        const result = await publishToPlatformViaApi({
          userId: log.userId,
          socialAccountId: target.socialAccountId,
          jobType,
          jobId: log.jobId,
          mediaUrl: media.mediaUrl || '',
          title: media.title,
          description: fullDescription,
          hashtags: media.hashtags,
          isImage: media.isImage,
          textContent: media.textContent,
          format: target.format,
        });

        results.push({
          socialAccountId: target.socialAccountId,
          ...result,
        });
      }

      const allSucceeded = results.every((r) => r.success);
      const anySucceeded = results.some((r) => r.success);

      await prisma.autopilotLog.update({
        where: { id: log.id },
        data: {
          publishStatus: allSucceeded ? 'PUBLISHED' : anySucceeded ? 'PUBLISHED' : 'FAILED',
          publishResults: results,
          publishedAt: anySucceeded ? new Date() : null,
          errorMessage: allSucceeded
            ? null
            : results
                .filter((r) => !r.success)
                .map((r) => r.error)
                .join('; '),
        },
      });

      if (anySucceeded) {
        await prisma.autopilotSchedule.update({
          where: { id: log.autopilotScheduleId },
          data: { totalPublished: { increment: 1 } },
        }).catch(() => {});
      }

      published++;
      logger.info({
        logId: log.id,
        jobId: log.jobId,
        results: results.map((r) => ({ accountId: r.socialAccountId, success: r.success })),
      }, 'Autopilot publish completed');
    } catch (err) {
      publishFailed++;
      logger.error({
        logId: log.id,
        err: err instanceof Error ? err.message : String(err),
      }, 'Autopilot publish error');

      await prisma.autopilotLog.update({
        where: { id: log.id },
        data: {
          publishStatus: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Unexpected error',
        },
      }).catch(() => {});
    }
  }

  logger.info({
    pendingChecked: pendingLogs.length,
    readyToPublish: readyToPublish.length,
    published,
    publishFailed,
  }, 'Autopilot publisher run complete');

  return { pendingChecked: pendingLogs.length, published, publishFailed };
}
