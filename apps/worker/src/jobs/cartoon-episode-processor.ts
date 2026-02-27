import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';
import { generateCartoonStory } from '../services/cartoon-story-generator';
import { generateVoiceover } from '../services/voiceover-generator';
import { composeCartoonEpisode, type CartoonSceneInput } from '../services/cartoon-composer';
import { uploadToStorage } from '../services/storage';
import { generateHashtags } from '../services/hashtag-generator';
import fs from 'fs/promises';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CartoonEpisodeJobData {
  episodeId: string;
  seriesId: string;
  userId: string;
  prompt: string;
  title: string;
  language: string;
  aspectRatio: string;
  narratorVoiceId?: string;
  plan: string;
}

export interface CartoonEpisodeJobResult {
  outputUrl: string;
  thumbnailUrl?: string;
  processingTimeMs: number;
}

// Persistent audio cache
const AUDIO_CACHE_DIR = path.join(os.tmpdir(), 'reelforge-cartoon-audio');

// ---------------------------------------------------------------------------
// Helper: update episode status
// ---------------------------------------------------------------------------

type EpisodeStatus =
  | 'QUEUED'
  | 'STORY_GENERATING'
  | 'IMAGE_GENERATING'
  | 'VOICE_GENERATING'
  | 'COMPOSING'
  | 'UPLOADING'
  | 'COMPLETED'
  | 'FAILED';

