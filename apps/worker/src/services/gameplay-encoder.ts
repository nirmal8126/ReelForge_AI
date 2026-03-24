import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

const log = logger.child({ service: 'gameplay-encoder' });

// ---------------------------------------------------------------------------
// Encode PNG sequence → MP4
// ---------------------------------------------------------------------------

export interface EncodeOptions {
  framesDir: string;
  fps: number;
  outputPath: string;
  musicPath?: string;   // optional background music file
}

export async function encodeGameplay(options: EncodeOptions): Promise<Buffer> {
  const { framesDir, fps, outputPath, musicPath } = options;

  log.info({ framesDir, fps, outputPath, musicPath: !!musicPath }, 'Starting FFmpeg encoding');

  const args: string[] = [
    '-y',                              // overwrite output
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'frame_%05d.png'),
  ];

  // Add music if available
  if (musicPath && fs.existsSync(musicPath)) {
    args.push('-i', musicPath);
    args.push('-shortest');            // end when shortest stream ends
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',         // web-optimized
  );

  // Audio codec if music provided
  if (musicPath && fs.existsSync(musicPath)) {
    args.push('-c:a', 'aac', '-b:a', '128k');
  } else {
    args.push('-an');                    // no audio
  }

  args.push(outputPath);

  try {
    const { stdout, stderr } = await execFileAsync('ffmpeg', args, {
      maxBuffer: 50 * 1024 * 1024,     // 50 MB buffer
      timeout: 300_000,                 // 5 minute timeout
    });

    if (stderr) {
      log.debug({ stderr: stderr.substring(0, 500) }, 'FFmpeg stderr output');
    }

    // Read the output file
    const videoBuffer = fs.readFileSync(outputPath);
    log.info({ outputSize: videoBuffer.length, outputPath }, 'FFmpeg encoding complete');

    return videoBuffer;
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    log.error({ err: error.message, stderr: error.stderr?.substring(0, 500) }, 'FFmpeg encoding failed');
    throw new Error(`FFmpeg encoding failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Generate thumbnail from first frame
// ---------------------------------------------------------------------------

export async function generateThumbnail(framesDir: string, outputPath: string): Promise<Buffer> {
  // Use the frame at ~2 seconds (frame 60) for a more interesting thumbnail
  const thumbnailFrame = path.join(framesDir, 'frame_00060.png');
  const fallbackFrame = path.join(framesDir, 'frame_00000.png');
  const sourceFrame = fs.existsSync(thumbnailFrame) ? thumbnailFrame : fallbackFrame;

  if (!fs.existsSync(sourceFrame)) {
    throw new Error('No frames available for thumbnail generation');
  }

  // Resize to thumbnail size
  const args = [
    '-y',
    '-i', sourceFrame,
    '-vf', 'scale=480:-1',
    '-q:v', '3',
    outputPath,
  ];

  try {
    await execFileAsync('ffmpeg', args, { timeout: 30_000 });
    const buffer = fs.readFileSync(outputPath);
    log.info({ size: buffer.length }, 'Thumbnail generated');
    return buffer;
  } catch (err) {
    log.warn({ err }, 'Thumbnail generation failed, using source frame');
    return fs.readFileSync(sourceFrame);
  }
}
