import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';
import { generateCartoonStory } from '../services/cartoon-story-generator';
import { generateSceneImages } from '../services/image-generator';
import { generateVoiceover } from '../services/voiceover-generator';
import { composeCartoonEpisode, type CartoonSceneInput } from '../services/cartoon-composer';
import { uploadToStorage, uploadSceneImage } from '../services/storage';
import { generateHashtags } from '../services/hashtag-generator';
import { getActiveProviders } from '../services/service-config';
import fsPromises from 'fs/promises';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
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

      // Generate a proper episode title from the story content
      const storyTitle = deriveEpisodeTitleFromStory(story.scenes, episode.episodeNumber);

      // Save story script and update title
      await prisma.cartoonEpisode.update({
        where: { id: episodeId },
        data: {
          storyScript: story.fullScript,
          title: storyTitle,
        },
      });

      log.info({ storyTitle }, 'Episode title derived from story');

      // Create scene records
      const sceneData = story.scenes.map((s, i) => ({
        episodeId,
        sceneIndex: i,
        description: s.description,
        visualPrompt: s.visualPrompt,
        visualPrompts: (s.visualPrompts && s.visualPrompts.length > 0 ? s.visualPrompts : [s.visualPrompt]) as any,
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
    // Stage 2: Image Generation via Gemini AI (20-45%)
    // ==================================================================

    const pendingImageScenes = scenes.filter((s) => !s.imageUrl);

    if (pendingImageScenes.length > 0) {
      await updateStatus(episodeId, 'IMAGE_GENERATING', 'Generating scene images');

      log.info({ count: pendingImageScenes.length }, 'Stage 2: Generating scene images via Gemini AI');

      const imageDir = path.join(os.tmpdir(), `cartoon-images-${episodeId}`);
      mkdirSync(imageDir, { recursive: true });

      const artStyle = series.artStyle || 'cartoon';

      // Build character appearance context for image prompts
      const characterContext = series.characters
        .map((c) => `${c.name}: ${c.description || 'cartoon character'}`)
        .join('. ');
      const seriesContext = `${artStyle} style, series "${series.name}"${series.description ? ` — ${series.description}` : ''}. Characters: ${characterContext}`;

      // Count total images across all scenes for progress tracking
      let totalImages = 0;
      let generatedImages = 0;
      for (const scene of pendingImageScenes) {
        const prompts = (scene.visualPrompts as string[] | null) || [scene.visualPrompt || scene.description || 'cartoon scene'];
        totalImages += prompts.length;
      }

      for (const scene of pendingImageScenes) {
        // Get all visual prompts for this scene (2-3 per scene)
        const prompts = (scene.visualPrompts as string[] | null) || [scene.visualPrompt || scene.description || 'cartoon scene'];
        const sceneImageUrls: string[] = [];

        for (let imgIdx = 0; imgIdx < prompts.length; imgIdx++) {
          const imagePath = path.join(imageDir, `scene-${scene.sceneIndex}-${imgIdx}.png`);

          // Delay between API calls to avoid Gemini rate limits (skip first overall)
          if (generatedImages > 0) {
            await new Promise(r => setTimeout(r, 3000));
          }

          let imageBuffer: Buffer;
          try {
            const basePrompt = prompts[imgIdx];
            const enrichedPrompt = `${basePrompt}. ${seriesContext}. High quality, consistent character design, vibrant colors.`;

            const [generated] = await generateSceneImages({
              prompt: enrichedPrompt,
              style: artStyle,
              count: 1,
              aspectRatio: job.data.aspectRatio,
            });
            imageBuffer = generated;
            log.info({ sceneIndex: scene.sceneIndex, imgIdx, total: prompts.length }, 'AI image generated');
          } catch (imgErr) {
            log.warn({ sceneIndex: scene.sceneIndex, imgIdx, err: imgErr instanceof Error ? imgErr.message : imgErr }, 'Gemini image failed, using placeholder');
            const res = job.data.aspectRatio === '9:16'
              ? { w: 1080, h: 1920 }
              : job.data.aspectRatio === '1:1'
                ? { w: 1080, h: 1080 }
                : { w: 1920, h: 1080 };
            generatePlaceholderPNG(imagePath, res.w, res.h, scene.sceneIndex + imgIdx);
            imageBuffer = readFileSync(imagePath);
          }

          // Save locally for FFmpeg composer
          await fsPromises.writeFile(imagePath, imageBuffer);

          // Upload to storage
          let sceneImageUrl = imagePath;
          try {
            sceneImageUrl = await uploadSceneImage({
              buffer: imageBuffer,
              userId,
              episodeId,
              sceneIndex: scene.sceneIndex * 10 + imgIdx, // unique index per sub-image
            });
          } catch (uploadErr) {
            log.warn({ sceneIndex: scene.sceneIndex, imgIdx, err: uploadErr instanceof Error ? uploadErr.message : uploadErr }, 'Scene image upload failed, using local path');
          }

          sceneImageUrls.push(sceneImageUrl);
          generatedImages++;

          const progress = 20 + Math.round((generatedImages / totalImages) * 25);
          await setProgress(Math.min(progress, 44));
        }

        // Update scene: first image as primary imageUrl, all images in imageUrls JSON
        await prisma.cartoonScene.update({
          where: { id: scene.id },
          data: {
            imageUrl: sceneImageUrls[0],
            imageUrls: sceneImageUrls as any,
            status: 'COMPLETED',
          },
        });
      }

      // Refresh scenes
      scenes = await prisma.cartoonScene.findMany({
        where: { episodeId },
        orderBy: { sceneIndex: 'asc' },
      });

      log.info({ totalImages: generatedImages }, 'Scene images generated');
    } else {
      log.info('Stage 2: Skipping — images already exist');
    }

    await setProgress(45);

    // ==================================================================
    // Stage 2B: AI Video Generation per scene (optional, 45-55%)
    // If a premium AI video provider (RunwayML, Veo) is enabled by admin,
    // generate short AI video clips from scene prompts instead of Ken Burns.
    // ==================================================================

    const videoProviders = await getActiveProviders('video');
    const premiumVideoProviders = videoProviders.filter(
      (p) => p.id === 'runway' || p.id === 'veo',
    );
    const useAIVideo = premiumVideoProviders.length > 0 && process.env.NODE_ENV !== 'development';
    const sceneVideoClips: Record<number, string> = {}; // sceneIndex → local video path

    if (useAIVideo) {
      await updateStatus(episodeId, 'IMAGE_GENERATING', 'Generating AI video clips');
      log.info(
        { provider: premiumVideoProviders[0].id, sceneCount: scenes.length },
        'Stage 2B: Generating AI video clips for scenes',
      );

      const videoDir = path.join(os.tmpdir(), `cartoon-videos-${episodeId}`);
      mkdirSync(videoDir, { recursive: true });

      // Only generate video for content scenes (skip CTA / last scene)
      const contentScenes = scenes.slice(0, -1);
      let videoGenerated = 0;

      for (const scene of contentScenes) {
        try {
          const visualPrompt =
            (scene.visualPrompts as string[] | null)?.[0] ||
            scene.visualPrompt ||
            scene.description ||
            '';

          const { generateVideo } = await import('../services/video-generator');
          const videoBuffer = await generateVideo({
            prompt: `${series.artStyle || 'cartoon'} animation style: ${visualPrompt}`,
            style: series.artStyle || 'cartoon',
            durationSeconds: 5,
            aspectRatio: job.data.aspectRatio,
            plan: job.data.plan,
          });

          const clipPath = path.join(videoDir, `scene-${scene.sceneIndex}.mp4`);
          await fsPromises.writeFile(clipPath, videoBuffer);
          sceneVideoClips[scene.sceneIndex] = clipPath;
          videoGenerated++;

          log.info({ sceneIndex: scene.sceneIndex }, 'AI video clip generated for scene');
        } catch (videoErr) {
          log.warn(
            { sceneIndex: scene.sceneIndex, err: videoErr instanceof Error ? videoErr.message : videoErr },
            'AI video generation failed for scene, will use Ken Burns fallback',
          );
        }

        const progress = 45 + Math.round((videoGenerated / contentScenes.length) * 10);
        await setProgress(Math.min(progress, 54));
      }

      log.info({ videoGenerated, total: contentScenes.length }, 'AI video generation complete');
    } else {
      log.info(
        { availableProviders: videoProviders.map((p) => p.id) },
        'Stage 2B: Skipping AI video — no premium video provider enabled',
      );
    }

    await setProgress(55);

    // ==================================================================
    // Stage 3: Multi-Voice Audio Generation (55-75%)
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
      const audioTmpDir = path.join(os.tmpdir(), `cartoon-audio-${episodeId}`);
      mkdirSync(audioTmpDir, { recursive: true });
      const audioPartFiles: string[] = [];
      let audioPartIndex = 0;
      let currentTime = 0;

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const scenePartFiles: string[] = [];

        // Generate narration audio
        if (scene.narration) {
          const narrationAudio = await generateVoiceover({
            script: scene.narration,
            voiceId: defaultVoiceId,
            language: series.language,
          });
          const partPath = path.join(audioTmpDir, `part-${audioPartIndex++}.mp3`);
          writeFileSync(partPath, narrationAudio);
          scenePartFiles.push(partPath);
          log.info({ sceneIndex: i, partSize: narrationAudio.length, type: 'narration' }, 'Audio part generated');
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
            const partPath = path.join(audioTmpDir, `part-${audioPartIndex++}.mp3`);
            writeFileSync(partPath, lineAudio);
            scenePartFiles.push(partPath);
            log.info({ sceneIndex: i, partSize: lineAudio.length, type: 'dialogue', character: line.characterName }, 'Audio part generated');
          }
        }

        // Track scene audio parts and estimate duration using FFmpeg probe
        if (scenePartFiles.length > 0) {
          audioPartFiles.push(...scenePartFiles);

          // Get actual duration of scene audio parts via ffprobe
          let sceneDuration = 0;
          for (const partFile of scenePartFiles) {
            try {
              const probeOutput = execSync(
                `ffprobe -v error -show_entries format=duration -of csv=p=0 "${partFile}"`,
                { timeout: 10_000, stdio: 'pipe', maxBuffer: 1024 * 1024 },
              ).toString().trim();
              sceneDuration += parseFloat(probeOutput) || 5;
            } catch {
              // Fallback: estimate from file size (~16KB/sec for speech MP3)
              const fileSize = readFileSync(partFile).length;
              sceneDuration += Math.max(3, fileSize / 16000);
            }
          }

          await prisma.cartoonScene.update({
            where: { id: scene.id },
            data: {
              startTime: currentTime,
              endTime: currentTime + sceneDuration,
            },
          });

          currentTime += sceneDuration;
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

      // Concatenate all audio parts using FFmpeg (proper MP3 merging)
      if (audioPartFiles.length > 0) {
        const concatListPath = path.join(audioTmpDir, 'concat.txt');
        const concatContent = audioPartFiles.map((f) => `file '${f}'`).join('\n');
        writeFileSync(concatListPath, concatContent);

        const mergedPath = path.join(audioTmpDir, 'merged.mp3');
        execSync(
          `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c:a libmp3lame -b:a 128k "${mergedPath}"`,
          { timeout: 120_000, stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 },
        );
        audioBuffer = readFileSync(mergedPath);
        log.info({ partCount: audioPartFiles.length, mergedSize: audioBuffer.length }, 'Audio parts merged via FFmpeg');
      } else {
        audioBuffer = Buffer.alloc(0);
        log.warn('No audio parts generated for any scene');
      }

      // Cache audio
      writeFileSync(audioCachePath, audioBuffer);

      // Cleanup audio temp dir
      try { require('fs').rmSync(audioTmpDir, { recursive: true, force: true }); } catch { /* ignore */ }

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

    // Use local image paths for FFmpeg composition (not CDN URLs)
    const imageDir = path.join(os.tmpdir(), `cartoon-images-${episodeId}`);
    const sceneInputs: CartoonSceneInput[] = scenes.map((s) => {
      // Collect all image paths for this scene
      const imageUrls = (s.imageUrls as string[] | null) || [];
      const imagePaths: string[] = [];

      if (imageUrls.length > 0) {
        // Multi-image scene: find local files for each
        for (let imgIdx = 0; imgIdx < imageUrls.length; imgIdx++) {
          const localPath = path.join(imageDir, `scene-${s.sceneIndex}-${imgIdx}.png`);
          if (existsSync(localPath)) {
            imagePaths.push(localPath);
          } else if (imageUrls[imgIdx] && !imageUrls[imgIdx].startsWith('http')) {
            // Might be a local path already
            if (existsSync(imageUrls[imgIdx])) imagePaths.push(imageUrls[imgIdx]);
          }
        }
      }

      // Fallback to single image if multi-image paths not found
      if (imagePaths.length === 0) {
        const localPath = path.join(imageDir, `scene-${s.sceneIndex}.png`);
        const localPath0 = path.join(imageDir, `scene-${s.sceneIndex}-0.png`);
        if (existsSync(localPath0)) {
          imagePaths.push(localPath0);
        } else if (existsSync(localPath)) {
          imagePaths.push(localPath);
        } else if (s.imageUrl) {
          imagePaths.push(s.imageUrl);
        }
      }

      return {
        sceneIndex: s.sceneIndex,
        imageUrl: imagePaths[0] || s.imageUrl || '',
        imageUrls: imagePaths,
        videoClipPath: sceneVideoClips[s.sceneIndex] || undefined,
        durationSeconds: Math.max(3, s.endTime - s.startTime),
        subtitleLines: buildSubtitleLines(s),
      };
    });

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
      title: job.data.prompt || 'Cartoon episode',
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
    try { await fsPromises.unlink(audioCachePath); } catch { /* ignore */ }

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

/**
 * Derive a proper episode title from the generated story scenes.
 * Uses the first scene's description as the episode title since it captures
 * the story's opening/theme, rather than the raw scheduler topic.
 */
function deriveEpisodeTitleFromStory(
  scenes: { description: string; narration: string }[],
  episodeNumber: number,
): string {
  // Use first scene description as the title base
  let titleBase = scenes[0]?.description || '';

  // If description is too short, try narration
  if (titleBase.length < 5 && scenes[0]?.narration) {
    titleBase = scenes[0].narration;
  }

  // Clean up: take first sentence, trim
  titleBase = titleBase.split(/[.!?\n]/)[0].trim();

  // Strip any existing episode prefix like "Ep 1:", "Ep. 1:", "Episode 1:" etc.
  titleBase = titleBase.replace(/^(Ep\.?\s*\d+\s*[:\-–—]\s*)/i, '').trim();
  titleBase = titleBase.replace(/^(Episode\s*\d+\s*[:\-–—]\s*)/i, '').trim();

  // Capitalize first letter
  if (titleBase.length > 0) {
    titleBase = titleBase.charAt(0).toUpperCase() + titleBase.slice(1);
  }

  // Truncate to fit YouTube's 100-char limit (leave room for "Ep N: " prefix)
  const maxLen = 90;
  if (titleBase.length > maxLen) {
    titleBase = titleBase.slice(0, maxLen - 3).replace(/\s+\S*$/, '') + '...';
  }

  return titleBase ? `Ep ${episodeNumber}: ${titleBase}` : `Episode ${episodeNumber}`;
}

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

function generatePlaceholderPNG(
  outputPath: string,
  width: number,
  height: number,
  sceneIndex: number,
): void {
  const colors = [
    '6366F1', 'A855F7', '3B82F6', '10B981',
    'F59E0B', 'EF4444', 'EC4899', '06B6D4',
  ];
  const color = colors[sceneIndex % colors.length];

  try {
    const { execSync } = require('child_process');
    execSync(
      `ffmpeg -y -f lavfi -i "color=c=0x${color}:s=${width}x${height}:d=1" -frames:v 1 "${outputPath}"`,
      { timeout: 10_000, stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 },
    );
  } catch {
    // Fallback: tiny 1x1 PPM
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    writeFileSync(outputPath, Buffer.concat([Buffer.from(`P6\n1 1\n255\n`, 'ascii'), Buffer.from([r, g, b])]));
  }
}
