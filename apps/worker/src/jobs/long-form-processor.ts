import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';
import { generateScript } from '../services/script-generator';
import { generateVoiceover } from '../services/voiceover-generator';
import { processSegments } from '../services/segment-processor';
import { composeLongForm } from '../services/long-form-composer';
import { uploadToStorage } from '../services/storage';

export interface LongFormJobData {
  longFormJobId: string;
  userId: string;
  prompt: string;
  title: string;
  durationMinutes: number;
  style?: string;
  language?: string;
  voiceId?: string;
  aspectRatio: string;
  aiClipRatio: number;
  useStockFootage: boolean;
  useStaticVisuals: boolean;
  publishToYouTube: boolean;
  channelProfileId?: string;
  plan: string;
}

export interface LongFormJobResult {
  outputUrl: string;
  thumbnailUrl?: string;
  processingTimeMs: number;
}

/**
 * Main 10-stage long-form video processing pipeline.
 *
 * Stages:
 *  1. Planning & Outline (0-10%): Generate chapter structure with Claude
 *  2. Script Generation (10-25%): Full script split by segments
 *  3. Voiceover (25-35%): Single long audio, split by timestamps
 *  4. Parallel Segment Processing (35-75%): AI clips/stock/static per segment
 *  5. Stock Footage Integration (concurrent): Download from Pexels/Pixabay
 *  6. Composition (75-85%): FFmpeg concat + transitions + captions
 *  7. Thumbnail (85-87%): Extract keyframe + text overlay
 *  8. Upload (87-92%): R2 storage + preview clips
 *  9. YouTube Publishing (92-98%): Optional auto-publish
 *  10. Completion (98-100%): Update stats, notifications
 */
