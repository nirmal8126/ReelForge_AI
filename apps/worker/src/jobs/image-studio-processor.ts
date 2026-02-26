import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';
import { generateVoiceover } from '../services/voiceover-generator';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface ImageStudioJobData {
  imageStudioJobId: string;
  userId: string;
  mode: string;
  imageUrls: string[];
  prompt?: string;
  title?: string;
  language?: string;
  voiceEnabled: boolean;
  voiceId?: string;
  aspectRatio: string;
  transitionStyle: string;
}

export interface ImageStudioJobResult {
  outputUrl: string;
  thumbnailUrl?: string;
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Language names
// ---------------------------------------------------------------------------

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German',
    it: 'Italian', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean',
    zh: 'Chinese', ar: 'Arabic', hi: 'Hindi', pl: 'Polish',
    pa: 'Punjabi', ur: 'Urdu', bn: 'Bengali',
  };
  return names[code] || 'English';
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processImageStudioJob(job: Job<ImageStudioJobData>): Promise<ImageStudioJobResult> {
  const startTime = Date.now();
  const { imageStudioJobId, userId, mode, imageUrls } = job.data;
  const log = logger.child({ imageStudioJobId, jobId: job.id });

  const tmpDir = path.join(os.tmpdir(), 'reelforge-image-studio', userId, imageStudioJobId);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    if (mode === 'enhance') {
      return await processEnhanceMode(job, log, tmpDir);
    }
    return await processVideoMode(job, log, tmpDir);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ err: error, elapsedMs: elapsed }, 'Image studio job failed');

    await prisma.imageStudioJob.update({
      where: { id: imageStudioJobId },
      data: {
        status: 'FAILED',
        errorMessage,
        processingTimeMs: elapsed,
      },
    });

    throw error;
  } finally {
    // Clean up temp dir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Video mode — narrated slideshow pipeline
// ---------------------------------------------------------------------------

async function processVideoMode(
  job: Job<ImageStudioJobData>,
  log: typeof logger,
  tmpDir: string,
): Promise<ImageStudioJobResult> {
  const startTime = Date.now();
  const { imageStudioJobId, userId, imageUrls, language, voiceEnabled } = job.data;

  // Stage 1: Analyze images
  log.info('Stage 1/6 — Analyzing images');
  await updateStatus(imageStudioJobId, 'ANALYZING');
  await job.updateProgress(5);

  const imageDescriptions = await analyzeImages(imageUrls, tmpDir, log);
  await job.updateProgress(10);

  // Stage 2: Generate narration script
  log.info('Stage 2/6 — Generating narration script');
  await updateStatus(imageStudioJobId, 'SCRIPT_GENERATING');

  const script = await generateNarrationScript(
    imageDescriptions,
    job.data.prompt || '',
    language || 'hi',
    imageUrls.length,
    log,
  );

  await prisma.imageStudioJob.update({
    where: { id: imageStudioJobId },
    data: { script },
  });

  log.info({ scriptLength: script.length }, 'Narration script generated');
  await job.updateProgress(25);

  // Stage 3: Generate voiceover (if enabled)
  let audioPath: string | null = null;
  if (voiceEnabled) {
    log.info('Stage 3/6 — Generating voiceover');
    await updateStatus(imageStudioJobId, 'VOICE_GENERATING');

    const audioBuffer = await generateVoiceover({
      script,
      voiceId: job.data.voiceId || 'EXAVITQu4vr4xnSDxMaL',
      language: language || 'hi',
    });

    audioPath = path.join(tmpDir, 'narration.mp3');
    fs.writeFileSync(audioPath, audioBuffer);
    log.info({ audioSizeBytes: audioBuffer.length }, 'Voiceover generated');
  } else {
    log.info('Stage 3/6 — Skipping voiceover (not enabled)');
    await updateStatus(imageStudioJobId, 'VOICE_GENERATING');
  }
  await job.updateProgress(45);

  // Stage 4: Compose slideshow with FFmpeg
  log.info('Stage 4/6 — Composing slideshow');
  await updateStatus(imageStudioJobId, 'COMPOSING');

  const localImages = await downloadImages(imageUrls, tmpDir, log);
  const outputPath = path.join(tmpDir, 'output.mp4');

  await composeSlideshow({
    imagePaths: localImages,
    audioPath,
    outputPath,
    aspectRatio: job.data.aspectRatio,
    transitionStyle: job.data.transitionStyle,
    log,
  });

  log.info('Slideshow composed');
  await job.updateProgress(80);

  // Stage 5: Upload to storage
  log.info('Stage 5/6 — Uploading to storage');
  await updateStatus(imageStudioJobId, 'UPLOADING');

  const videoBuffer = fs.readFileSync(outputPath);
  const { url: outputUrl, thumbnailUrl } = await uploadToImageStudioStorage({
    buffer: videoBuffer,
    userId,
    jobId: imageStudioJobId,
    isVideo: true,
  });

  log.info({ outputUrl }, 'Uploaded to storage');
  await job.updateProgress(95);

  // Stage 6: Mark complete
  const processingTimeMs = Date.now() - startTime;
  log.info('Stage 6/6 — Marking job as complete');

  await prisma.imageStudioJob.update({
    where: { id: imageStudioJobId },
    data: {
      status: 'COMPLETED',
      outputUrl,
      thumbnailUrl,
      processingTimeMs,
      completedAt: new Date(),
    },
  });

  await job.updateProgress(100);
  log.info({ processingTimeMs, outputUrl }, 'Image studio job completed');

  return { outputUrl, thumbnailUrl: thumbnailUrl ?? undefined, processingTimeMs };
}

// ---------------------------------------------------------------------------
// Enhance mode — simple image enhancement
// ---------------------------------------------------------------------------

async function processEnhanceMode(
  job: Job<ImageStudioJobData>,
  log: typeof logger,
  tmpDir: string,
): Promise<ImageStudioJobResult> {
  const startTime = Date.now();
  const { imageStudioJobId, userId, imageUrls } = job.data;

  // Stage 1: Analyze
  log.info('Stage 1/3 — Analyzing image for enhancement');
  await updateStatus(imageStudioJobId, 'ANALYZING');
  await job.updateProgress(10);

  // Stage 2: Enhance with FFmpeg (sharpen, auto-levels)
  log.info('Stage 2/3 — Enhancing image');
  await updateStatus(imageStudioJobId, 'COMPOSING');

  const localImages = await downloadImages(imageUrls, tmpDir, log);
  const outputPath = path.join(tmpDir, 'enhanced.jpg');

  // Apply enhancement filters via FFmpeg
  const filters = 'eq=contrast=1.1:brightness=0.05:saturation=1.2,unsharp=5:5:1.0:5:5:0.5';
  execSync(
    `ffmpeg -i "${localImages[0]}" -vf "${filters}" -q:v 2 "${outputPath}" -y`,
    { timeout: 30000 }
  );

  await job.updateProgress(60);

  // Stage 3: Upload + complete
  log.info('Stage 3/3 — Uploading enhanced image');
  await updateStatus(imageStudioJobId, 'UPLOADING');

  const buffer = fs.readFileSync(outputPath);
  const { url: outputUrl, thumbnailUrl } = await uploadToImageStudioStorage({
    buffer,
    userId,
    jobId: imageStudioJobId,
    isVideo: false,
  });

  const processingTimeMs = Date.now() - startTime;

  await prisma.imageStudioJob.update({
    where: { id: imageStudioJobId },
    data: {
      status: 'COMPLETED',
      outputUrl,
      thumbnailUrl,
      processingTimeMs,
      completedAt: new Date(),
    },
  });

  await job.updateProgress(100);
  log.info({ processingTimeMs, outputUrl }, 'Image enhance job completed');

  return { outputUrl, thumbnailUrl: thumbnailUrl ?? undefined, processingTimeMs };
}

// ---------------------------------------------------------------------------
// Image analysis with Gemini Vision
// ---------------------------------------------------------------------------

async function analyzeImages(
  imageUrls: string[],
  tmpDir: string,
  log: typeof logger,
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || process.env.DEV_MODE === 'true') {
    log.info('DEV_MODE or no GEMINI_API_KEY: Using placeholder descriptions');
    return imageUrls.map((_, i) => `Image ${i + 1}: A visually striking scene with rich colors and interesting composition.`);
  }

  const descriptions: string[] = [];
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      // Download image to get base64
      const imgPath = path.join(tmpDir, `analyze_${i}.jpg`);
      await downloadFile(imageUrls[i], imgPath);
      const imgBuffer = fs.readFileSync(imgPath);
      const base64 = imgBuffer.toString('base64');
      const mimeType = imageUrls[i].endsWith('.png') ? 'image/png' : 'image/jpeg';

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: 'Describe this image in 2-3 sentences. Focus on the mood, subject, colors, and setting. Be concise and vivid.' },
              ],
            }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 200 },
          }),
        },
      );

      if (response.ok) {
        const data = await response.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        descriptions.push(text || `Image ${i + 1}: A scene with visual appeal.`);
      } else {
        descriptions.push(`Image ${i + 1}: A scene with visual appeal.`);
      }
    } catch (err) {
      log.warn({ err, index: i }, 'Failed to analyze image, using fallback');
      descriptions.push(`Image ${i + 1}: A scene with visual appeal.`);
    }
  }

  return descriptions;
}