async function updateStatus(episodeId: string, status: EpisodeStatus, stage?: string) {
  await prisma.cartoonEpisode.update({
    where: { id: episodeId },
    data: {
      status,
      currentStage: stage || status,
    },
  });
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processCartoonEpisode(
  job: Job<CartoonEpisodeJobData>,
): Promise<CartoonEpisodeJobResult> {
  const startTime = Date.now();
  const { episodeId, seriesId, userId } = job.data;
  const log = logger.child({ episodeId, seriesId, jobId: job.id });

  async function setProgress(percent: number) {
    await job.updateProgress(percent);
    await prisma.cartoonEpisode.update({
      where: { id: episodeId },
      data: { progress: percent },
    });
  }

  try {
    // Load series with characters
    const series = await prisma.cartoonSeries.findUniqueOrThrow({
      where: { id: seriesId },
      include: { characters: true },
    });

    // Load episode
    const episode = await prisma.cartoonEpisode.findUniqueOrThrow({
      where: { id: episodeId },
    });

    log.info({ title: episode.title, seriesName: series.name }, 'Starting cartoon episode processing');

    // ==================================================================
    // Stage 1: Story Generation (0-20%)
    // ==================================================================

    let scenes = await prisma.cartoonScene.findMany({
      where: { episodeId },
      orderBy: { sceneIndex: 'asc' },
    });

    if (scenes.length === 0) {
      await updateStatus(episodeId, 'STORY_GENERATING', 'Generating story');
      await setProgress(5);

      log.info('Stage 1: Generating story');

      const story = await generateCartoonStory({
        seriesName: series.name,
        seriesDescription: series.description,
        targetAudience: series.targetAudience,
        artStyle: series.artStyle,
        bannerUrl: series.bannerUrl,
        logoUrl: series.logoUrl,
        characters: series.characters.map((c) => ({
          name: c.name,
          description: c.description,
          personality: c.personality,
        })),
        episodePrompt: episode.prompt,
        language: series.language,
      });

      // Save story script
      await prisma.cartoonEpisode.update({
        where: { id: episodeId },
        data: { storyScript: story.fullScript },
      });

      // Create scene records
      const sceneData = story.scenes.map((s, i) => ({
        episodeId,
        sceneIndex: i,
        description: s.description,
        visualPrompt: s.visualPrompt,
        narration: s.narration,
        dialogue: s.dialogue as any,
        status: 'PENDING' as const,
      }));

      await prisma.cartoonScene.createMany({ data: sceneData });

      scenes = await prisma.cartoonScene.findMany({
        where: { episodeId },
        orderBy: { sceneIndex: 'asc' },
      });

      log.info({ sceneCount: scenes.length }, 'Story generated and scenes created');
    } else {
      log.info({ sceneCount: scenes.length }, 'Stage 1: Skipping — scenes already exist');
    }

    await setProgress(20);

    // ==================================================================
    // Stage 2: Image Generation — Placeholder (20-45%)
    // ==================================================================

    const pendingImageScenes = scenes.filter((s) => !s.imageUrl);

    if (pendingImageScenes.length > 0) {
      await updateStatus(episodeId, 'IMAGE_GENERATING', 'Generating scene images');

      log.info({ count: pendingImageScenes.length }, 'Stage 2: Generating scene images (placeholder)');

      // Generate placeholder images for each scene
      const imageDir = path.join(os.tmpdir(), `cartoon-images-${episodeId}`);
      mkdirSync(imageDir, { recursive: true });

      const res = job.data.aspectRatio === '9:16'
        ? { w: 1080, h: 1920 }
        : job.data.aspectRatio === '1:1'
          ? { w: 1080, h: 1080 }
          : { w: 1920, h: 1080 };

      for (const scene of pendingImageScenes) {
        const imagePath = path.join(imageDir, `scene-${scene.sceneIndex}.ppm`);
        generatePlaceholderPPM(imagePath, res.w, res.h, scene.sceneIndex);

        await prisma.cartoonScene.update({
          where: { id: scene.id },
          data: { imageUrl: imagePath, status: 'COMPLETED' },
        });

        const progress = 20 + Math.round((scene.sceneIndex / scenes.length) * 25);
        await setProgress(Math.min(progress, 44));
      }

      // Refresh scenes
      scenes = await prisma.cartoonScene.findMany({
        where: { episodeId },
        orderBy: { sceneIndex: 'asc' },
      });

      log.info('Placeholder images generated');
    } else {
      log.info('Stage 2: Skipping — images already exist');
    }

    await setProgress(45);

    // ==================================================================
    // Stage 3: Multi-Voice Audio Generation (45-70%)
    // ==================================================================

    const audioCachePath = path.join(AUDIO_CACHE_DIR, `${episodeId}.mp3`);
    mkdirSync(AUDIO_CACHE_DIR, { recursive: true });

    let audioBuffer: Buffer;

    if (existsSync(audioCachePath)) {
      log.info('Stage 3: Loading cached audio');
      audioBuffer = readFileSync(audioCachePath);
    } else {
      await updateStatus(episodeId, 'VOICE_GENERATING', 'Generating voices');
      log.info('Stage 3: Generating multi-voice audio');

      // Build a character voice map
      const charVoiceMap = new Map<string, string>();
      for (const char of series.characters) {
        if (char.voiceId) {
          charVoiceMap.set(char.name, char.voiceId);
        }
      }

      const defaultVoiceId = series.narratorVoiceId || 'EXAVITQu4vr4xnSDxMaL'; // "Sarah" default
      const audioSegments: Buffer[] = [];
      let currentTime = 0;

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const sceneAudioParts: Buffer[] = [];

        // Generate narration audio
        if (scene.narration) {
          const narrationAudio = await generateVoiceover({
            script: scene.narration,
            voiceId: defaultVoiceId,
            language: series.language,
          });
          sceneAudioParts.push(narrationAudio);
        }

        // Generate dialogue audio for each line
        const dialogue = scene.dialogue as { characterName: string; text: string }[] | null;
        if (dialogue && Array.isArray(dialogue)) {
          for (const line of dialogue) {
            const voiceId = charVoiceMap.get(line.characterName) || defaultVoiceId;
            const lineAudio = await generateVoiceover({
              script: line.text,
              voiceId,
              language: series.language,
            });
            sceneAudioParts.push(lineAudio);
          }
        }

        // Combine scene audio parts
        if (sceneAudioParts.length > 0) {
          const combined = Buffer.concat(sceneAudioParts);
          audioSegments.push(combined);

          // Estimate duration (rough: MP3 at ~16KB/sec for speech)
          const estimatedDuration = Math.max(5, combined.length / 16000);

          // Update scene timing
          await prisma.cartoonScene.update({
            where: { id: scene.id },
            data: {
              startTime: currentTime,
              endTime: currentTime + estimatedDuration,
            },
          });

          currentTime += estimatedDuration;
        } else {
          // No audio for this scene — give it a default 5 second duration
          await prisma.cartoonScene.update({
            where: { id: scene.id },
            data: { startTime: currentTime, endTime: currentTime + 5 },
          });
          currentTime += 5;
        }

        const progress = 45 + Math.round(((i + 1) / scenes.length) * 25);
        await setProgress(Math.min(progress, 69));
      }

      // Concatenate all audio segments
      audioBuffer = Buffer.concat(audioSegments);

      // Cache audio
      writeFileSync(audioCachePath, audioBuffer);

      // Update episode duration
      await prisma.cartoonEpisode.update({
        where: { id: episodeId },
        data: { durationSeconds: Math.round(currentTime) },
      });

      log.info({ durationSeconds: Math.round(currentTime), audioSize: audioBuffer.length }, 'Multi-voice audio generated');
    }

    await setProgress(70);

    // Refresh scenes with updated timing
    scenes = await prisma.cartoonScene.findMany({
      where: { episodeId },
      orderBy: { sceneIndex: 'asc' },
    });

    // ==================================================================
    // Stage 4: Composition (70-85%)
    // ==================================================================

    await updateStatus(episodeId, 'COMPOSING', 'Composing video');
    log.info('Stage 4: Composing cartoon video');

    const sceneInputs: CartoonSceneInput[] = scenes.map((s) => ({
      sceneIndex: s.sceneIndex,
      imageUrl: s.imageUrl || '',
      durationSeconds: Math.max(3, s.endTime - s.startTime),
      subtitleLines: buildSubtitleLines(s),
    }));

    const videoBuffer = await composeCartoonEpisode({
      scenes: sceneInputs,
      audioBuffer,
      aspectRatio: job.data.aspectRatio,
    });

    await setProgress(85);

    // ==================================================================
    // Stage 5: Upload (85-95%)
    // ==================================================================

    await updateStatus(episodeId, 'UPLOADING', 'Uploading video');
    log.info('Stage 5: Uploading');

    const { url: outputUrl, thumbnailUrl } = await uploadToStorage({
      buffer: videoBuffer,
      userId,
      reelJobId: episodeId,
    });

    await setProgress(95);

    // ==================================================================
    // Stage 6: Completion (95-100%)
    // ==================================================================

    const processingTimeMs = Date.now() - startTime;

    const hashtags = await generateHashtags({
      title: job.data.episodePrompt || 'Cartoon episode',
      module: 'cartoon',
    });

    await prisma.cartoonEpisode.update({
      where: { id: episodeId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        currentStage: 'COMPLETED',
        outputUrl,
        thumbnailUrl,
        processingTimeMs,
        hashtags,
      },
    });

    // Credits are deducted at submission time via checkModuleCredits()
    // No worker-side deduction needed (prevents double-charging)

    // Cleanup audio cache
    try { await fs.unlink(audioCachePath); } catch { /* ignore */ }

    log.info({ outputUrl, processingTimeMs }, 'Cartoon episode completed');

    return { outputUrl, thumbnailUrl: thumbnailUrl || undefined, processingTimeMs };
  } catch (err: any) {
    log.error({ err: err.message, stack: err.stack }, 'Cartoon episode processing failed');

    await prisma.cartoonEpisode.update({
      where: { id: episodeId },
      data: {
        status: 'FAILED',
        errorMessage: err.message || 'Unknown error',
        currentStage: 'FAILED',
      },
    });

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSubtitleLines(scene: any): { speaker: string; text: string; color?: string }[] {
  const lines: { speaker: string; text: string; color?: string }[] = [];
  if (scene.narration) {
    lines.push({ speaker: 'Narrator', text: scene.narration });
  }
  const dialogue = scene.dialogue as { characterName: string; text: string }[] | null;
  if (dialogue && Array.isArray(dialogue)) {
    for (const d of dialogue) {
      lines.push({ speaker: d.characterName, text: d.text });
    }
  }
  return lines;
}

function generatePlaceholderPPM(
  outputPath: string,
  width: number,
  height: number,
  sceneIndex: number,
): void {
  const colors = [
    [99, 102, 241],
    [168, 85, 247],
    [59, 130, 246],
    [16, 185, 129],
    [245, 158, 11],
    [239, 68, 68],
    [236, 72, 153],
    [6, 182, 212],
  ];
  const [r, g, b] = colors[sceneIndex % colors.length];

  const header = `P6\n${width} ${height}\n255\n`;
  const headerBuf = Buffer.from(header, 'ascii');
  const pixelCount = width * height;
  const pixelData = Buffer.alloc(pixelCount * 3);

  for (let i = 0; i < pixelCount; i++) {
    pixelData[i * 3] = r;
    pixelData[i * 3 + 1] = g;
    pixelData[i * 3 + 2] = b;
  }

  writeFileSync(outputPath, Buffer.concat([headerBuf, pixelData]));
}
