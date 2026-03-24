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
// Ken Burns motion presets — each defines zoom + pan behavior
// ---------------------------------------------------------------------------

interface KenBurnsPreset {
  zoomStart: number;
  zoomEnd: number;
  // Pan expressions: 'center', 'left-to-right', 'right-to-left', 'top-to-bottom', 'bottom-to-top'
  panDirection: 'center' | 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top';
}

const KENBURNS_PRESETS: KenBurnsPreset[] = [
  { zoomStart: 1.0,  zoomEnd: 1.25, panDirection: 'left-to-right' },   // Slow zoom in + pan right
  { zoomStart: 1.25, zoomEnd: 1.0,  panDirection: 'right-to-left' },   // Slow zoom out + pan left
  { zoomStart: 1.0,  zoomEnd: 1.3,  panDirection: 'center' },          // Zoom into center
  { zoomStart: 1.3,  zoomEnd: 1.0,  panDirection: 'center' },          // Zoom out from center
  { zoomStart: 1.0,  zoomEnd: 1.2,  panDirection: 'top-to-bottom' },   // Zoom in + pan down
  { zoomStart: 1.2,  zoomEnd: 1.0,  panDirection: 'bottom-to-top' },   // Zoom out + pan up
];

function getKenBurnsExpressions(preset: KenBurnsPreset, totalFrames: number) {
  const zoomExpr = `${preset.zoomStart}+(${preset.zoomEnd}-${preset.zoomStart})*on/${totalFrames}`;

  let xExpr: string;
  let yExpr: string;

  switch (preset.panDirection) {
    case 'left-to-right':
      // Pan from left edge to right edge
      xExpr = `(iw/zoom-iw/zoom*0.7)*(on/${totalFrames})`;
      yExpr = `ih/2-(ih/zoom/2)`;
      break;
    case 'right-to-left':
      // Pan from right edge to left edge
      xExpr = `(iw/zoom-iw/zoom*0.7)*(1-on/${totalFrames})`;
      yExpr = `ih/2-(ih/zoom/2)`;
      break;
    case 'top-to-bottom':
      xExpr = `iw/2-(iw/zoom/2)`;
      yExpr = `(ih/zoom-ih/zoom*0.7)*(on/${totalFrames})`;
      break;
    case 'bottom-to-top':
      xExpr = `iw/2-(iw/zoom/2)`;
      yExpr = `(ih/zoom-ih/zoom*0.7)*(1-on/${totalFrames})`;
      break;
    case 'center':
    default:
      xExpr = `iw/2-(iw/zoom/2)`;
      yExpr = `ih/2-(ih/zoom/2)`;
      break;
  }

  return { zoomExpr, xExpr, yExpr };
}

// ---------------------------------------------------------------------------
// xfade transition types
// ---------------------------------------------------------------------------

const XFADE_TRANSITIONS = [
  'fade',
  'fadeblack',
  'slideright',
  'slideleft',
  'slideup',
  'slidedown',
  'circlecrop',
  'dissolve',
  'smoothleft',
  'smoothright',
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compose multiple images into a video with Ken Burns (zoom/pan) effects
 * and xfade transitions using FFmpeg.
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
  const transitionDuration = 0.8; // xfade overlap duration
  // Account for xfade overlaps in per-image duration calculation
  const totalTransitionTime = Math.max(0, (imageCount - 1)) * transitionDuration;
  const perImageDuration = Math.max(3, Math.ceil((durationSeconds + totalTransitionTime) / imageCount));
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
      transitionDuration,
      width,
      height,
      transitionStyle,
    }, 'Composing images into video with enhanced Ken Burns');

    // Build FFmpeg command with Ken Burns + xfade
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
// FFmpeg composition with xfade transitions
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
  const { width, height, perImageDuration, totalDuration, transitionDuration } = config;
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

    // Step 1: Scale + crop each image, add Ken Burns zoompan with varied motion
    for (let i = 0; i < imageCount; i++) {
      const preset = KENBURNS_PRESETS[i % KENBURNS_PRESETS.length];
      const { zoomExpr, xExpr, yExpr } = getKenBurnsExpressions(preset, totalFrames);

      filters.push(
        `[${i}:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,` +
        `crop=${width * 2}:${height * 2},` +
        `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${width}x${height}:fps=${fps},` +
        `setpts=PTS-STARTPTS,format=yuv420p[v${i}]`
      );
    }

    // Step 2: Chain xfade transitions between clips
    if (imageCount === 1) {
      filters.push(`[v0]trim=duration=${totalDuration},setpts=PTS-STARTPTS[outv]`);
    } else if (imageCount === 2) {
      // Simple xfade between two clips
      const xfadeType = XFADE_TRANSITIONS[0];
      const offset = perImageDuration - transitionDuration;
      filters.push(
        `[v0][v1]xfade=transition=${xfadeType}:duration=${transitionDuration}:offset=${offset},` +
        `trim=duration=${totalDuration},setpts=PTS-STARTPTS[outv]`
      );
    } else {
      // Chain xfade: v0+v1 → tmp0, tmp0+v2 → tmp1, ..., tmpN → outv
      let prevLabel = 'v0';
      for (let i = 1; i < imageCount; i++) {
        const xfadeType = XFADE_TRANSITIONS[i % XFADE_TRANSITIONS.length];
        // Offset = duration of accumulated output so far minus transition overlap
        const accumulatedDuration = perImageDuration + (i - 1) * (perImageDuration - transitionDuration);
        const offset = accumulatedDuration - transitionDuration;
        const outLabel = i === imageCount - 1 ? 'outv' : `xf${i}`;

        if (i === imageCount - 1) {
          filters.push(
            `[${prevLabel}][v${i}]xfade=transition=${xfadeType}:duration=${transitionDuration}:offset=${offset},` +
            `trim=duration=${totalDuration},setpts=PTS-STARTPTS[${outLabel}]`
          );
        } else {
          filters.push(
            `[${prevLabel}][v${i}]xfade=transition=${xfadeType}:duration=${transitionDuration}:offset=${offset}[${outLabel}]`
          );
        }
        prevLabel = outLabel;
      }
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