export async function processLongFormJob(job: Job<LongFormJobData>): Promise<LongFormJobResult> {
  const startTime = Date.now();
  const { longFormJobId, userId, prompt, title, durationMinutes } = job.data;
  const log = logger.child({ longFormJobId, jobId: job.id });

  try {
    // ------------------------------------------------------------------
    // Stage 1: Planning & Outline (0-10%)
    // ------------------------------------------------------------------
    log.info('Stage 1/10 — Planning & Outline');
    await updateStatus(longFormJobId, 'PLANNING');
    await job.updateProgress(5);

    const outline = await generateOutline({
      prompt,
      title,
      durationMinutes,
      language: job.data.language || 'en',
    });

    await prisma.longFormJob.update({
      where: { id: longFormJobId },
      data: { outline },
    });

    log.info({ segmentCount: outline.segments.length }, 'Outline generated');
    await job.updateProgress(10);

    // ------------------------------------------------------------------
    // Stage 2: Script Generation (10-25%)
    // ------------------------------------------------------------------
    log.info('Stage 2/10 — Generating full script');
    await updateStatus(longFormJobId, 'SCRIPT_GENERATING');

    const script = await generateLongFormScript({
      prompt,
      outline,
      language: job.data.language || 'en',
      durationMinutes,
    });

    await prisma.longFormJob.update({
      where: { id: longFormJobId },
      data: { script },
    });

    log.info({ scriptLength: script.length }, 'Script generated');
    await job.updateProgress(25);

    // ------------------------------------------------------------------
    // Stage 3: Voiceover Generation (25-35%)
    // ------------------------------------------------------------------
    log.info('Stage 3/10 — Generating voiceover');
    await updateStatus(longFormJobId, 'VOICE_GENERATING');

    const audioBuffer = await generateVoiceover({
      script,
      voiceId: job.data.voiceId || 'EXAVITQu4vr4xnSDxMaL',
      language: job.data.language || 'en',
    });

    log.info({ audioSizeBytes: audioBuffer.length }, 'Voiceover generated');
    await job.updateProgress(35);

    // ------------------------------------------------------------------
    // Stage 4: Parallel Segment Processing (35-75%)
    // ------------------------------------------------------------------
    log.info('Stage 4/10 — Processing segments');
    await updateStatus(longFormJobId, 'VIDEO_GENERATING');

    // Create segment records in database
    const segmentDuration = (durationMinutes * 60) / outline.segments.length;
    const segments = await Promise.all(
      outline.segments.map((seg, idx) =>
        prisma.longFormSegment.create({
          data: {
            longFormJobId,
            segmentIndex: idx,
            title: seg.title,
            scriptText: seg.script,
            startTime: idx * segmentDuration,
            endTime: (idx + 1) * segmentDuration,
            visualType: 'PENDING' as any,
            status: 'PENDING',
          },
        })
      )
    );

    // Process segments in parallel with progress tracking
    const processedSegments = await processSegments({
      segments,
      longFormJobId,
      prompt,
      style: job.data.style,
      aiClipRatio: job.data.aiClipRatio,
      useStockFootage: job.data.useStockFootage,
      useStaticVisuals: job.data.useStaticVisuals,
      aspectRatio: job.data.aspectRatio,
      onProgress: async (progress) => {
        // Map segment progress (0-100) to overall progress (35-75)
        const overallProgress = 35 + (progress / 100) * 40;
        await job.updateProgress(Math.floor(overallProgress));
      },
    });

    log.info({ processedCount: processedSegments.length }, 'Segments processed');
    await job.updateProgress(75);

    // ------------------------------------------------------------------
    // Stage 5: Composition (75-85%)
    // ------------------------------------------------------------------
    log.info('Stage 5/10 — Composing final video');
    await updateStatus(longFormJobId, 'COMPOSING');

    const composedBuffer = await composeLongForm({
      segments: processedSegments,
      audioBuffer,
      script,
      aspectRatio: job.data.aspectRatio,
    });

    log.info({ composedSizeBytes: composedBuffer.length }, 'Video composed');
    await job.updateProgress(85);

    // ------------------------------------------------------------------
    // Stage 6: Thumbnail Generation (85-87%)
    // ------------------------------------------------------------------
    log.info('Stage 6/10 — Generating thumbnail');
    // TODO: Implement thumbnail generation (extract keyframe + text overlay)
    await job.updateProgress(87);

    // ------------------------------------------------------------------
    // Stage 7: Upload to Storage (87-92%)
    // ------------------------------------------------------------------
    log.info('Stage 7/10 — Uploading to storage');
    await updateStatus(longFormJobId, 'UPLOADING');

    const { url: outputUrl, thumbnailUrl } = await uploadToStorage({
      buffer: composedBuffer,
      userId,
      reelJobId: longFormJobId, // Reuse storage service
    });

    log.info({ outputUrl }, 'Uploaded to storage');
    await job.updateProgress(92);

    // ------------------------------------------------------------------
    // Stage 8: YouTube Publishing (92-98%)
    // ------------------------------------------------------------------
    if (job.data.publishToYouTube) {
      log.info('Stage 8/10 — Publishing to YouTube');
      await updateStatus(longFormJobId, 'PUBLISHING');
      // TODO: Implement YouTube publishing
      await job.updateProgress(98);
    } else {
      await job.updateProgress(98);
    }

    // ------------------------------------------------------------------
    // Stage 9: Completion (98-100%)
    // ------------------------------------------------------------------
    const processingTimeMs = Date.now() - startTime;
    log.info('Stage 10/10 — Marking job as complete');

    await prisma.longFormJob.update({
      where: { id: longFormJobId },
      data: {
        status: 'COMPLETED',
        outputUrl,
        thumbnailUrl,
        processingTimeMs,
        progress: 100,
        completedAt: new Date(),
      },
    });

    // Deduct credits from user
    const jobData = await prisma.longFormJob.findUnique({
      where: { id: longFormJobId },
      select: { creditsCost: true },
    });

    if (jobData?.creditsCost) {
      await prisma.user.update({
        where: { id: userId },
        data: { creditsBalance: { decrement: jobData.creditsCost } },
      });
    }

    await job.updateProgress(100);
    log.info({ processingTimeMs, outputUrl }, 'Long-form job completed');

    return { outputUrl, thumbnailUrl: thumbnailUrl ?? undefined, processingTimeMs };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ err: error, elapsedMs: elapsed }, 'Long-form job failed');

    await prisma.longFormJob.update({
      where: { id: longFormJobId },
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
  longFormJobId: string,
  status:
    | 'PLANNING'
    | 'SCRIPT_GENERATING'
    | 'VOICE_GENERATING'
    | 'VIDEO_GENERATING'
    | 'COMPOSING'
    | 'UPLOADING'
    | 'PUBLISHING',
): Promise<void> {
  await prisma.longFormJob.update({
    where: { id: longFormJobId },
    data: { status },
  });
}

// ---------------------------------------------------------------------------
// Planning & Outline Generation
// ---------------------------------------------------------------------------

interface OutlineSegment {
  title: string;
  script: string;
  durationSeconds: number;
}

interface Outline {
  segments: OutlineSegment[];
}

async function generateOutline(opts: {
  prompt: string;
  title: string;
  durationMinutes: number;
  language: string;
}): Promise<Outline> {
  const log = logger.child({ service: 'outline-generator' });

  // Use Claude to generate outline
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const segmentCount = Math.ceil(opts.durationMinutes / 2); // ~2 min per segment
  const segmentDuration = (opts.durationMinutes * 60) / segmentCount;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: `You are a long-form video content strategist. Generate a structured outline for a ${opts.durationMinutes}-minute video with ${segmentCount} segments (~${Math.floor(segmentDuration)}s each).

Return ONLY a JSON object with this structure:
{
  "segments": [
    { "title": "Introduction", "script": "brief script outline", "durationSeconds": 120 },
    { "title": "Main Point 1", "script": "brief script outline", "durationSeconds": 120 },
    ...
  ]
}`,
    messages: [
      {
        role: 'user',
        content: `Create an outline for a video titled "${opts.title}" about: ${opts.prompt}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Anthropic response');
  }

  try {
    const outline = JSON.parse(textBlock.text.trim()) as Outline;
    log.info({ segmentCount: outline.segments.length }, 'Outline generated');
    return outline;
  } catch (err) {
    log.error({ err, text: textBlock.text }, 'Failed to parse outline JSON');
    throw new Error('Failed to parse outline JSON');
  }
}

// ---------------------------------------------------------------------------
// Long-Form Script Generation
// ---------------------------------------------------------------------------

async function generateLongFormScript(opts: {
  prompt: string;
  outline: Outline;
  language: string;
  durationMinutes: number;
}): Promise<string> {
  const log = logger.child({ service: 'long-form-script-generator' });

  // Use Claude to expand outline into full script
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    system: `You are an expert long-form video scriptwriter. Expand the provided outline into a complete, engaging ${opts.durationMinutes}-minute script.

REQUIREMENTS:
- Language: ${opts.language}
- Write ONLY the spoken script — no stage directions, no timestamps
- Each segment should flow naturally into the next
- Include engaging hooks, clear explanations, and strong CTAs
- Target ~${opts.durationMinutes * 150} words total`,
    messages: [
      {
        role: 'user',
        content: `Expand this outline into a full script:\n\n${JSON.stringify(opts.outline, null, 2)}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Anthropic response');
  }

  const script = textBlock.text.trim();
  log.info({ scriptLength: script.length }, 'Long-form script generated');
  return script;
}
