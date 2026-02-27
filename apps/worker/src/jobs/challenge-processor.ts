import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from '../utils/logger';
import { generateChallengeContent, ChallengeQuestion } from '../services/challenge-content-generator';
import { composeChallengeVideo } from '../services/challenge-video-composer';
import { generateVoiceover } from '../services/voiceover-generator';
import { uploadChallengeToStorage } from '../services/challenge-storage';
import { generateHashtags } from '../services/hashtag-generator';

const execFileAsync = promisify(execFile);

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
 * 2. (Optional) Voiceover generation via ElevenLabs
 * 3. COMPOSING — FFmpeg creates the multi-slide video (with audio if voice enabled)
 * 4. Thumbnail extraction from composed video
 * 5. UPLOADING — Upload to R2 storage
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
    await job.updateProgress(25);

    // ------------------------------------------------------------------
    // Stage 2: Generate voiceover (if enabled)
    // ------------------------------------------------------------------
    let audioBuffer: Buffer | undefined;

    if (voiceEnabled && voiceId) {
      log.info({ voiceId, language }, 'Generating voiceover');
      await updateStatus(challengeJobId, 'COMPOSING', 30, 'Generating voiceover...');
      await job.updateProgress(30);

      try {
        const voiceoverScript = buildVoiceoverScript(content.questions, content.ctaText, challengeType);
        audioBuffer = await generateVoiceover({
          script: voiceoverScript,
          voiceId,
          language,
        });
        log.info({ audioSizeBytes: audioBuffer.length }, 'Voiceover generated');
      } catch (err) {
        log.warn({ err }, 'Voiceover generation failed, continuing without audio');
      }
    }

    await job.updateProgress(40);

    // ------------------------------------------------------------------
    // Stage 3: Compose video with FFmpeg
    // ------------------------------------------------------------------
    log.info('Composing challenge video');
    await updateStatus(challengeJobId, 'COMPOSING', 40, 'Creating video...');
    await job.updateProgress(45);

    const videoBuffer = await composeChallengeVideo({
      questions: content.questions,
      ctaText: content.ctaText,
      challengeType,
      timerSeconds,
      templateStyle,
      audioBuffer,
    });

    log.info({ videoSizeBytes: videoBuffer.length }, 'Challenge video composed');
    await job.updateProgress(70);

    // ------------------------------------------------------------------
    // Stage 3b: Generate thumbnail from composed video
    // ------------------------------------------------------------------
    let thumbnailBuffer: Buffer | null = null;
    try {
      thumbnailBuffer = await extractThumbnail(videoBuffer);
      log.info({ thumbSize: thumbnailBuffer.length }, 'Thumbnail extracted');
    } catch (err) {
      log.warn({ err }, 'Thumbnail extraction failed, continuing without thumbnail');
    }

    await job.updateProgress(75);

    // ------------------------------------------------------------------
    // Stage 4: Upload to storage
    // ------------------------------------------------------------------
    log.info('Uploading challenge video');
    await updateStatus(challengeJobId, 'UPLOADING', 80, 'Uploading video...');
    await job.updateProgress(80);

    const { outputUrl, thumbnailUrl } = await uploadChallengeToStorage(
      videoBuffer, thumbnailBuffer, userId, challengeJobId,
    );

    await job.updateProgress(95);

    // ------------------------------------------------------------------
    // Mark Complete
    // ------------------------------------------------------------------
    const processingTimeMs = Date.now() - startTime;

    const hashtags = await generateHashtags({
      title: challengeType.replace(/_/g, ' ') + ' challenge',
      category,
      language,
      module: 'challenge',
    });

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
        hashtags,
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

/**
 * Build a narration script from challenge questions for voiceover.
 */
function buildVoiceoverScript(
  questions: ChallengeQuestion[],
  ctaText: string,
  challengeType: string,
): string {
  const parts: string[] = [];
  for (const q of questions) {
    parts.push(q.hookText);
    parts.push(q.question);
    if (challengeType !== 'would_you_rather') {
      parts.push(`The answer is: ${q.answer}`);
    }
  }
  parts.push(ctaText);
  return parts.join('. ');
}

/**
 * Extract a thumbnail from the composed video at ~3.5 seconds.
 */
async function extractThumbnail(videoBuffer: Buffer): Promise<Buffer> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenge-thumb-'));
  const videoPath = path.join(tmpDir, 'video.mp4');
  const thumbPath = path.join(tmpDir, 'thumbnail.jpg');

  try {
    fs.writeFileSync(videoPath, videoBuffer);

    await execFileAsync('ffmpeg', [
      '-y',
      '-ss', '3.5',
      '-i', videoPath,
      '-vf', 'scale=480:-1',
      '-q:v', '3',
      '-vframes', '1',
      thumbPath,
    ], { timeout: 30_000 });

    return fs.readFileSync(thumbPath);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
