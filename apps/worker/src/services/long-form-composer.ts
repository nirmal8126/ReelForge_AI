import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { logger } from '../utils/logger';
import { ProcessedSegment } from './segment-processor';

const log = logger.child({ service: 'long-form-composer' });

export interface ComposeLongFormOptions {
  segments: ProcessedSegment[];
  audioBuffer: Buffer;
  script: string;
  aspectRatio: string;
}

/**
 * Compose long-form video from segments using FFmpeg.
 *
 * Process:
 * 1. Download/generate all segment videos to temp files
 * 2. Ensure all segments are proper video files with matching resolution
 * 3. Concatenate segments
 * 4. Overlay full audio track
 * 5. Return final video buffer
 */
export async function composeLongForm(opts: ComposeLongFormOptions): Promise<Buffer> {
  const { segments, audioBuffer, script, aspectRatio } = opts;

  log.info({ segmentCount: segments.length, aspectRatio }, 'Starting long-form composition');

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'longform-'));
  const audioPath = path.join(tempDir, 'audio.mp3');
  const concatFilePath = path.join(tempDir, 'concat.txt');
  const outputPath = path.join(tempDir, 'output.mp4');
  const { width, height } = getResolution(aspectRatio);

  try {
    // Step 1: Save audio to temp file
    await fs.writeFile(audioPath, audioBuffer);
    log.info({ audioPath }, 'Audio saved to temp file');

    // Step 2: Prepare all segment videos
    const segmentPaths: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentPath = path.join(tempDir, `segment-${i}.mp4`);
      const segmentDuration = Math.max(5, Math.ceil(segment.endTime - segment.startTime));

      if (segment.visualType === 'STATIC_IMAGE') {
        // Generate video from static image for the segment's duration
        log.info({ segmentIndex: i, duration: segmentDuration }, 'Generating video from static image');
        await generateVideoFromImage(segment.assetUrl, segmentPath, segmentDuration, width, height);
      } else if (segment.assetUrl.startsWith('file://')) {
        // Local file from demo storage
        const localPath = segment.assetUrl.replace('file://', '');
        // Re-encode to ensure compatible format + correct resolution
        await reencodeVideo(localPath, segmentPath, segmentDuration, width, height);
      } else if (segment.assetUrl.startsWith('http')) {
        // Download remote video and re-encode to ensure compatible format
        log.info({ segmentIndex: i, url: segment.assetUrl }, 'Downloading segment video');
        const downloadPath = path.join(tempDir, `download-${i}.mp4`);
        const response = await axios.get(segment.assetUrl, {
          responseType: 'arraybuffer',
          timeout: 120_000, // 2 min for large files
        });
        await fs.writeFile(downloadPath, Buffer.from(response.data));
        await reencodeVideo(downloadPath, segmentPath, segmentDuration, width, height);
      } else {
        // Unknown source, create a blank video
        log.warn({ segmentIndex: i, assetUrl: segment.assetUrl }, 'Unknown asset source, creating blank');
        await generateBlankVideo(segmentPath, segmentDuration, width, height);
      }

      segmentPaths.push(segmentPath);
      log.info({ segmentIndex: i }, 'Segment video ready');
    }

    // Step 3: Create FFmpeg concat file
    const concatContent = segmentPaths.map((p) => `file '${p}'`).join('\n');
    await fs.writeFile(concatFilePath, concatContent);
    log.info('Concat file created');

    // Step 4: Concatenate segments + overlay audio
    log.info('Concatenating segments with audio');

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        .input(audioPath)
        .videoCodec('libx264')
        .videoBitrate('4000k')
        .size(`${width}x${height}`)
        .fps(30)
        .audioCodec('aac')
        .audioBitrate('128k')
        .outputOptions([
          '-shortest',
          '-pix_fmt yuv420p',
          '-preset fast',
          '-movflags +faststart',
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          log.info({ cmd }, 'FFmpeg command started');
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            log.debug({ percent: progress.percent.toFixed(1) }, 'FFmpeg progress');
          }
        })
        .on('end', () => {
          log.info('FFmpeg composition completed');
          resolve();
        })
        .on('error', (err) => {
          log.error({ err }, 'FFmpeg composition failed');
          reject(err);
        })
        .run();
    });

    // Step 5: Read final video
    const outputBuffer = await fs.readFile(outputPath);
    log.info({ outputSizeBytes: outputBuffer.length }, 'Long-form video composed');

    return outputBuffer;
  } catch (error) {
    log.error({ err: error }, 'Long-form composition failed');
    throw error;
  } finally {
    // Cleanup temp files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      log.info({ tempDir }, 'Temp files cleaned up');
    } catch (cleanupError) {
      log.warn({ err: cleanupError }, 'Failed to cleanup temp files');
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getResolution(aspectRatio: string): { width: number; height: number } {
  const ratios: Record<string, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
  };

  return ratios[aspectRatio] || ratios['16:9'];
}

