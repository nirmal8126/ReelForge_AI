import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from './utils/logger';
import { processReelJob } from './jobs/reel-processor';
import { processLongFormJob } from './jobs/long-form-processor';
import { processCartoonEpisode } from './jobs/cartoon-episode-processor';
import { processQuoteJob } from './jobs/quote-processor';
import { processChallengeJob } from './jobs/challenge-processor';
import { processGameplayJob } from './jobs/gameplay-processor';
import { processImageStudioJob } from './jobs/image-studio-processor';
import { processSequenceEmails } from './jobs/sequence-processor';
import { checkSequenceTriggers } from './jobs/sequence-trigger-checker';
import { processBadgeChecker } from './jobs/badge-checker';
import { processAutopilotScheduler } from './jobs/autopilot-scheduler';
import { processAutopilotPublisher } from './jobs/autopilot-publisher';

function loadEnvFiles() {
  const cwd = process.cwd();

  // Load .env files first (base configuration)
  const envFiles = [
    path.resolve(cwd, '../../.env'),
    path.resolve(cwd, '.env'),
  ];

  // Then load .env.local files (overrides)
  const envLocalFiles = [
    path.resolve(cwd, '../../.env.local'),
    path.resolve(cwd, '.env.local'),
  ];

  // Load base .env files without override
  for (const filePath of envFiles) {
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath, override: false });
      logger.debug({ file: filePath }, 'Loaded .env file');
    }
  }

  // Load .env.local files with override to ensure they take precedence
  for (const filePath of envLocalFiles) {
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath, override: true });
      logger.info({ file: filePath }, 'Loaded .env.local file (with override)');
    }
  }
}

loadEnvFiles();

// ---------------------------------------------------------------------------
// Redis connection
// ---------------------------------------------------------------------------
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('connect', () => {
  logger.info('Redis connection established');
});

connection.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

// ---------------------------------------------------------------------------
// Reel-jobs worker
// ---------------------------------------------------------------------------
const reelWorker = new Worker(
  'reel-jobs',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing reel job');
    return processReelJob(job);
  },
  {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
);

reelWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Reel job completed successfully');
});

reelWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Reel job failed');
});

reelWorker.on('error', (err) => {
  logger.error({ err }, 'Reel worker error');
});

// ---------------------------------------------------------------------------
// Long-form video worker
// ---------------------------------------------------------------------------
const longFormWorker = new Worker(
  'long-form-jobs',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing long-form job');
    return processLongFormJob(job);
  },
  {
    connection,
    concurrency: 2, // Lower concurrency for long-running jobs
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 250 },
  },
);

longFormWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Long-form job completed successfully');
});

longFormWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Long-form job failed');
});

longFormWorker.on('error', (err) => {
  logger.error({ err }, 'Long-form worker error');
});

// ---------------------------------------------------------------------------
// Cartoon episode worker
// ---------------------------------------------------------------------------
const cartoonWorker = new Worker(
  'cartoon-episode-jobs',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing cartoon episode job');
    return processCartoonEpisode(job);
  },
  {
    connection,
    concurrency: 2,
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 250 },
  },
);

cartoonWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Cartoon episode job completed successfully');
});

cartoonWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Cartoon episode job failed');
});

cartoonWorker.on('error', (err) => {
  logger.error({ err }, 'Cartoon worker error');
});

// ---------------------------------------------------------------------------
// Quote jobs worker
// ---------------------------------------------------------------------------
const quoteWorker = new Worker(
  'quote-jobs',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing quote job');
    return processQuoteJob(job);
  },
  {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
);

quoteWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Quote job completed successfully');
});

quoteWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Quote job failed');
});

quoteWorker.on('error', (err) => {
  logger.error({ err }, 'Quote worker error');
});

// ---------------------------------------------------------------------------
// Challenge / Game Reels worker
// ---------------------------------------------------------------------------
const challengeWorker = new Worker(
  'challenge-jobs',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing challenge job');
    return processChallengeJob(job);
  },
  {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
);

challengeWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Challenge job completed successfully');
});

challengeWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Challenge job failed');
});

