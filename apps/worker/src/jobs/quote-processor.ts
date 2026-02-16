import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';
import { generateQuoteText } from '../services/quote-text-generator';
import { generateVoiceover } from '../services/voiceover-generator';
import { composeQuoteImage, composeQuoteVideo } from '../services/quote-image-composer';
import { uploadQuoteToStorage } from '../services/quote-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuoteJobData {
  quoteJobId: string;
  userId: string;
  prompt: string;
  category: string;
  language: string;
  bgType: string;
  bgValue?: string;
  textColor: string;
  fontStyle: string;
  aspectRatio: string;
  voiceId?: string;
}

export interface QuoteJobResult {
  imageUrl: string;
  videoUrl: string;
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Main 5-stage quote processing pipeline
// ---------------------------------------------------------------------------

/**
 * Main 5-stage quote processing pipeline.
 *
 * Stages:
 *  1. Quote text generation (AI)
 *  2. Background image preparation
 *  3. Voiceover generation
 *  4. Image + Video composition (FFmpeg)
 *  5. Upload to storage
 */
export async function processQuoteJob(job: Job<QuoteJobData>): Promise<QuoteJobResult> {
  const startTime = Date.now();
  const { quoteJobId, userId, prompt, category, language } = job.data;
  const log = logger.child({ quoteJobId, jobId: job.id });

  try {
    // ------------------------------------------------------------------
    // Stage 1: Quote Text Generation
    // ------------------------------------------------------------------
    log.info('Stage 1/5 — Generating quote text');
    await updateStatus(quoteJobId, 'TEXT_GENERATING', 0, 'Generating quote text...');
    await job.updateProgress(5);

    const { quote, author } = await generateQuoteText(category, language, prompt);

    await prisma.quoteJob.update({
      where: { id: quoteJobId },
      data: { quoteText: quote, author },
    });

    log.info({ quoteLength: quote.length, author }, 'Quote text generated');
    await job.updateProgress(25);

    // ------------------------------------------------------------------
    // Stage 2: Background Image Preparation
    // ------------------------------------------------------------------
    log.info('Stage 2/5 — Preparing background');
    await updateStatus(quoteJobId, 'IMAGE_GENERATING', 25, 'Creating background...');

    // For stock/AI backgrounds, we'd fetch/generate them here.
    // For now, the bgValue contains the gradient colors or image path.
    // In the future: fetch stock photo from Pexels or generate via DALL-E.

    log.info('Background prepared');
    await job.updateProgress(50);

    // ------------------------------------------------------------------
    // Stage 3: Voiceover Generation
    // ------------------------------------------------------------------
    log.info('Stage 3/5 — Generating voiceover');
    await updateStatus(quoteJobId, 'VOICE_GENERATING', 50, 'Recording voiceover...');

    const voiceId = job.data.voiceId || 'EXAVITQu4vr4xnSDxMaL'; // default: Sarah
    const audioBuffer = await generateVoiceover({
      script: quote,
      voiceId,
      language,
    });

    log.info({ audioSizeBytes: audioBuffer.length }, 'Voiceover generated');
    await job.updateProgress(70);

    // ------------------------------------------------------------------
    // Stage 4: Image + Video Composition (FFmpeg)
    // ------------------------------------------------------------------
    log.info('Stage 4/5 — Composing image and video');
    await updateStatus(quoteJobId, 'COMPOSING', 70, 'Composing final output...');

    const composeOpts = {
      quoteText: quote,
      author,
      bgType: job.data.bgType as 'gradient' | 'stock' | 'ai',
      bgValue: job.data.bgValue,
      textColor: job.data.textColor,
      fontStyle: job.data.fontStyle,
      aspectRatio: job.data.aspectRatio,
      audioBuffer,
    };

    const [imageBuffer, videoBuffer] = await Promise.all([
      composeQuoteImage(composeOpts),
      composeQuoteVideo(composeOpts),
    ]);

    log.info(
      { imageSizeBytes: imageBuffer.length, videoSizeBytes: videoBuffer.length },
      'Composition complete',
    );
    await job.updateProgress(90);

    // ------------------------------------------------------------------
    // Stage 5: Upload to Storage
    // ------------------------------------------------------------------
    log.info('Stage 5/5 — Uploading to storage');
    await updateStatus(quoteJobId, 'UPLOADING', 90, 'Uploading files...');

    const { imageUrl, videoUrl, thumbnailUrl } = await uploadQuoteToStorage(
      imageBuffer,
      videoBuffer,
      userId,
      quoteJobId,
    );

    log.info({ imageUrl, videoUrl }, 'Files uploaded');
    await job.updateProgress(95);

    // ------------------------------------------------------------------
    // Mark Complete
    // ------------------------------------------------------------------
    const processingTimeMs = Date.now() - startTime;
    log.info('Marking job as complete');

    await prisma.quoteJob.update({
      where: { id: quoteJobId },
      data: {
        status: 'COMPLETED',
        imageUrl,
        videoUrl,
        thumbnailUrl,
        progress: 100,
        currentStage: null,
        processingTimeMs,
        completedAt: new Date(),
      },
    });

    await job.updateProgress(100);
    log.info({ processingTimeMs, imageUrl, videoUrl }, 'Quote job completed');

    return { imageUrl, videoUrl, processingTimeMs };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ err: error, elapsedMs: elapsed }, 'Quote job failed');

    await prisma.quoteJob.update({
      where: { id: quoteJobId },
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
  quoteJobId: string,
  status: 'TEXT_GENERATING' | 'IMAGE_GENERATING' | 'VOICE_GENERATING' | 'COMPOSING' | 'UPLOADING',
  progress: number,
  currentStage: string,
): Promise<void> {
  await prisma.quoteJob.update({
    where: { id: quoteJobId },
    data: { status, progress, currentStage },
  });
}
