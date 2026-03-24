import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'scene-clip-composer' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneClip {
  downloadUrl: string;
  durationSeconds: number;
  actualDuration: number;
  keyword: string;
  isFallbackImage?: boolean;
  imageBuffer?: Buffer;
}

export interface ConcatenateOptions {
  clips: SceneClip[];
  totalDurationSeconds: number;
  aspectRatio?: string;
  crossfadeDurationSeconds?: number; // default 0.5
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function getResolution(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16': return { width: 1080, height: 1920 };
    case '1:1':  return { width: 1080, height: 1080 };
    case '16:9':
    default:     return { width: 1920, height: 1080 };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Download, trim, normalize, and concatenate multiple scene clips
 * with crossfade transitions using FFmpeg.
 *
 * Supports mixed inputs: Pexels video clips + fallback Gemini images.
 * Returns a silent MP4 buffer (audio is overlaid later by composer.ts).
 */
export async function concatenateClipsWithCrossfade(opts: ConcatenateOptions): Promise<Buffer> {
  const {
    clips,
    totalDurationSeconds,
    aspectRatio = '9:16',
    crossfadeDurationSeconds = 0.5,
  } = opts;

  if (clips.length === 0) {
    throw new Error('No clips provided for concatenation');
  }

  const { width, height } = getResolution(aspectRatio);
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reelforge-scenes-'));

  try {
    // Step 1: Download and prepare each clip as a normalized segment
    const segmentPaths: string[] = [];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const segmentPath = path.join(tmpDir, `segment-${i}.mp4`);

      if (clip.isFallbackImage && clip.imageBuffer) {
        log.info({ scene: i + 1, keyword: clip.keyword }, 'Creating video from fallback image');
        await createVideoFromImage(clip.imageBuffer, segmentPath, clip.durationSeconds, width, height);
      } else {
        log.info({ scene: i + 1, keyword: clip.keyword, url: clip.downloadUrl.substring(0, 80) }, 'Downloading and trimming clip');
        const downloadPath = path.join(tmpDir, `download-${i}.mp4`);
        await downloadClip(clip.downloadUrl, downloadPath);
        await trimAndNormalize(downloadPath, segmentPath, clip.durationSeconds, width, height);
      }

      segmentPaths.push(segmentPath);
    }

    // Step 2: Concatenate with crossfade transitions
    const outputPath = path.join(tmpDir, 'output.mp4');

    if (segmentPaths.length === 1) {
      // Single clip — just copy it
      await fs.promises.copyFile(segmentPaths[0], outputPath);
    } else {
      await xfadeConcatenate(
        segmentPaths,
        outputPath,
        clips.map(c => c.durationSeconds),
        crossfadeDurationSeconds,
        width,
        height,
      );
    }

    const outputBuffer = await fs.promises.readFile(outputPath);
    log.info({ outputSizeBytes: outputBuffer.length, clipCount: clips.length }, 'Scene clips concatenated');

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
// Download a clip from URL
// ---------------------------------------------------------------------------

async function downloadClip(url: string, outputPath: string): Promise<void> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60_000,
  });
  await fs.promises.writeFile(outputPath, Buffer.from(response.data));
  log.debug({ outputPath, sizeBytes: response.data.byteLength }, 'Clip downloaded');
}

// ---------------------------------------------------------------------------
// Trim and normalize a clip to exact duration + resolution
// ---------------------------------------------------------------------------

async function trimAndNormalize(
  inputPath: string,
  outputPath: string,
  durationSeconds: number,
  width: number,
  height: number,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .inputOptions(['-stream_loop', '-1']) // loop if clip shorter than target
      .duration(durationSeconds)
      .complexFilter([
        `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,` +
        `setsar=1,fps=30,format=yuv420p[outv]`,
      ])
      .outputOptions([
        '-map', '[outv]',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-an',
      ])
      .output(outputPath)
      .on('end', () => {
        log.debug({ outputPath, durationSeconds }, 'Clip trimmed and normalized');
        resolve();
      })
      .on('error', (err) => {
        log.error({ err, inputPath }, 'Failed to trim/normalize clip');
        reject(err);
      })
      .run();
  });
}

// ---------------------------------------------------------------------------
// Create video from a static image (fallback for scenes with no stock footage)
// ---------------------------------------------------------------------------

async function createVideoFromImage(
  imageBuffer: Buffer,
  outputPath: string,
  durationSeconds: number,
  width: number,
  height: number,
): Promise<void> {
  const tmpDir = path.dirname(outputPath);
  const imgPath = path.join(tmpDir, `fallback-img-${Date.now()}.png`);
  await fs.promises.writeFile(imgPath, imageBuffer);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(imgPath)
        .inputOptions(['-loop', '1'])
        .duration(durationSeconds)
        .complexFilter([
          `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,` +
          `setsar=1,fps=30,format=yuv420p[outv]`,
        ])
        .outputOptions([
          '-map', '[outv]',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-an',
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  } finally {
    try { await fs.promises.unlink(imgPath); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// FFmpeg xfade concatenation — crossfade transitions between clips
// ---------------------------------------------------------------------------

async function xfadeConcatenate(
  segmentPaths: string[],
  outputPath: string,
  durations: number[],
  crossfadeDuration: number,
  width: number,
  height: number,
): Promise<void> {
  const n = segmentPaths.length;

  return new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg();

    // Add all segment inputs
    for (const segPath of segmentPaths) {
      cmd.input(segPath);
    }

    // Build xfade filter chain (pairwise)
    const filters: string[] = [];
    let cumulativeDuration = durations[0];
    let prevLabel = '0:v';

    for (let i = 1; i < n; i++) {
      const offset = Math.max(0, cumulativeDuration - crossfadeDuration);
      const outLabel = i === n - 1 ? 'outv' : `xf${i}`;

      filters.push(
        `[${prevLabel}][${i}:v]xfade=transition=fade:duration=${crossfadeDuration}:offset=${offset}[${outLabel}]`
      );

      cumulativeDuration = offset + durations[i];
      prevLabel = outLabel;
    }

    cmd
      .complexFilter(filters.join(';'))
      .outputOptions([
        '-map', '[outv]',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-an',
      ])
      .output(outputPath)
      .on('start', (cmdLine) => {
        log.debug({ command: cmdLine }, 'FFmpeg xfade started');
      })
      .on('end', () => {
        log.info({ clipCount: n }, 'FFmpeg xfade concatenation complete');
        resolve();
      })
      .on('error', (err) => {
        log.error({ err }, 'FFmpeg xfade concatenation failed');
        reject(err);
      })
      .run();
  });
}
