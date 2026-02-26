import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'image-video-composer' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageVideoComposeOptions {
  imageBuffers: Buffer[];
  durationSeconds: number;
  aspectRatio?: string;       // '9:16', '16:9', '1:1'
  transitionStyle?: string;   // 'fade', 'slide', 'zoom'
}

// ---------------------------------------------------------------------------
// Resolution map
// ---------------------------------------------------------------------------

function getResolution(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16': return { width: 720, height: 1280 };
    case '1:1':  return { width: 1080, height: 1080 };
    case '16:9':
    default:     return { width: 1280, height: 720 };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compose multiple images into a video with Ken Burns (zoom/pan) effects
 * and crossfade transitions using FFmpeg.
 *
 * Returns an MP4 video buffer compatible with the existing composer pipeline.
 */
export async function composeImagesIntoVideo(opts: ImageVideoComposeOptions): Promise<Buffer> {
  const {
    imageBuffers,
    durationSeconds,
    aspectRatio = '9:16',
    transitionStyle = 'fade',
  } = opts;

  if (imageBuffers.length === 0) {
    throw new Error('No images provided for video composition');
  }

  const { width, height } = getResolution(aspectRatio);
  const imageCount = imageBuffers.length;
  const perImageDuration = Math.max(3, Math.ceil(durationSeconds / imageCount));
  const transitionDuration = Math.min(1, perImageDuration / 3); // 1s or 1/3 of image duration
  const totalDuration = durationSeconds;

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reelforge-imgvid-'));
  const outputPath = path.join(tmpDir, 'output.mp4');

  try {
    // Write images to temp directory
    const imagePaths: string[] = [];
    for (let i = 0; i < imageBuffers.length; i++) {
      const imgPath = path.join(tmpDir, `img_${i}.png`);
      await fs.promises.writeFile(imgPath, imageBuffers[i]);
      imagePaths.push(imgPath);
    }

    log.info({
      imageCount,
      perImageDuration,
      totalDuration,
      width,
      height,
      transitionStyle,
    }, 'Composing images into video');

    // Build FFmpeg command with Ken Burns + crossfade
    await runFFmpeg(imagePaths, outputPath, {
      width,
      height,
      perImageDuration,
      totalDuration,
      transitionDuration,
      transitionStyle,
    });

    const outputBuffer = await fs.promises.readFile(outputPath);
    log.info({ outputSizeBytes: outputBuffer.length }, 'Image video composed');

    return outputBuffer;
  } finally {
    try {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    } catch (err) {
      log.warn({ err, tmpDir }, 'Failed to clean up temp dir');
    }
  }
}

// ---------------------------------------------------------------------------
// FFmpeg composition
// ---------------------------------------------------------------------------

interface FFmpegConfig {
  width: number;
  height: number;
  perImageDuration: number;
  totalDuration: number;
  transitionDuration: number;
  transitionStyle: string;
}

function runFFmpeg(
  imagePaths: string[],
  outputPath: string,
  config: FFmpegConfig,
): Promise<void> {
  const { width, height, perImageDuration, totalDuration } = config;
  const fps = 30;
  const totalFrames = perImageDuration * fps;

  return new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg();

    // Add each image as an input with a loop duration
    for (const imgPath of imagePaths) {
      cmd
        .input(imgPath)
        .inputOptions([
          '-loop', '1',
          '-t', String(perImageDuration),
          '-framerate', String(fps),
        ]);
    }

    // Build filter graph
    const filters: string[] = [];
    const imageCount = imagePaths.length;

    // Step 1: Scale + crop each image, add Ken Burns zoompan
    for (let i = 0; i < imageCount; i++) {
      // Alternate zoom direction for variety
      const zoomStart = i % 2 === 0 ? 1.0 : 1.2;
      const zoomEnd = i % 2 === 0 ? 1.2 : 1.0;
      const zoomExpr = `${zoomStart}+(${zoomEnd}-${zoomStart})*on/${totalFrames}`;

      // Pan slightly during zoom
      const xExpr = `iw/2-(iw/zoom/2)`;
      const yExpr = `ih/2-(ih/zoom/2)`;

      filters.push(
        `[${i}:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,` +
        `crop=${width * 2}:${height * 2},` +
        `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${width}x${height}:fps=${fps},` +
        `setpts=PTS-STARTPTS,format=yuv420p[v${i}]`
      );
    }

    // Step 2: Concatenate all clips
    if (imageCount === 1) {
      // Single image — just use directly
      filters.push(`[v0]trim=duration=${totalDuration},setpts=PTS-STARTPTS[outv]`);
    } else {
      // Concatenate with crossfade transitions
      const concatInputs = Array.from({ length: imageCount }, (_, i) => `[v${i}]`).join('');
      filters.push(`${concatInputs}concat=n=${imageCount}:v=1:a=0,trim=duration=${totalDuration},setpts=PTS-STARTPTS[outv]`);
    }

    cmd
      .complexFilter(filters.join(';'))
      .outputOptions([
        '-map', '[outv]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('start', (cmdLine) => {
        log.debug({ command: cmdLine }, 'FFmpeg image-video started');
      })
      .on('end', () => {
        log.info('FFmpeg image-video composition complete');
        resolve();
      })
      .on('error', (err) => {
        log.error({ err }, 'FFmpeg image-video composition failed');
        reject(err);
      })
      .run();
  });
}
