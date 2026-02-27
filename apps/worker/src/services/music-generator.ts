import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'music-generator' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MusicOptions {
  musicStyle: string;       // 'upbeat' | 'chill' | 'intense' | 'none'
  durationSeconds: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a background music file for gameplay videos.
 *
 * Returns a file path to the generated audio, or null if musicStyle is 'none'.
 *
 * Currently generates a silent audio track as a placeholder. This creates the
 * full pipeline wiring so a real music API (Suno, AudioCraft, etc.) can be
 * plugged in later without changing any other files.
 */
export async function generateBackgroundMusic(opts: MusicOptions): Promise<string | null> {
  const { musicStyle, durationSeconds } = opts;

  if (musicStyle === 'none') {
    log.info('Music style is "none", skipping music generation');
    return null;
  }

  log.info({ musicStyle, durationSeconds }, 'Generating background music');

  // TODO: Integrate a real music generation API (Suno, AudioCraft, etc.)
  // For now, generate a silent audio track so the pipeline is fully wired.
  return generateSilentMusic(durationSeconds);
}

// ---------------------------------------------------------------------------
// Placeholder: Silent Audio Generator
// ---------------------------------------------------------------------------

/**
 * Generate a silent MP3 audio file using FFmpeg.
 * Returns the file path (caller is responsible for cleanup).
 */
function generateSilentMusic(durationSeconds: number): string {
  const tmpFile = path.join(os.tmpdir(), `gameplay-music-${Date.now()}.mp3`);

  try {
    execSync(
      `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${durationSeconds} -q:a 9 "${tmpFile}"`,
      { timeout: 30_000, stdio: 'pipe' },
    );

    const stats = fs.statSync(tmpFile);
    log.info({ durationSeconds, sizeBytes: stats.size, path: tmpFile }, 'Silent music track generated');
    return tmpFile;
  } catch (err) {
    log.warn({ err }, 'FFmpeg silent music generation failed');
    // Clean up on failure
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    throw new Error('Failed to generate background music');
  }
}
