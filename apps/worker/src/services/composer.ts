import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'composer' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComposeOptions {
  videoBuffer: Buffer;
  audioBuffer: Buffer;
  script: string;
  captionStyle: string;
  primaryColor: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compose a final reel by combining video, audio, and burned-in captions
 * using FFmpeg.
 *
 * Creates a temp directory, writes input files, runs FFmpeg, reads the
 * output, and cleans up.
 */
export async function composeReel(opts: ComposeOptions): Promise<Buffer> {
  const { videoBuffer, audioBuffer, script, captionStyle, primaryColor } = opts;

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reelforge-'));
  const videoPath = path.join(tmpDir, 'input.mp4');
  const audioPath = path.join(tmpDir, 'audio.mp3');
  const subtitlePath = path.join(tmpDir, 'captions.srt');
  const outputPath = path.join(tmpDir, 'output.mp4');

  try {
    // -------------------------------------------------------------------
    // Write input files to temp directory
    // -------------------------------------------------------------------
    log.info({ tmpDir }, 'Writing temp files for composition');

    await Promise.all([
      fs.promises.writeFile(videoPath, videoBuffer),
      fs.promises.writeFile(audioPath, audioBuffer),
      fs.promises.writeFile(subtitlePath, generateSRT(script)),
    ]);

    // -------------------------------------------------------------------
    // Build FFmpeg filter for caption styling
    // -------------------------------------------------------------------
    const assColor = hexToASS(primaryColor);
    const fontSize = captionStyle === 'large' ? 28 : captionStyle === 'small' ? 16 : 22;
    const subtitleFilter =
      `subtitles=${subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')}` +
      `:force_style='FontSize=${fontSize},FontName=Arial,Bold=1,` +
      `PrimaryColour=${assColor},OutlineColour=&H80000000,` +
      `BorderStyle=4,Outline=1,Shadow=0,MarginV=60,Alignment=2'`;

    // -------------------------------------------------------------------
    // Run FFmpeg
    // -------------------------------------------------------------------
    log.info('Running FFmpeg composition');

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .inputOptions(['-stream_loop', '-1']) // loop video to match audio length
        .input(audioPath)
        .outputOptions([
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',           // stops when audio ends (video loops until then)
          '-movflags', '+faststart',
          '-vf', subtitleFilter,
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          log.debug({ command: cmd }, 'FFmpeg started');
        })
        .on('progress', (progress) => {
          log.debug({ percent: progress.percent }, 'FFmpeg progress');
        })
        .on('end', () => {
          log.info('FFmpeg composition complete');
          resolve();
        })
        .on('error', (err) => {
          log.error({ err }, 'FFmpeg composition failed');
          reject(err);
        })
        .run();
    });

    // -------------------------------------------------------------------
    // Read output
    // -------------------------------------------------------------------
    const outputBuffer = await fs.promises.readFile(outputPath);
    log.info({ outputSizeBytes: outputBuffer.length }, 'Composed reel ready');

    return outputBuffer;
  } finally {
    // -------------------------------------------------------------------
    // Cleanup temp files
    // -------------------------------------------------------------------
    log.debug({ tmpDir }, 'Cleaning up temp directory');
    try {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      log.warn({ err: cleanupErr, tmpDir }, 'Failed to clean up temp directory');
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: Generate SRT subtitle file from script
// ---------------------------------------------------------------------------

/**
 * Splits a script into timed subtitle segments (~6 words each).
 * Assumes roughly 2.5 words per second.
 */
function generateSRT(script: string): string {
  const words = script.split(/\s+/).filter(Boolean);
  const wordsPerSegment = 6;
  const secondsPerWord = 1 / 2.5; // 0.4s per word
  const segments: string[] = [];

  let segmentIndex = 1;
  let currentTime = 0;

  for (let i = 0; i < words.length; i += wordsPerSegment) {
    const segmentWords = words.slice(i, i + wordsPerSegment);
    const segmentDuration = segmentWords.length * secondsPerWord;

    const startTime = currentTime;
    const endTime = currentTime + segmentDuration;

    segments.push(
      [
        String(segmentIndex),
        `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}`,
        segmentWords.join(' '),
        '',
      ].join('\n'),
    );

    currentTime = endTime;
    segmentIndex++;
  }

  return segments.join('\n');
}

// ---------------------------------------------------------------------------
// Helper: Format seconds to SRT timestamp (HH:MM:SS,mmm)
// ---------------------------------------------------------------------------

function formatSRTTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds % 1) * 1000);

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0') +
    ',' +
    String(milliseconds).padStart(3, '0')
  );
}

// ---------------------------------------------------------------------------
// Helper: Convert hex colour (#RRGGBB) to ASS colour (&HBBGGRR&)
// ---------------------------------------------------------------------------

function hexToASS(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) {
    return '&H00FFFFFF'; // default white
  }

  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);

  // ASS uses &HAABBGGRR format (AA = alpha, 00 = fully opaque)
  return `&H00${b}${g}${r}`.toUpperCase();
}
