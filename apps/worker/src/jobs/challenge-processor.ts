import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';
import { generateChallengeContent } from '../services/challenge-content-generator';
import { composeChallengeVideo } from '../services/challenge-video-composer';
import { uploadChallengeToStorage } from '../services/challenge-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChallengeJobData {
  challengeJobId: string;
  userId: string;
  challengeType: string;
  category: string;
  difficulty: string;
  numQuestions: number;
  timerSeconds: number;
  language: string;
  prompt?: string;
  templateStyle: string;
  voiceEnabled: boolean;
  voiceId?: string;
}

export interface ChallengeJobResult {
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Main challenge processing pipeline
// ---------------------------------------------------------------------------

/**
 * Challenge processing pipeline:
 * 1. CONTENT_GENERATING — AI generates questions/answers/CTAs
 * 2. COMPOSING — FFmpeg creates the multi-slide video
 * 3. UPLOADING — Upload to R2 storage
 */
export async function processChallengeJob(job: Job<ChallengeJobData>): Promise<ChallengeJobResult> {
  const startTime = Date.now();
  const { challengeJobId, userId, challengeType, category, difficulty, numQuestions, timerSeconds, language, prompt, templateStyle, voiceEnabled, voiceId } = job.data;
  const log = logger.child({ challengeJobId, jobId: job.id });

  try {
    // ------------------------------------------------------------------
    // Stage 1: Generate challenge content (questions, answers, CTA)
    // ------------------------------------------------------------------
    log.info('Generating challenge content');
    await updateStatus(challengeJobId, 'CONTENT_GENERATING', 5, 'Generating questions...');
    await job.updateProgress(5);

    const content = await generateChallengeContent(
      challengeType, category, difficulty, numQuestions, language, prompt,
    );

    // Store generated content as JSON
    await prisma.challengeJob.update({
      where: { id: challengeJobId },
      data: {
        questionsJson: JSON.stringify(content.questions),
        ctaText: content.ctaText,
      },
    });

    log.info({ questionCount: content.questions.length }, 'Challenge content generated');
    await job.updateProgress(30);

    // ------------------------------------------------------------------
    // Stage 2: Compose video with FFmpeg
    // ------------------------------------------------------------------
    log.info('Composing challenge video');
    await updateStatus(challengeJobId, 'COMPOSING', 35, 'Creating video...');
    await job.updateProgress(35);

    // TODO: if voiceEnabled, generate voiceover first
    // For v1, we compose without voiceover audio
    const videoBuffer = await composeChallengeVideo({
      questions: content.questions,
      ctaText: content.ctaText,
      challengeType,
      timerSeconds,
      templateStyle,
    });

    log.info({ videoSizeBytes: videoBuffer.length }, 'Challenge video composed');
    await job.updateProgress(75);

    // ------------------------------------------------------------------
    // Stage 3: Upload to storage
    // ------------------------------------------------------------------
    log.info('Uploading challenge video');
    await updateStatus(challengeJobId, 'UPLOADING', 80, 'Uploading video...');
    await job.updateProgress(80);

    const { outputUrl, thumbnailUrl } = await uploadChallengeToStorage(
      videoBuffer, userId, challengeJobId,
    );

    await job.updateProgress(95);

    // ------------------------------------------------------------------
    // Mark Complete
    // ------------------------------------------------------------------
    const processingTimeMs = Date.now() - startTime;

    await prisma.challengeJob.update({
      where: { id: challengeJobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        currentStage: null,
        outputUrl,
        thumbnailUrl,
        processingTimeMs,
        completedAt: new Date(),
      },
    });

    await job.updateProgress(100);
    log.info({ processingTimeMs, outputUrl }, 'Challenge job completed');

    return { processingTimeMs };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ err: error, elapsedMs: elapsed }, 'Challenge job failed');

    await prisma.challengeJob.update({
      where: { id: challengeJobId },
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
  challengeJobId: string,
  status: 'CONTENT_GENERATING' | 'COMPOSING' | 'UPLOADING',
  progress: number,
  currentStage: string,
): Promise<void> {
  await prisma.challengeJob.update({
    where: { id: challengeJobId },
    data: { status, progress, currentStage },
  });
}
