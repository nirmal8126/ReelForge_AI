import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from './utils/logger';
import { processReelJob } from './jobs/reel-processor';

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
// Graceful shutdown
// ---------------------------------------------------------------------------
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal, closing workers...');

  await Promise.allSettled([
    reelWorker.close(),
    emailWorker.close(),
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
    queues: ['reel-jobs', 'email-notifications'],
    concurrency: { reelJobs: 5, emailNotifications: 10 },
    redis: process.env.REDIS_URL ? '(configured)' : 'redis://localhost:6379',
  },
  'ReelForge worker service started',
);
