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
  bgMusicPath?: string | null;
  bgMusicVolume?: number; // 0-100, default 15
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
  const { videoBuffer, audioBuffer, bgMusicPath, bgMusicVolume = 15 } = opts;

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reelforge-'));
  const videoPath = path.join(tmpDir, 'input.mp4');
  const audioPath = path.join(tmpDir, 'audio.mp3');
  const outputPath = path.join(tmpDir, 'output.mp4');
  const hasBgMusic = bgMusicPath && fs.existsSync(bgMusicPath);

  try {
    // -------------------------------------------------------------------
    // Write input files to temp directory
    // -------------------------------------------------------------------
    log.info(
      { tmpDir, videoSize: videoBuffer.length, audioSize: audioBuffer.length },
      'Writing temp files for composition',
    );

    await Promise.all([
      fs.promises.writeFile(videoPath, videoBuffer),
      fs.promises.writeFile(audioPath, audioBuffer),
    ]);

    // Verify audio file is valid MP3 via ffprobe
    try {
      const { execSync } = require('child_process');
      const probeOut = execSync(
        `ffprobe -v error -show_entries format=duration,format_name -of json "${audioPath}"`,
        { timeout: 10_000, stdio: 'pipe' },
      ).toString();
      log.info({ audioProbe: JSON.parse(probeOut).format }, 'Audio file probe');
    } catch (probeErr: any) {
      log.warn({ err: probeErr.message }, 'Audio probe failed — file may be invalid');
    }

    // -------------------------------------------------------------------
    // Run FFmpeg
    // -------------------------------------------------------------------
    log.info('Running FFmpeg composition');

    // Build FFmpeg command — optionally mix background music with voiceover
    const musicVol = Math.max(0, Math.min(100, bgMusicVolume)) / 100; // normalize to 0.0-1.0

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg()
        .input(videoPath)
        .inputOptions(['-stream_loop', '-1']) // loop video to match audio length
        .input(audioPath);

      const outputOpts: string[] = [
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-threads', '1',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
        '-movflags', '+faststart',
      ];

      if (hasBgMusic) {
        // Add background music as third input and mix with voiceover
        cmd.input(bgMusicPath!);
        outputOpts.push(
          '-filter_complex', `[1:a]volume=1.0[vo];[2:a]volume=${musicVol.toFixed(2)}[bgm];[vo][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
          '-map', '0:v:0',
          '-map', '[aout]',
        );
        log.info({ bgMusicPath, musicVol }, 'Mixing background music with voiceover');
      } else {
        outputOpts.push('-map', '0:v:0', '-map', '1:a:0');
      }

      cmd
        .outputOptions(outputOpts)
        .output(outputPath)
        .on('start', (c) => { log.debug({ command: c }, 'FFmpeg started'); })
        .on('progress', (progress) => { log.debug({ percent: progress.percent }, 'FFmpeg progress'); })
        .on('end', () => { log.info('FFmpeg composition complete'); resolve(); })
        .on('error', (err) => { log.error({ err }, 'FFmpeg composition failed'); reject(err); })
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

