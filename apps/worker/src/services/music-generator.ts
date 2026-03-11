import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'music-generator' });

// ---------------------------------------------------------------------------
// Music track URLs — stored in R2/CDN
// Admin can upload tracks via the admin panel; these map to the track IDs
// defined in apps/web/src/lib/constants.ts MUSIC_TRACKS
// ---------------------------------------------------------------------------

function getMusicTrackUrl(trackId: string): string | null {
  const cdnBase = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_CDN_URL || '';
  if (!cdnBase || trackId === 'none') return null;
  return `${cdnBase}/music/${trackId}.mp3`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MusicOptions {
  musicStyle: string;       // legacy: 'upbeat' | 'chill' | 'intense' | 'none'
  durationSeconds: number;
}

export interface BgMusicOptions {
  trackId: string;          // from MUSIC_TRACKS constant (e.g. 'lofi-chill')
  durationSeconds: number;
  volume?: number;          // 0-100, default 15
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Prepare a background music file for mixing into a video.
 *
 * Downloads the track from R2 storage, trims/loops to match the target
 * duration, and returns the local file path.
 * Returns null if trackId is 'none' or track is unavailable.
 */
export async function prepareBackgroundMusic(opts: BgMusicOptions): Promise<string | null> {
  const { trackId, durationSeconds } = opts;

  if (!trackId || trackId === 'none') {
    log.info('No background music requested');
    return null;
  }

  const trackUrl = getMusicTrackUrl(trackId);
  if (!trackUrl) {
    log.warn({ trackId }, 'No CDN URL configured or track is "none", skipping music');
    return null;
  }

  const tmpFile = path.join(os.tmpdir(), `bgm-${trackId}-${Date.now()}.mp3`);
  const downloadFile = path.join(os.tmpdir(), `bgm-raw-${trackId}-${Date.now()}.mp3`);

  try {
    // Step 1: Download the track from R2/CDN
    log.info({ trackId, trackUrl, durationSeconds }, 'Downloading background music track');

    const response = await axios.get(trackUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
    });

    fs.writeFileSync(downloadFile, Buffer.from(response.data));
    log.info({ trackId, sizeBytes: response.data.byteLength }, 'Music track downloaded');

    // Step 2: Trim/loop to match target duration using FFmpeg
    // -stream_loop -1 loops the input; -t cuts to exact duration
    execSync(
      `ffmpeg -y -stream_loop -1 -i "${downloadFile}" ` +
      `-t ${durationSeconds} -c:a libmp3lame -q:a 4 "${tmpFile}"`,
      { timeout: 30_000, stdio: 'pipe' },
    );

    // Cleanup raw download
    try { fs.unlinkSync(downloadFile); } catch { /* ignore */ }

    const stats = fs.statSync(tmpFile);
    log.info({ trackId, durationSeconds, sizeBytes: stats.size }, 'Background music prepared');
    return tmpFile;
  } catch (err) {
    log.warn({ trackId, err: err instanceof Error ? err.message : err }, 'Failed to prepare background music');
    // Cleanup on failure
    try { fs.unlinkSync(downloadFile); } catch { /* ignore */ }
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Generate a background music file for gameplay videos (legacy).
 *
 * Returns a file path to the generated audio, or null if musicStyle is 'none'.
 * Currently generates a silent audio track as a placeholder.
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
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    throw new Error('Failed to generate background music');
  }
}
