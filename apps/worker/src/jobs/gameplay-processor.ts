import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from '../utils/logger';
import { generateGameConfig } from '../services/gameplay-config-generator';
import { renderGameplayFrames } from '../services/gameplay-renderer';
import { encodeGameplay, generateThumbnail } from '../services/gameplay-encoder';
import { uploadGameplayToStorage } from '../services/gameplay-storage';
import { generateBackgroundMusic } from '../services/music-generator';
import { generateHashtags } from '../services/hashtag-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameplayJobData {
  gameplayJobId: string;
  userId: string;
  template: string;
  theme: string;
  difficulty: string;
  duration: number;
  aspectRatio: string;
  musicStyle: string;
  gameTitle?: string;
  showScore: boolean;
  ctaText?: string;
}

export interface GameplayJobResult {
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Main gameplay processing pipeline
// ---------------------------------------------------------------------------

/**
 * Gameplay processing pipeline:
 * 1. CONFIG_GENERATING — AI generates game event config
 * 2. RENDERING — node-canvas renders frames at 30fps
 * 3. ENCODING — FFmpeg encodes PNG sequence → MP4
 * 4. UPLOADING — Upload to R2 storage
 */
export async function processGameplayJob(job: Job<GameplayJobData>): Promise<GameplayJobResult> {
  const startTime = Date.now();
  const { gameplayJobId, userId, template, theme, difficulty, duration, aspectRatio, musicStyle, gameTitle, showScore, ctaText } = job.data;
  const log = logger.child({ gameplayJobId, jobId: job.id });

  // Create temp directory for frames
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gameplay-'));
  let musicFilePath: string | null = null;

  try {
    // ------------------------------------------------------------------
    // Stage 1: Generate game config (AI or procedural)
    // ------------------------------------------------------------------
    log.info('Generating gameplay config');
    await updateStatus(gameplayJobId, 'CONFIG_GENERATING', 5, 'Generating game config...');
    await job.updateProgress(5);

    const gameConfig = await generateGameConfig(
      template, theme, difficulty, duration, aspectRatio,
      gameTitle, showScore, ctaText,
    );

    // Store config in DB
    await prisma.gameplayJob.update({
      where: { id: gameplayJobId },
      data: {
        gameConfig: JSON.stringify(gameConfig),
        totalFrames: gameConfig.totalFrames,
      },
    });

    log.info({ eventCount: gameConfig.events.length, totalFrames: gameConfig.totalFrames }, 'Game config generated');
    await job.updateProgress(12);

    // Generate background music (if not 'none')
    try {
      musicFilePath = await generateBackgroundMusic({
        musicStyle,
        durationSeconds: duration,
      });
      if (musicFilePath) {
        log.info({ musicStyle, musicFilePath }, 'Background music generated');
      }
    } catch (err) {
      log.warn({ err, musicStyle }, 'Music generation failed, continuing without music');
    }

    await job.updateProgress(15);

    // ------------------------------------------------------------------
    // Stage 2: Render frames with node-canvas
    // ------------------------------------------------------------------
    log.info('Rendering gameplay frames');
    await updateStatus(gameplayJobId, 'RENDERING', 15, 'Rendering frames...');

    const totalRendered = await renderGameplayFrames(gameConfig, tmpDir, async (rendered, total) => {
      const renderProgress = 15 + Math.floor((rendered / total) * 55); // 15-70%
      await job.updateProgress(renderProgress);
      // Update DB progress every 30 frames (~1 second)
      if (rendered % 30 === 0) {
        await prisma.gameplayJob.update({
          where: { id: gameplayJobId },
          data: { progress: renderProgress, currentStage: `Rendering frame ${rendered}/${total}...` },
        });
      }
    });

    log.info({ totalRendered }, 'Frames rendered');
    await job.updateProgress(70);

    // ------------------------------------------------------------------
    // Stage 3: Encode with FFmpeg
    // ------------------------------------------------------------------
    log.info('Encoding gameplay video');
    await updateStatus(gameplayJobId, 'ENCODING', 75, 'Encoding video...');
    await job.updateProgress(75);

    const outputPath = path.join(tmpDir, 'output.mp4');
    const videoBuffer = await encodeGameplay({
      framesDir: tmpDir,
      fps: gameConfig.fps,
      outputPath,
      musicPath: musicFilePath || undefined,
    });

    // Generate thumbnail
    const thumbPath = path.join(tmpDir, 'thumbnail.jpg');
    let thumbnailBuffer: Buffer | null = null;
    try {
      thumbnailBuffer = await generateThumbnail(tmpDir, thumbPath);
    } catch (err) {
      log.warn({ err }, 'Thumbnail generation failed, continuing without thumbnail');
    }

    log.info({ videoSizeBytes: videoBuffer.length }, 'Video encoded');
    await job.updateProgress(85);

    // ------------------------------------------------------------------
    // Stage 4: Upload to storage
    // ------------------------------------------------------------------
    log.info('Uploading gameplay video');
    await updateStatus(gameplayJobId, 'UPLOADING', 85, 'Uploading video...');
    await job.updateProgress(85);

    const { outputUrl, thumbnailUrl } = await uploadGameplayToStorage(
      videoBuffer, thumbnailBuffer, userId, gameplayJobId,
    );

    await job.updateProgress(95);

    // ------------------------------------------------------------------
    // Mark Complete
    // ------------------------------------------------------------------
    const processingTimeMs = Date.now() - startTime;

    const hashtags = await generateHashtags({
      title: job.data.gameTitle || job.data.template,
      style: job.data.theme,
      module: 'gameplay',
    });

    await prisma.gameplayJob.update({
      where: { id: gameplayJobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        currentStage: null,
        outputUrl,
        thumbnailUrl,
        processingTimeMs,
        completedAt: new Date(),
        hashtags,
      },
    });

    await job.updateProgress(100);
    log.info({ processingTimeMs, outputUrl }, 'Gameplay job completed');

    return { processingTimeMs };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ err: error, elapsedMs: elapsed }, 'Gameplay job failed');

    await prisma.gameplayJob.update({
      where: { id: gameplayJobId },
      data: {
        status: 'FAILED',
        errorMessage,
        processingTimeMs: elapsed,
      },
    });

    throw error;
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      log.debug({ tmpDir }, 'Cleaned up temp directory');
    } catch (cleanupErr) {
      log.warn({ tmpDir, err: cleanupErr }, 'Failed to clean up temp directory');
    }
    // Cleanup music temp file (stored outside tmpDir)
    if (musicFilePath) {
      try { fs.unlinkSync(musicFilePath); } catch { /* ignore */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function updateStatus(
  gameplayJobId: string,
  status: 'CONFIG_GENERATING' | 'RENDERING' | 'ENCODING' | 'UPLOADING',
  progress: number,
  currentStage: string,
): Promise<void> {
  await prisma.gameplayJob.update({
    where: { id: gameplayJobId },
    data: { status, progress, currentStage },
  });
}
