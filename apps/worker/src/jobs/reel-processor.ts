import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';
import { generateScript } from '../services/script-generator';
import { generateVoiceover } from '../services/voiceover-generator';
import { generateVideo } from '../services/video-generator';
import { composeReel } from '../services/composer';
import { uploadToStorage } from '../services/storage';

export interface ReelJobData {
  reelJobId: string;
  userId: string;
  prompt: string;
  script?: string;
  title: string;
  durationSeconds: number;
  language?: string;
  style?: string;
  tone?: string;
  niche?: string;
  hookStyle?: string;
  voiceId?: string;
  captionStyle?: string;
  primaryColor?: string;
  channelProfileId?: string;
}

export interface ReelJobResult {
  outputUrl: string;
  thumbnailUrl?: string;
  processingTimeMs: number;
}

/**
 * Main 7-stage reel processing pipeline.
 *
 * Stages:
 *  1. Script generation
 *  2. Voiceover generation
 *  3. Video generation
 *  4. Composition (FFmpeg)
 *  5. Upload to storage
 *  6. Mark complete
 */
export async function processReelJob(job: Job<ReelJobData>): Promise<ReelJobResult> {
  const startTime = Date.now();
  const { reelJobId, userId, prompt, durationSeconds } = job.data;
  const log = logger.child({ reelJobId, jobId: job.id });

  try {
    // ------------------------------------------------------------------
    // Stage 1: Script Generation
    // ------------------------------------------------------------------
    log.info('Stage 1/6 — Generating script');
    await updateStatus(reelJobId, 'SCRIPT_GENERATING');
    await job.updateProgress(10);

    let script: string;
    if (job.data.script) {
      script = job.data.script;
      log.info({ scriptLength: script.length }, 'Using pre-generated script');
    } else {
      script = await generateScript({
        prompt,
        tone: job.data.tone || 'PROFESSIONAL',
        niche: job.data.niche || 'general',
        language: job.data.language || 'hi',
        durationSeconds,
        hookStyle: job.data.hookStyle || 'question',
      });
    }

    await prisma.reelJob.update({
      where: { id: reelJobId },
      data: { script },
    });

    log.info({ scriptLength: script.length }, 'Script generated');
    await job.updateProgress(25);

    // ------------------------------------------------------------------
    // Stage 2: Voiceover Generation
    // ------------------------------------------------------------------
    log.info('Stage 2/6 — Generating voiceover');
    await updateStatus(reelJobId, 'VOICE_GENERATING');

    const audioBuffer = await generateVoiceover({
      script,
      voiceId: job.data.voiceId || 'EXAVITQu4vr4xnSDxMaL', // default: Sarah
      language: job.data.language || 'hi',
    });

    log.info({ audioSizeBytes: audioBuffer.length }, 'Voiceover generated');
    await job.updateProgress(40);

    // ------------------------------------------------------------------
    // Stage 3: Video Generation
    // ------------------------------------------------------------------
    log.info('Stage 3/6 — Generating video');
    await updateStatus(reelJobId, 'VIDEO_GENERATING');

    const videoBuffer = await generateVideo({
      prompt,
      style: job.data.style || 'cinematic',
      durationSeconds,
    });

    log.info({ videoSizeBytes: videoBuffer.length }, 'Video generated');
    await job.updateProgress(60);

    // ------------------------------------------------------------------
    // Stage 4: Composition (FFmpeg)
    // ------------------------------------------------------------------
    log.info('Stage 4/6 — Composing final reel');
    await updateStatus(reelJobId, 'COMPOSING');

    const composedBuffer = await composeReel({
      videoBuffer,
      audioBuffer,
      script,
      captionStyle: job.data.captionStyle || 'default',
      primaryColor: job.data.primaryColor || '#6366F1',
    });

    log.info({ composedSizeBytes: composedBuffer.length }, 'Reel composed');
    await job.updateProgress(80);

    // ------------------------------------------------------------------
    // Stage 5: Upload to Storage
    // ------------------------------------------------------------------
    log.info('Stage 5/6 — Uploading to storage');
    await updateStatus(reelJobId, 'UPLOADING');

    const { url: outputUrl, thumbnailUrl } = await uploadToStorage({
      buffer: composedBuffer,
      userId,
      reelJobId,
    });

    log.info({ outputUrl }, 'Uploaded to storage');
    await job.updateProgress(95);

    // ------------------------------------------------------------------
    // Stage 6: Mark Complete
    // ------------------------------------------------------------------
    const processingTimeMs = Date.now() - startTime;
    log.info('Stage 6/6 — Marking job as complete');

    await prisma.reelJob.update({
      where: { id: reelJobId },
      data: {
        status: 'COMPLETED',
        outputUrl,
        thumbnailUrl,
        processingTimeMs,
        completedAt: new Date(),
      },
    });

    await job.updateProgress(100);
    log.info({ processingTimeMs, outputUrl }, 'Reel job completed');

    return { outputUrl, thumbnailUrl: thumbnailUrl ?? undefined, processingTimeMs };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ err: error, elapsedMs: elapsed }, 'Reel job failed');

    await prisma.reelJob.update({
      where: { id: reelJobId },
      data: {
        status: 'FAILED',
        errorMessage,
        processingTimeMs: elapsed,
      },
    });

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function updateStatus(
  reelJobId: string,
  status: 'SCRIPT_GENERATING' | 'VOICE_GENERATING' | 'VIDEO_GENERATING' | 'COMPOSING' | 'UPLOADING',
): Promise<void> {
  await prisma.reelJob.update({
    where: { id: reelJobId },
    data: { status },
  });
}