challengeWorker.on('error', (err) => {
  logger.error({ err }, 'Challenge worker error');
});

// ---------------------------------------------------------------------------
// 3D Gameplay worker
// ---------------------------------------------------------------------------
const gameplayWorker = new Worker(
  'gameplay-jobs',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing gameplay job');
    return processGameplayJob(job);
  },
  {
    connection,
    concurrency: 3,
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 250 },
  },
);

gameplayWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Gameplay job completed successfully');
});

gameplayWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Gameplay job failed');
});

gameplayWorker.on('error', (err) => {
  logger.error({ err }, 'Gameplay worker error');
});

// ---------------------------------------------------------------------------
// Image Studio worker
// ---------------------------------------------------------------------------
const imageStudioWorker = new Worker(
  'image-studio-jobs',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing image studio job');
    return processImageStudioJob(job);
  },
  {
    connection,
    concurrency: 3,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
);

imageStudioWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Image studio job completed successfully');
});

imageStudioWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Image studio job failed');
});

imageStudioWorker.on('error', (err) => {
  logger.error({ err }, 'Image studio worker error');
});

// ---------------------------------------------------------------------------
// Email notification worker
// ---------------------------------------------------------------------------
const emailWorker = new Worker(
  'email-notifications',
  async (job) => {
    logger.info({ jobId: job.id, type: job.data.type }, 'Processing email notification');

    // TODO: Integrate with email provider (SendGrid / Resend / SES)
    const { to, subject, html } = job.data;
    logger.info({ to, subject }, 'Email notification sent (stub)');

    return { sent: true };
  },
  {
    connection,
    concurrency: 10,
    removeOnComplete: { count: 5000 },
    removeOnFail: { count: 2000 },
  },
);

emailWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Email notification sent');
});

emailWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Email notification failed');
});

emailWorker.on('error', (err) => {
  logger.error({ err }, 'Email worker error');
});

// ---------------------------------------------------------------------------
// Sequence processor (hourly) — sends due sequence emails
// ---------------------------------------------------------------------------
const sequenceQueue = new Queue('sequence-processor', { connection });
const sequenceWorker = new Worker(
  'sequence-processor',
  async (job) => {
    logger.info({ jobId: job.id }, 'Processing sequence emails');
    return processSequenceEmails(job);
  },
  {
    connection,
    concurrency: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
);

sequenceWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Sequence processor completed');
});

sequenceWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Sequence processor failed');
});

sequenceWorker.on('error', (err) => {
  logger.error({ err }, 'Sequence worker error');
});

// Schedule repeating job (every hour)
sequenceQueue.add('process-sequences', {}, {
  repeat: { every: 60 * 60 * 1000 },
  jobId: 'sequence-hourly',
}).catch((err: unknown) => logger.error({ err }, 'Failed to schedule sequence processor'));

// ---------------------------------------------------------------------------
// Sequence trigger checker (every 6 hours) — enrolls users in sequences
// ---------------------------------------------------------------------------
const triggerQueue = new Queue('sequence-trigger-checker', { connection });
const triggerWorker = new Worker(
  'sequence-trigger-checker',
  async (job) => {
    logger.info({ jobId: job.id }, 'Checking sequence triggers');
    return checkSequenceTriggers(job);
  },
  {
    connection,
    concurrency: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
);

triggerWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Trigger checker completed');
});

triggerWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Trigger checker failed');
});

triggerWorker.on('error', (err) => {
  logger.error({ err }, 'Trigger checker error');
});

// Schedule repeating job (every 6 hours)
triggerQueue.add('check-triggers', {}, {
  repeat: { every: 6 * 60 * 60 * 1000 },
  jobId: 'trigger-6hourly',
}).catch((err: unknown) => logger.error({ err }, 'Failed to schedule trigger checker'));

// ---------------------------------------------------------------------------
// Badge checker (daily) — awards badges to eligible users
// ---------------------------------------------------------------------------
const badgeQueue = new Queue('badge-checker', { connection });
const badgeWorker = new Worker(
  'badge-checker',
  async (job) => {
    logger.info({ jobId: job.id }, 'Running badge checker');
    return processBadgeChecker(job);
  },
  {
    connection,
    concurrency: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
);

badgeWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Badge checker completed');
});

badgeWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Badge checker failed');
});

badgeWorker.on('error', (err) => {
  logger.error({ err }, 'Badge checker error');
});

// Schedule repeating job (every 24 hours)
badgeQueue.add('check-badges', {}, {
  repeat: { every: 24 * 60 * 60 * 1000 },
  jobId: 'badge-daily',
}).catch((err: unknown) => logger.error({ err }, 'Failed to schedule badge checker'));

// ---------------------------------------------------------------------------
// Autopilot scheduler (every 5 minutes) — creates jobs from schedules
// ---------------------------------------------------------------------------
const autopilotSchedulerQueue = new Queue('autopilot-scheduler', { connection });
const autopilotSchedulerWorker = new Worker(
  'autopilot-scheduler',
  async (job) => {
    logger.info({ jobId: job.id }, 'Running autopilot scheduler');
    return processAutopilotScheduler(job);
  },
  {
    connection,
    concurrency: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
);

autopilotSchedulerWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Autopilot scheduler completed');
});

autopilotSchedulerWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Autopilot scheduler failed');
});

autopilotSchedulerWorker.on('error', (err) => {
  logger.error({ err }, 'Autopilot scheduler error');
});

// Run every 5 minutes
autopilotSchedulerQueue.add('check-schedules', {}, {
  repeat: { every: 5 * 60 * 1000 },
  jobId: 'autopilot-scheduler-5min',
}).catch((err: unknown) => logger.error({ err }, 'Failed to schedule autopilot scheduler'));

// ---------------------------------------------------------------------------
// Autopilot publisher (every 2 minutes) — publishes completed jobs to platforms
// ---------------------------------------------------------------------------
const autopilotPublisherQueue = new Queue('autopilot-publisher', { connection });
const autopilotPublisherWorker = new Worker(
  'autopilot-publisher',
  async (job) => {
    logger.info({ jobId: job.id }, 'Running autopilot publisher');
    return processAutopilotPublisher(job);
  },
  {
    connection,
    concurrency: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
);

autopilotPublisherWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Autopilot publisher completed');
});

autopilotPublisherWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Autopilot publisher failed');
});

autopilotPublisherWorker.on('error', (err) => {
  logger.error({ err }, 'Autopilot publisher error');
});

// Run every 2 minutes
autopilotPublisherQueue.add('publish-jobs', {}, {
  repeat: { every: 2 * 60 * 1000 },
  jobId: 'autopilot-publisher-2min',
}).catch((err: unknown) => logger.error({ err }, 'Failed to schedule autopilot publisher'));

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal, closing workers...');

  await Promise.allSettled([
    reelWorker.close(),
    longFormWorker.close(),
    cartoonWorker.close(),
    quoteWorker.close(),
    challengeWorker.close(),
    gameplayWorker.close(),
    imageStudioWorker.close(),
    emailWorker.close(),
    sequenceWorker.close(),
    triggerWorker.close(),
    badgeWorker.close(),
    autopilotSchedulerWorker.close(),
    autopilotPublisherWorker.close(),
  ]);

  await connection.quit();
  logger.info('All workers closed, exiting');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---------------------------------------------------------------------------
// Startup log
// ---------------------------------------------------------------------------
logger.info(
  {
    queues: ['reel-jobs', 'long-form-jobs', 'cartoon-episode-jobs', 'quote-jobs', 'challenge-jobs', 'gameplay-jobs', 'image-studio-jobs', 'email-notifications', 'sequence-processor', 'sequence-trigger-checker', 'badge-checker', 'autopilot-scheduler', 'autopilot-publisher'],
    concurrency: { reelJobs: 5, longFormJobs: 2, cartoonEpisodes: 2, quoteJobs: 5, challengeJobs: 5, gameplayJobs: 3, imageStudioJobs: 3, emailNotifications: 10, sequences: 1, triggers: 1, badges: 1, autopilotScheduler: 1, autopilotPublisher: 1 },
    redis: process.env.REDIS_URL ? '(configured)' : 'redis://localhost:6379',
  },
  'ReelForge worker service started',
);