/**
 * Re-encode a video to ensure consistent format, resolution, and codec.
 * Also loops the video if it's shorter than the target duration.
 */
async function reencodeVideo(
  inputPath: string,
  outputPath: string,
  durationSeconds: number,
  width: number,
  height: number
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .inputOptions(['-stream_loop -1']) // Loop if shorter than duration
      .duration(durationSeconds)
      .videoCodec('libx264')
      .size(`${width}x${height}`)
      .fps(30)
      .outputOptions([
        '-pix_fmt yuv420p',
        '-preset fast',
        '-an', // Remove original audio (we overlay our own)
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Generate a video from a remote image URL or fallback to solid color.
 */
async function generateVideoFromImage(
  imageUrl: string,
  outputPath: string,
  durationSeconds: number,
  width: number,
  height: number
): Promise<void> {
  const tempDir = path.dirname(outputPath);
  const imagePath = path.join(tempDir, `image-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);

  // Try downloading the image first
  let imageDownloaded = false;
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15_000,
      maxRedirects: 5,
    });
    const data = Buffer.from(response.data);
    // Only consider it valid if we got actual image data (> 100 bytes)
    if (data.length > 100) {
      await fs.writeFile(imagePath, data);
      imageDownloaded = true;
    }
  } catch (err) {
    log.warn({ imageUrl, err }, 'Failed to download image, using color fallback');
  }

  if (imageDownloaded) {
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(imagePath)
          .inputOptions(['-loop 1'])
          .duration(durationSeconds)
          .videoCodec('libx264')
          .size(`${width}x${height}`)
          .fps(30)
          .outputOptions(['-pix_fmt yuv420p', '-preset fast', '-an'])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });
      return;
    } catch (ffmpegErr) {
      log.warn({ ffmpegErr }, 'FFmpeg image-to-video failed, using color fallback');
    } finally {
      try { await fs.unlink(imagePath); } catch { /* ignore */ }
    }
  }

  // Fallback: generate a solid color video
  await generateBlankVideo(outputPath, durationSeconds, width, height);
}

/**
 * Generate a blank colored video for missing segments.
 * Creates a solid-color PPM image, then loops it into a video.
 * PPM is a trivial format that needs no libraries and works with any FFmpeg build.
 */
async function generateBlankVideo(
  outputPath: string,
  durationSeconds: number,
  width: number,
  height: number
): Promise<void> {
  const tempDir = path.dirname(outputPath);
  const ppmPath = path.join(tempDir, `blank-${Date.now()}.ppm`);

  // Create a solid-color PPM image (RGB: 99, 102, 241 = #6366F1 indigo)
  const header = `P6\n${width} ${height}\n255\n`;
  const pixelCount = width * height;
  const pixelData = Buffer.alloc(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    pixelData[i * 3] = 99;      // R
    pixelData[i * 3 + 1] = 102;  // G
    pixelData[i * 3 + 2] = 241;  // B
  }
  await fs.writeFile(ppmPath, Buffer.concat([Buffer.from(header), pixelData]));

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(ppmPath)
        .inputOptions(['-loop 1'])
        .duration(durationSeconds)
        .videoCodec('libx264')
        .size(`${width}x${height}`)
        .fps(30)
        .outputOptions(['-pix_fmt yuv420p', '-preset fast', '-an'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  } finally {
    try { await fs.unlink(ppmPath); } catch { /* ignore */ }
  }
}
