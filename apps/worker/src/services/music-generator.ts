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
    // Step 1: Try downloading the track from R2/CDN
    let downloaded = false;
    try {
      log.info({ trackId, trackUrl, durationSeconds }, 'Downloading background music track');

      const response = await axios.get(trackUrl, {
        responseType: 'arraybuffer',
        timeout: 15_000,
      });

      if (response.data && response.data.byteLength > 1000) {
        fs.writeFileSync(downloadFile, Buffer.from(response.data));
        log.info({ trackId, sizeBytes: response.data.byteLength }, 'Music track downloaded');

        // Step 2: Trim/loop to match target duration using FFmpeg
        execSync(
          `ffmpeg -y -stream_loop -1 -i "${downloadFile}" ` +
          `-t ${durationSeconds} -c:a libmp3lame -q:a 4 "${tmpFile}"`,
          { timeout: 30_000, stdio: 'pipe' },
        );
        downloaded = true;
      }
    } catch (dlErr) {
      log.warn({ trackId, err: dlErr instanceof Error ? dlErr.message : dlErr }, 'CDN download failed, using generated fallback');
    }

    // Cleanup raw download
    try { fs.unlinkSync(downloadFile); } catch { /* ignore */ }

    // Step 3: If download failed, generate a local background track via FFmpeg
    if (!downloaded) {
      log.info({ trackId, durationSeconds }, 'Generating local background music fallback');
      generateLocalMusic(trackId, durationSeconds, tmpFile);
    }

    const stats = fs.statSync(tmpFile);
    log.info({ trackId, durationSeconds, sizeBytes: stats.size, fromCDN: downloaded }, 'Background music prepared');
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

// ---------------------------------------------------------------------------
// Local music generation via FFmpeg sine/noise synthesis
// Used as fallback when CDN music files aren't available yet.
// Each track ID maps to a different tone/frequency combination
// to give variety across different music styles.
// ---------------------------------------------------------------------------

const TRACK_TONES: Record<string, { freqs: number[]; type: 'sine' | 'warm'; tempo: number }> = {
  'upbeat-corporate':   { freqs: [440, 554, 659], type: 'warm', tempo: 120 },
  'cinematic-epic':     { freqs: [220, 330, 440], type: 'warm', tempo: 80 },
  'lofi-chill':         { freqs: [330, 392, 494], type: 'sine', tempo: 85 },
  'acoustic-gentle':    { freqs: [349, 440, 523], type: 'sine', tempo: 95 },
  'tech-innovation':    { freqs: [392, 494, 587], type: 'warm', tempo: 110 },
  'motivational-rise':  { freqs: [261, 329, 392], type: 'warm', tempo: 100 },
  'ambient-focus':      { freqs: [261, 330, 392], type: 'sine', tempo: 70 },
  'fun-playful':        { freqs: [523, 659, 784], type: 'sine', tempo: 130 },
  'dramatic-tension':   { freqs: [196, 233, 294], type: 'warm', tempo: 75 },
  'happy-kids':         { freqs: [523, 587, 659], type: 'sine', tempo: 140 },
  'news-intro':         { freqs: [349, 440, 523], type: 'warm', tempo: 105 },
  'hip-hop-beat':       { freqs: [220, 277, 330], type: 'warm', tempo: 90 },
  'indian-classical':   { freqs: [261, 294, 349], type: 'sine', tempo: 85 },
  'bollywood-pop':      { freqs: [349, 440, 523], type: 'warm', tempo: 115 },
};

function generateLocalMusic(trackId: string, durationSeconds: number, outputPath: string): void {
  const config = TRACK_TONES[trackId] || { freqs: [330, 440, 523], type: 'sine', tempo: 100 };

  // Generate a multi-tone ambient track using FFmpeg lavfi
  // Mix multiple sine waves at low volume to create a subtle background
  const sources = config.freqs.map((freq, i) => {
    const vol = 0.15 / config.freqs.length; // keep total volume low
    return `sine=frequency=${freq}:duration=${durationSeconds}:sample_rate=44100,volume=${vol.toFixed(3)}`;
  });

  // Apply a gentle tremolo effect based on tempo for rhythm feel
  const tremoloSpeed = config.tempo / 60; // beats per second
  const filterParts = sources.map((src, i) => `[${i}]atremolo=f=${(tremoloSpeed * (i + 1)).toFixed(1)}:d=0.3[t${i}]`);
  const mixInputs = sources.map((_, i) => `[t${i}]`).join('');

  const inputArgs = sources.map(src => `-f lavfi -i "${src}"`).join(' ');
  const filterComplex = `${filterParts.join(';')};${mixInputs}amix=inputs=${sources.length}:duration=longest,` +
    `lowpass=f=2000,highpass=f=80,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, durationSeconds - 2)}:d=2`;

  try {
    execSync(
      `ffmpeg -y ${inputArgs} -filter_complex "${filterComplex}" ` +
      `-t ${durationSeconds} -c:a libmp3lame -q:a 4 "${outputPath}"`,
      { timeout: 30_000, stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 },
    );
    log.info({ trackId, durationSeconds }, 'Local background music generated');
  } catch (err) {
    // Ultra-simple fallback: single sine tone
    log.warn({ trackId, err: err instanceof Error ? err.message : err }, 'Complex music gen failed, using simple tone');
    execSync(
      `ffmpeg -y -f lavfi -i "sine=frequency=${config.freqs[0]}:duration=${durationSeconds}:sample_rate=44100" ` +
      `-af "volume=0.08,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, durationSeconds - 2)}:d=2" ` +
      `-t ${durationSeconds} -c:a libmp3lame -q:a 4 "${outputPath}"`,
      { timeout: 30_000, stdio: 'pipe' },
    );
  }
}

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
