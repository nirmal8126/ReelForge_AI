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
 * 1. Download all segment videos to temp files
 * 2. Create concat file list for FFmpeg
 * 3. Concatenate segments with transitions
 * 4. Overlay full audio track
 * 5. Add captions (optional)
 * 6. Return final video buffer
 */
export async function composeLongForm(opts: ComposeLongFormOptions): Promise<Buffer> {
  const { segments, audioBuffer, script, aspectRatio } = opts;

  log.info({ segmentCount: segments.length, aspectRatio }, 'Starting long-form composition');

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'longform-'));
  const audioPath = path.join(tempDir, 'audio.mp3');
  const concatFilePath = path.join(tempDir, 'concat.txt');
  const outputPath = path.join(tempDir, 'output.mp4');

  try {
    // ------------------------------------------------------------------
    // Step 1: Save audio to temp file
    // ------------------------------------------------------------------
    await fs.writeFile(audioPath, audioBuffer);
    log.info({ audioPath }, 'Audio saved to temp file');

    // ------------------------------------------------------------------
    // Step 2: Download all segment videos
    // ------------------------------------------------------------------
    const segmentPaths: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentPath = path.join(tempDir, `segment-${i}.mp4`);

      if (segment.visualType === 'STATIC_IMAGE') {
        // Generate video from static image (5 seconds)
        await generateVideoFromImage(segment.assetUrl, segmentPath, 5);
      } else {
        // Download video file
        log.info({ segmentIndex: i, url: segment.assetUrl }, 'Downloading segment video');
        const response = await axios.get(segment.assetUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
        });
        await fs.writeFile(segmentPath, Buffer.from(response.data));
      }

      segmentPaths.push(segmentPath);
      log.info({ segmentIndex: i }, 'Segment video ready');
    }

    // ------------------------------------------------------------------
    // Step 3: Create FFmpeg concat file
    // ------------------------------------------------------------------
    const concatContent = segmentPaths.map((p) => `file '${p}'`).join('\n');
    await fs.writeFile(concatFilePath, concatContent);
    log.info({ concatFilePath }, 'Concat file created');

    // ------------------------------------------------------------------
    // Step 4: Concatenate segments + overlay audio
    // ------------------------------------------------------------------
    log.info('Concatenating segments with audio');

    const { width, height } = getResolution(aspectRatio);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        // Input: concatenated video segments
        .input(concatFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        // Input: audio track
        .input(audioPath)
        // Video codec: H.264 with good quality
        .videoCodec('libx264')
        .videoBitrate('4000k')
        .size(`${width}x${height}`)
        .fps(30)
        // Audio codec: AAC
        .audioCodec('aac')
        .audioBitrate('128k')
        // Use shortest stream (audio or video)
        .outputOptions([
          '-shortest',
          '-pix_fmt yuv420p',
          '-preset fast',
          '-movflags +faststart',
        ])
        // Output
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

    // ------------------------------------------------------------------
    // Step 5: Read final video
    // ------------------------------------------------------------------
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
 * Generate a video from a static image using FFmpeg.
 * Creates a simple video with the image displayed for the specified duration.
 */
async function generateVideoFromImage(
  imageUrl: string,
  outputPath: string,
  durationSeconds: number
): Promise<void> {
  const tempDir = path.dirname(outputPath);
  const imagePath = path.join(tempDir, `image-${Date.now()}.jpg`);

  try {
    // Download image
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    await fs.writeFile(imagePath, Buffer.from(response.data));

    // Generate video from image
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(imagePath)
        .inputOptions(['-loop 1', `-t ${durationSeconds}`])
        .videoCodec('libx264')
        .size('1920x1080')
        .fps(30)
        .outputOptions(['-pix_fmt yuv420p', '-preset fast'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  } finally {
    // Cleanup temp image
    try {
      await fs.unlink(imagePath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}
