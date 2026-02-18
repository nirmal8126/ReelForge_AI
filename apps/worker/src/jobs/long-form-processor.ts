import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';
import { generateVoiceover } from '../services/voiceover-generator';
import { processSegments } from '../services/segment-processor';
import { composeLongForm } from '../services/long-form-composer';
import { uploadToStorage } from '../services/storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

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
  recomposeOnly?: boolean; // Skip stages 1-4, jump to composition
}

export interface LongFormJobResult {
  outputUrl: string;
  thumbnailUrl?: string;
  processingTimeMs: number;
}

// Persistent audio cache dir (survives worker restarts)
const AUDIO_CACHE_DIR = path.join(os.tmpdir(), 'reelforge-audio');

function getAudioCachePath(jobId: string): string {
  return path.join(AUDIO_CACHE_DIR, `${jobId}.mp3`);
}

/**
 * Resumable long-form video processing pipeline.
 *
 * On retry/resume, skips stages whose output already exists:
 *  - Outline: stored in DB (job.outline)
 *  - Script: stored in DB (job.script)
 *  - Audio: cached to /tmp/reelforge-audio/{jobId}.mp3
 *  - Segments: checks DB for COMPLETED segment records
 *  - Composition+Upload: always re-runs from wherever it picks up
 */
export async function processLongFormJob(job: Job<LongFormJobData>): Promise<LongFormJobResult> {
  const startTime = Date.now();
  const { longFormJobId, userId, prompt, title, durationMinutes } = job.data;
  const log = logger.child({ longFormJobId, jobId: job.id });

  async function setProgress(percent: number) {
    await job.updateProgress(percent);
    await prisma.longFormJob.update({
      where: { id: longFormJobId },
      data: { progress: percent },
    });
  }

  try {
    // ------------------------------------------------------------------
    // Recompose-only mode: skip stages 1-4, jump to composition
    // ------------------------------------------------------------------
    if (job.data.recomposeOnly) {
      log.info('RECOMPOSE mode — skipping stages 1-4, jumping to composition');
      await updateStatus(longFormJobId, 'COMPOSING');
      await setProgress(75);

      // Load existing segments from DB
      const segments = await prisma.longFormSegment.findMany({
        where: { longFormJobId },
        orderBy: { segmentIndex: 'asc' },
      });

      if (segments.length === 0) {
        throw new Error('No segments found for recomposition');
      }

      const processedSegments = segments.map((s) => ({
        ...s,
        visualType: s.visualType as 'AI_CLIP' | 'STOCK_VIDEO' | 'STATIC_IMAGE',
        assetUrl: s.assetUrl!,
      }));

      // Load cached audio
      const audioCachePath = getAudioCachePath(longFormJobId);
      let audioBuffer: Buffer;
      try {
        audioBuffer = await fs.readFile(audioCachePath);
        log.info({ audioSizeBytes: audioBuffer.length }, 'Audio loaded from cache');
      } catch {
        // Audio cache expired — regenerate voiceover
        log.info('Audio cache missing — regenerating voiceover');
        const currentJob = await prisma.longFormJob.findUnique({
          where: { id: longFormJobId },
          select: { script: true },
        });
        if (!currentJob?.script) throw new Error('Script not found for recompose voiceover');

        audioBuffer = await generateVoiceover({
          script: currentJob.script,
          voiceId: job.data.voiceId || 'EXAVITQu4vr4xnSDxMaL',
          language: job.data.language || 'hi',
        });
        await fs.mkdir(AUDIO_CACHE_DIR, { recursive: true });
        await fs.writeFile(audioCachePath, audioBuffer);
      }

      // Compose
      const currentJob = await prisma.longFormJob.findUnique({
        where: { id: longFormJobId },
        select: { script: true },
      });

      const composedBuffer = await composeLongForm({
        segments: processedSegments,
        audioBuffer,
        script: currentJob?.script || '',
        aspectRatio: job.data.aspectRatio,
      });
      await setProgress(88);

      // Upload
      await updateStatus(longFormJobId, 'UPLOADING');
      const { url: outputUrl, thumbnailUrl } = await uploadToStorage({
        buffer: composedBuffer,
        userId,
        reelJobId: longFormJobId,
      });
      await setProgress(95);

      // Complete
      const processingTimeMs = Date.now() - startTime;
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

      await job.updateProgress(100);
      log.info({ processingTimeMs, outputUrl }, 'Recompose completed');
      return { outputUrl, thumbnailUrl: thumbnailUrl ?? undefined, processingTimeMs };
    }

    // ------------------------------------------------------------------
    // Pre-flight: Validate required environment before burning credits
    // ------------------------------------------------------------------
    const isDevMode = process.env.DEV_MODE === 'true';
    if (isDevMode) {
      log.info('DEV_MODE active — skipping ElevenLabs & RunwayML, using mocks');
    } else {
      log.info('Pre-flight checks');
    }

    const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;
    const hasRunwayKey = !!process.env.RUNWAY_API_KEY;

    if (!isDevMode && job.data.aiClipRatio > 0 && !hasRunwayKey && !job.data.useStockFootage && !job.data.useStaticVisuals) {
      throw new Error('RUNWAY_API_KEY is required for AI clip generation. Set aiClipRatio to 0 or enable stock footage/static visuals as fallback.');
    }

    if (!isDevMode && !hasElevenLabsKey) {
      throw new Error('ELEVENLABS_API_KEY is required for voiceover generation.');
    }

    // Load current job state for resume detection
    const currentJob = await prisma.longFormJob.findUnique({
      where: { id: longFormJobId },
      select: { outline: true, script: true },
    });

    // ------------------------------------------------------------------
    // Stage 1: Planning & Outline (0-10%)
    // ------------------------------------------------------------------
    let outline: Outline;
    const existingOutline = currentJob?.outline as { segments: OutlineSegment[] } | null;

    if (existingOutline?.segments?.length) {
      outline = existingOutline;
      log.info({ segmentCount: outline.segments.length }, 'RESUME: Outline already exists, skipping stage 1');
    } else {
      log.info('Stage 1 — Planning & Outline');
      await updateStatus(longFormJobId, 'PLANNING');
      await setProgress(5);

      outline = await generateOutline({ prompt, title, durationMinutes, language: job.data.language || 'hi' });
      await prisma.longFormJob.update({ where: { id: longFormJobId }, data: { outline } });
      log.info({ segmentCount: outline.segments.length }, 'Outline generated');
    }
    await setProgress(10);

    // ------------------------------------------------------------------
    // Stage 2: Script Generation (10-25%)
    // ------------------------------------------------------------------
    let script: string;
    const existingScript = currentJob?.script;

    if (existingScript && existingScript.length > 100) {
      script = existingScript;
      log.info({ scriptLength: script.length }, 'RESUME: Script already exists, skipping stage 2');
    } else {
      log.info('Stage 2 — Generating full script');
      await updateStatus(longFormJobId, 'SCRIPT_GENERATING');

      script = await generateLongFormScript({
        prompt,
        outline,
        language: job.data.language || 'hi',
        durationMinutes,
      });

      await prisma.longFormJob.update({
        where: { id: longFormJobId },
        data: { script },
      });
      log.info({ scriptLength: script.length }, 'Script generated');
    }
    await setProgress(25);

    // ------------------------------------------------------------------
    // Stage 3: Voiceover Generation (25-40%)
    // ------------------------------------------------------------------
    let audioBuffer: Buffer;
    const audioCachePath = getAudioCachePath(longFormJobId);

    // Check if audio was cached from a previous attempt
    let audioCached = false;
    try {
      await fs.access(audioCachePath);
      audioBuffer = await fs.readFile(audioCachePath);
      if (audioBuffer.length > 1000) {
        audioCached = true;
        log.info({ audioSizeBytes: audioBuffer.length }, 'RESUME: Audio cached from previous run, skipping stage 3');
      }
    } catch {
      // File doesn't exist, generate it
    }

    if (!audioCached) {
      log.info('Stage 3 — Generating voiceover');
      await updateStatus(longFormJobId, 'VOICE_GENERATING');

      audioBuffer = await generateVoiceover({
        script,
        voiceId: job.data.voiceId || 'EXAVITQu4vr4xnSDxMaL',
        language: job.data.language || 'hi',
      });

      // Cache audio to disk for resume
      await fs.mkdir(AUDIO_CACHE_DIR, { recursive: true });
      await fs.writeFile(audioCachePath, audioBuffer);
      log.info({ audioSizeBytes: audioBuffer.length, cachePath: audioCachePath }, 'Voiceover generated and cached');
    }
    await setProgress(40);

    // ------------------------------------------------------------------
    // Stage 4: Segment Video Processing (40-75%)
    // ------------------------------------------------------------------
    log.info('Stage 4 — Processing segments');
    await updateStatus(longFormJobId, 'VIDEO_GENERATING');

    // Check if segments already exist and are completed
    const existingSegments = await prisma.longFormSegment.findMany({
      where: { longFormJobId },
      orderBy: { segmentIndex: 'asc' },
    });

    const allSegmentsCompleted = existingSegments.length > 0 &&
      existingSegments.every((s) => s.status === 'COMPLETED' && s.assetUrl);

    let processedSegments;

    if (allSegmentsCompleted) {
      log.info({ segmentCount: existingSegments.length }, 'RESUME: All segments already completed, skipping stage 4');
      processedSegments = existingSegments.map((s) => ({
        ...s,
        visualType: s.visualType as 'AI_CLIP' | 'STOCK_VIDEO' | 'STATIC_IMAGE',
        assetUrl: s.assetUrl!,
      }));
    } else {
      // Calculate segment timings
      const fallbackDuration = (durationMinutes * 60) / outline.segments.length;
      const segmentTimings: { startTime: number; endTime: number }[] = [];
      let cumTime = 0;
      for (const seg of outline.segments) {
        const dur = seg.durationSeconds || fallbackDuration;
        segmentTimings.push({ startTime: cumTime, endTime: cumTime + dur });
        cumTime += dur;
      }

      // Delete old segments if any had failures, and recreate
      if (existingSegments.length > 0) {
        const hasFailures = existingSegments.some((s) => s.status === 'FAILED' || s.status === 'PENDING');
        if (hasFailures) {
          await prisma.longFormSegment.deleteMany({ where: { longFormJobId } });
          log.info('Cleared failed/pending segments for retry');
        }
      }

      // Create segment records
      const segmentsExist = (await prisma.longFormSegment.count({ where: { longFormJobId } })) > 0;
      let segments;

      if (segmentsExist) {
        segments = await prisma.longFormSegment.findMany({
          where: { longFormJobId },
          orderBy: { segmentIndex: 'asc' },
        });
      } else {
        segments = [];
        for (let idx = 0; idx < outline.segments.length; idx++) {
          const seg = outline.segments[idx];
          const timing = segmentTimings[idx];
          const record = await prisma.longFormSegment.create({
            data: {
              longFormJobId,
              segmentIndex: idx,
              title: seg.title,
              scriptText: seg.script || seg.description || '',
              startTime: timing.startTime,
              endTime: timing.endTime,
              visualType: 'PENDING',
              status: 'PENDING',
            },
          });
          segments.push(record);
        }
      }

      log.info({ segmentCount: segments.length }, 'Processing segments');

      processedSegments = await processSegments({
        segments,
        longFormJobId,
        prompt,
        style: job.data.style,
        aiClipRatio: job.data.aiClipRatio,
        useStockFootage: job.data.useStockFootage,
        useStaticVisuals: job.data.useStaticVisuals,
        aspectRatio: job.data.aspectRatio,
        onProgress: async (progress) => {
          const overallProgress = 40 + (progress / 100) * 35;
          await setProgress(Math.floor(overallProgress));
        },
      });
    }

    log.info({ processedCount: processedSegments.length }, 'Segments ready');
    await setProgress(75);

    // ------------------------------------------------------------------
    // Stage 5: Composition (75-88%)
    // ------------------------------------------------------------------
    log.info('Stage 5 — Composing final video');
    await updateStatus(longFormJobId, 'COMPOSING');

    const composedBuffer = await composeLongForm({
      segments: processedSegments,
      audioBuffer: audioBuffer!,
      script,
      aspectRatio: job.data.aspectRatio,
    });

    log.info({ composedSizeBytes: composedBuffer.length }, 'Video composed');
    await setProgress(88);

    // ------------------------------------------------------------------
    // Stage 6: Upload to Storage (88-95%)
    // ------------------------------------------------------------------
    log.info('Stage 6 — Uploading to storage');
    await updateStatus(longFormJobId, 'UPLOADING');

    const { url: outputUrl, thumbnailUrl } = await uploadToStorage({
      buffer: composedBuffer,
      userId,
      reelJobId: longFormJobId,
    });

    log.info({ outputUrl }, 'Uploaded to storage');
    await setProgress(95);

    // ------------------------------------------------------------------
    // Stage 7: Completion (95-100%)
    // ------------------------------------------------------------------
    const processingTimeMs = Date.now() - startTime;
    log.info('Stage 7 — Marking job as complete');

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

    // Credits are deducted at submission time via checkModuleCredits()
    // No worker-side deduction needed (prevents double-charging)

    // Cleanup audio cache
    try { await fs.unlink(audioCachePath); } catch { /* ignore */ }

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
    | 'PUBLISHING'
    | 'RECOMPOSING',
): Promise<void> {
  await prisma.longFormJob.update({
    where: { id: longFormJobId },
    data: { status },
  });
}

// ---------------------------------------------------------------------------
// Planning & Outline Generation (Multi-Provider with Fallback)
// ---------------------------------------------------------------------------

interface OutlineSegment {
  title: string;
  script?: string;
  description?: string;
  talkingPoints?: string[];
  durationSeconds: number;
  visualSuggestion?: string;
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

  const segmentCount = Math.ceil(opts.durationMinutes / 2);
  const segmentDuration = (opts.durationMinutes * 60) / segmentCount;

  const systemPrompt = `You are a long-form video content strategist. Generate a structured outline for a ${opts.durationMinutes}-minute video with ${segmentCount} segments (~${Math.floor(segmentDuration)}s each).

Return ONLY a JSON object with this structure:
{
  "segments": [
    { "title": "Introduction", "script": "brief script outline", "durationSeconds": 120 },
    { "title": "Main Point 1", "script": "brief script outline", "durationSeconds": 120 }
  ]
}`;

  const userMessage = `Create an outline for a video titled "${opts.title}" about: ${opts.prompt}`;

  const text = await callAIProvider(systemPrompt, userMessage, 4096);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in outline response');

  try {
    const outline = JSON.parse(jsonMatch[0]) as Outline;
    log.info({ segmentCount: outline.segments.length }, 'Outline generated');
    return outline;
  } catch (err) {
    log.error({ err, text }, 'Failed to parse outline JSON');
    throw new Error('Failed to parse outline JSON');
  }
}

// ---------------------------------------------------------------------------
// Long-Form Script Generation (Multi-Provider with Fallback)
// ---------------------------------------------------------------------------

async function generateLongFormScript(opts: {
  prompt: string;
  outline: Outline;
  language: string;
  durationMinutes: number;
}): Promise<string> {
  const log = logger.child({ service: 'long-form-script-generator' });

  const systemPrompt = `You are an expert long-form video scriptwriter. Expand the provided outline into a complete, engaging ${opts.durationMinutes}-minute script.

REQUIREMENTS:
- Language: ${opts.language}
- Write ONLY the spoken script — no stage directions, no timestamps
- Each segment should flow naturally into the next
- Include engaging hooks, clear explanations, and strong CTAs
- Target ~${opts.durationMinutes * 150} words total`;

  const userMessage = `Expand this outline into a full script:\n\n${JSON.stringify(opts.outline, null, 2)}`;

  const script = await callAIProvider(systemPrompt, userMessage, 8192);
  log.info({ scriptLength: script.length }, 'Long-form script generated');
  return script;
}

// ---------------------------------------------------------------------------
// Multi-Provider AI Helper (Gemini → Claude → OpenAI → Mock)
// ---------------------------------------------------------------------------

async function callAIProvider(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const log = logger.child({ service: 'ai-provider' });

  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  const preferredProvider = (process.env.AI_PROVIDER || '').trim().toLowerCase();

  type Provider = { name: string; run: () => Promise<string> };
  const providers: Provider[] = [];

  const claudeProvider: Provider = {
    name: 'anthropic',
    run: async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') throw new Error('No text from Claude');
      return textBlock.text.trim();
    },
  };

  const geminiProvider: Provider = {
    name: 'gemini',
    run: async () => {
      const apiKey = process.env.GEMINI_API_KEY!;
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
          }),
        }
      );
      if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
      const data = (await response.json()) as any;
      const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('\n').trim();
      if (!content) throw new Error('No content from Gemini');
      return content;
    },
  };

  const openaiProvider: Provider = {
    name: 'openai',
    run: async () => {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      const response = await client.chat.completions.create({
        model: 'gpt-4',
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No content from OpenAI');
      return content.trim();
    },
  };

  // Build provider order based on preference (default: Gemini first)
  if (preferredProvider === 'anthropic' && hasAnthropicKey) {
    providers.push(claudeProvider);
    if (hasGeminiKey) providers.push(geminiProvider);
    if (hasOpenAIKey) providers.push(openaiProvider);
  } else if (preferredProvider === 'openai' && hasOpenAIKey) {
    providers.push(openaiProvider);
    if (hasGeminiKey) providers.push(geminiProvider);
    if (hasAnthropicKey) providers.push(claudeProvider);
  } else {
    if (hasGeminiKey) providers.push(geminiProvider);
    if (hasAnthropicKey) providers.push(claudeProvider);
    if (hasOpenAIKey) providers.push(openaiProvider);
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      log.info({ provider: provider.name }, 'Trying AI provider');
      const result = await provider.run();
      log.info({ provider: provider.name }, 'AI provider succeeded');
      return result;
    } catch (err) {
      lastError = err;
      log.warn({ provider: provider.name, err }, 'AI provider failed, trying next');
    }
  }

  if (providers.length === 0) {
    log.warn('No AI API keys configured — using mock mode');
  } else {
    log.error({ lastError }, 'All AI providers failed — using mock mode');
  }

  return `This is a mock-generated script for: ${userMessage.substring(0, 200)}. Configure a valid ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY to enable real AI generation.`;
}