// ---------------------------------------------------------------------------
// Narration script generation
// ---------------------------------------------------------------------------

async function generateNarrationScript(
  imageDescriptions: string[],
  userPrompt: string,
  language: string,
  imageCount: number,
  log: typeof logger,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const languageName = getLanguageName(language);

  if (!apiKey || process.env.DEV_MODE === 'true') {
    log.info('DEV_MODE or no GEMINI_API_KEY: Using placeholder narration');
    return imageDescriptions.map((d, i) => `Slide ${i + 1}: ${d}`).join('\n\n');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const durationPerImage = 5;
  const wordsPerImage = durationPerImage * 2.5;

  const prompt = `You are a professional video narrator. Create a narration script in ${languageName} for a slideshow video with ${imageCount} images.

Each image will be shown for about ${durationPerImage} seconds. Write approximately ${Math.round(wordsPerImage)} words per image slide.

${userPrompt ? `Context from the creator: ${userPrompt}\n` : ''}
Image descriptions:
${imageDescriptions.map((d, i) => `Image ${i + 1}: ${d}`).join('\n')}

Write a cohesive, engaging narration that flows between the images. Output ONLY the narration text, separated by double newlines for each slide. Do not include any stage directions or labels.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!content) throw new Error('No content in Gemini response');
    return content;
  } catch (err) {
    log.warn({ err }, 'Gemini narration failed, using fallback');
    return imageDescriptions.map((d, i) => `Slide ${i + 1}: ${d}`).join('\n\n');
  }
}

// ---------------------------------------------------------------------------
// Download images to local filesystem
// ---------------------------------------------------------------------------

async function downloadImages(
  imageUrls: string[],
  tmpDir: string,
  log: typeof logger,
): Promise<string[]> {
  const paths: string[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const ext = imageUrls[i].endsWith('.png') ? 'png' : 'jpg';
    const localPath = path.join(tmpDir, `image_${i}.${ext}`);
    await downloadFile(imageUrls[i], localPath);
    paths.push(localPath);
    log.info({ index: i, path: localPath }, 'Downloaded image');
  }

  return paths;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  if (url.startsWith('file://')) {
    const filePath = url.replace('file://', '');
    fs.copyFileSync(filePath, destPath);
    return;
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.status} ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

// ---------------------------------------------------------------------------
// FFmpeg slideshow composition
// ---------------------------------------------------------------------------

interface ComposeSlideshowOptions {
  imagePaths: string[];
  audioPath: string | null;
  outputPath: string;
  aspectRatio: string;
  transitionStyle: string;
  log: typeof logger;
}

async function composeSlideshow(opts: ComposeSlideshowOptions): Promise<void> {
  const { imagePaths, audioPath, outputPath, aspectRatio, log } = opts;
  const durationPerImage = 5;

  // Determine output dimensions
  const dims = aspectRatio === '16:9' ? '1920:1080'
    : aspectRatio === '1:1' ? '1080:1080'
    : '1080:1920'; // 9:16

  const [width, height] = dims.split(':');

  // Build concat file for FFmpeg
  const concatPath = path.join(path.dirname(outputPath), 'concat.txt');
  const concatLines = imagePaths.map(
    (p) => `file '${p}'\nduration ${durationPerImage}`
  ).join('\n');
  // Repeat last image (FFmpeg concat requirement)
  const fullConcat = concatLines + `\nfile '${imagePaths[imagePaths.length - 1]}'`;
  fs.writeFileSync(concatPath, fullConcat);

  // Ken Burns effect: scale up slightly and pan
  const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
  const zoompanFilter = `zoompan=z='min(zoom+0.001,1.15)':d=${durationPerImage * 25}:s=${width}x${height}:fps=25`;

  // Build FFmpeg command
  let cmd: string;

  if (imagePaths.length === 1) {
    // Single image — zoompan effect
    cmd = `ffmpeg -loop 1 -i "${imagePaths[0]}" -vf "${scaleFilter},${zoompanFilter}" -t ${durationPerImage}`;
  } else {
    // Multiple images — concat with crossfade
    cmd = `ffmpeg -f concat -safe 0 -i "${concatPath}" -vf "${scaleFilter}"`;
  }

  // Add audio if present
  if (audioPath) {
    cmd += ` -i "${audioPath}" -c:a aac -b:a 192k -shortest`;
  }

  cmd += ` -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart "${outputPath}" -y`;

  log.info({ cmd: cmd.substring(0, 200) }, 'Running FFmpeg compose');
  execSync(cmd, { timeout: 120000 });
}

// ---------------------------------------------------------------------------
// Storage upload
// ---------------------------------------------------------------------------

async function uploadToImageStudioStorage(opts: {
  buffer: Buffer;
  userId: string;
  jobId: string;
  isVideo: boolean;
}): Promise<{ url: string; thumbnailUrl: string | null }> {
  const { buffer, userId, jobId, isVideo } = opts;
  const ext = isVideo ? 'mp4' : 'jpg';
  const contentType = isVideo ? 'video/mp4' : 'image/jpeg';

  const hasR2 = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;

  if (!hasR2) {
    // Local fallback
    const outputDir = path.join('/tmp', 'reelforge-image-studio', userId);
    fs.mkdirSync(outputDir, { recursive: true });
    const filePath = path.join(outputDir, `${jobId}.${ext}`);
    fs.writeFileSync(filePath, buffer);
    return { url: `file://${filePath}`, thumbnailUrl: null };
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const bucket = process.env.R2_BUCKET_NAME || 'reelforge-media';
  const cdnUrl = process.env.CDN_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.dev`;
  const key = `image-studio/${userId}/${jobId}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return {
    url: `${cdnUrl}/${key}`,
    thumbnailUrl: null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ImageStudioStatus = 'ANALYZING' | 'SCRIPT_GENERATING' | 'VOICE_GENERATING' | 'COMPOSING' | 'UPLOADING';

async function updateStatus(jobId: string, status: ImageStudioStatus): Promise<void> {
  await prisma.imageStudioJob.update({
    where: { id: jobId },
    data: { status },
  });
}
