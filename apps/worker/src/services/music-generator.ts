import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'music-generator' });

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
// Persistent local cache — avoids re-downloading the same track
// ---------------------------------------------------------------------------

const MUSIC_CACHE_DIR = path.join(os.tmpdir(), 'reelforge-music-cache');

function ensureCacheDir(): void {
  if (!fs.existsSync(MUSIC_CACHE_DIR)) {
    fs.mkdirSync(MUSIC_CACHE_DIR, { recursive: true });
  }
}

function getCachedTrackPath(trackId: string): string {
  return path.join(MUSIC_CACHE_DIR, `${trackId}.mp3`);
}

// ---------------------------------------------------------------------------
// Pixabay Music API (free, royalty-free, no attribution required)
// Sign up at https://pixabay.com/api/docs/ to get a free API key
// ---------------------------------------------------------------------------

// Map our track IDs to Pixabay search queries + genres
const TRACK_SEARCH_MAP: Record<string, { query: string; genre?: string; mood?: string }> = {
  'upbeat-corporate':   { query: 'corporate upbeat', genre: 'pop', mood: 'happy' },
  'cinematic-epic':     { query: 'cinematic epic', genre: 'cinematic', mood: 'epic' },
  'lofi-chill':         { query: 'lofi chill', genre: 'beats', mood: 'chill' },
  'acoustic-gentle':    { query: 'acoustic gentle', genre: 'acoustic', mood: 'relaxing' },
  'tech-innovation':    { query: 'technology modern', genre: 'electronic', mood: 'uplifting' },
  'motivational-rise':  { query: 'motivational inspiring', genre: 'pop', mood: 'uplifting' },
  'ambient-focus':      { query: 'ambient calm focus', genre: 'ambient', mood: 'relaxing' },
  'fun-playful':        { query: 'fun playful happy', genre: 'pop', mood: 'happy' },
  'dramatic-tension':   { query: 'dramatic suspense', genre: 'cinematic', mood: 'dark' },
  'happy-kids':         { query: 'happy kids cheerful', genre: 'pop', mood: 'happy' },
  'news-intro':         { query: 'news broadcast intro', genre: 'cinematic', mood: 'epic' },
  'hip-hop-beat':       { query: 'hip hop beat', genre: 'hiphop', mood: 'groovy' },
  'indian-classical':   { query: 'indian classical sitar', genre: 'world', mood: 'relaxing' },
  'bollywood-pop':      { query: 'bollywood dance', genre: 'world', mood: 'happy' },
};

/**
 * Download a track from Pixabay's free music API.
 * Returns the raw MP3 file path, or null if unavailable.
 */
async function downloadFromPixabay(trackId: string): Promise<string | null> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    log.debug('No PIXABAY_API_KEY set, skipping Pixabay');
    return null;
  }

  const searchConfig = TRACK_SEARCH_MAP[trackId];
  if (!searchConfig) return null;

  try {
    // Search for music
    const params: Record<string, string> = {
      key: apiKey,
      q: searchConfig.query,
      per_page: '3',
    };

    const searchRes = await axios.get('https://pixabay.com/api/videos/', {
      // Pixabay doesn't have a dedicated music search endpoint in their free tier
      // We use their audio endpoint instead
      params,
      timeout: 10_000,
    });

    // Note: Pixabay free API may not have a direct music endpoint.
    // If this doesn't work, we fall through to other sources.
    log.debug({ trackId, hits: searchRes.data?.totalHits }, 'Pixabay search result');
    return null; // Will use freesound/local fallback
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Freesound.org API (free, CC0 licensed music)
// Sign up at https://freesound.org/apiv2/ for a free API key
// ---------------------------------------------------------------------------

const FREESOUND_SEARCH_MAP: Record<string, string> = {
  'upbeat-corporate':   'upbeat corporate background music',
  'cinematic-epic':     'cinematic epic orchestral',
  'lofi-chill':         'lofi chill hip hop beats',
  'acoustic-gentle':    'acoustic guitar gentle calm',
  'tech-innovation':    'electronic technology modern',
  'motivational-rise':  'motivational inspiring uplifting',
  'ambient-focus':      'ambient calm focus background',
  'fun-playful':        'fun playful cheerful happy',
  'dramatic-tension':   'dramatic suspense tension',
  'happy-kids':         'happy children cheerful',
  'news-intro':         'news broadcast intro jingle',
  'hip-hop-beat':       'hip hop beat instrumental',
  'indian-classical':   'indian classical sitar tabla',
  'bollywood-pop':      'bollywood dance upbeat',
};

/**
 * Download a CC0-licensed track from Freesound.org.
 * Returns the raw file path, or null if unavailable.
 */
async function downloadFromFreesound(trackId: string, outputPath: string): Promise<boolean> {
  const apiKey = process.env.FREESOUND_API_KEY;
  if (!apiKey) {
    log.debug('No FREESOUND_API_KEY set, skipping Freesound');
    return false;
  }

  const query = FREESOUND_SEARCH_MAP[trackId];
  if (!query) return false;

  try {
    // Search for sounds with CC0 license, duration > 15s
    const searchRes = await axios.get('https://freesound.org/apiv2/search/text/', {
      params: {
        query,
        token: apiKey,
        filter: 'license:"Creative Commons 0" duration:[15 TO 300]',
        fields: 'id,name,duration,previews',
        sort: 'rating_desc',
        page_size: 3,
      },
      timeout: 10_000,
    });

    const results = searchRes.data?.results;
    if (!results || results.length === 0) {
      log.debug({ trackId }, 'No Freesound results found');
      return false;
    }

    // Pick the first result and download its preview MP3
    const sound = results[0];
    const previewUrl = sound.previews?.['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'];
    if (!previewUrl) return false;

    log.info({ trackId, soundId: sound.id, name: sound.name }, 'Downloading from Freesound');

    const dlRes = await axios.get(previewUrl, {
      responseType: 'arraybuffer',
      timeout: 20_000,
      headers: { Authorization: `Token ${apiKey}` },
    });

    if (dlRes.data && dlRes.data.byteLength > 5000) {
      fs.writeFileSync(outputPath, Buffer.from(dlRes.data));
      log.info({ trackId, sizeBytes: dlRes.data.byteLength }, 'Freesound track downloaded');
      return true;
    }

    return false;
  } catch (err) {
    log.warn({ trackId, err: err instanceof Error ? err.message : err }, 'Freesound download failed');
    return false;
  }
}

// ---------------------------------------------------------------------------
// R2/CDN download (admin-uploaded tracks)
// ---------------------------------------------------------------------------

function getMusicTrackUrl(trackId: string): string | null {
  const cdnBase = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_CDN_URL || '';
  if (!cdnBase || trackId === 'none') return null;
  return `${cdnBase}/music/${trackId}.mp3`;
}

async function downloadFromCDN(trackId: string, outputPath: string): Promise<boolean> {
  const trackUrl = getMusicTrackUrl(trackId);
  if (!trackUrl) return false;

  try {
    const response = await axios.get(trackUrl, {
      responseType: 'arraybuffer',
      timeout: 15_000,
    });

    if (response.data && response.data.byteLength > 1000) {
      fs.writeFileSync(outputPath, Buffer.from(response.data));
      log.info({ trackId, sizeBytes: response.data.byteLength }, 'CDN track downloaded');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// FFmpeg sine-wave fallback (always works, no API needed)
// ---------------------------------------------------------------------------

const TRACK_TONES: Record<string, { freqs: number[]; tempo: number }> = {
  'upbeat-corporate':   { freqs: [440, 554, 659], tempo: 120 },
  'cinematic-epic':     { freqs: [220, 330, 440], tempo: 80 },
  'lofi-chill':         { freqs: [330, 392, 494], tempo: 85 },
  'acoustic-gentle':    { freqs: [349, 440, 523], tempo: 95 },
  'tech-innovation':    { freqs: [392, 494, 587], tempo: 110 },
  'motivational-rise':  { freqs: [261, 329, 392], tempo: 100 },
  'ambient-focus':      { freqs: [261, 330, 392], tempo: 70 },
  'fun-playful':        { freqs: [523, 659, 784], tempo: 130 },
  'dramatic-tension':   { freqs: [196, 233, 294], tempo: 75 },
  'happy-kids':         { freqs: [523, 587, 659], tempo: 140 },
  'news-intro':         { freqs: [349, 440, 523], tempo: 105 },
  'hip-hop-beat':       { freqs: [220, 277, 330], tempo: 90 },
  'indian-classical':   { freqs: [261, 294, 349], tempo: 85 },
  'bollywood-pop':      { freqs: [349, 440, 523], tempo: 115 },
};

function generateSineMusic(trackId: string, durationSeconds: number, outputPath: string): void {
  const config = TRACK_TONES[trackId] || { freqs: [330, 440, 523], tempo: 100 };

  const sources = config.freqs.map((freq) => {
    const vol = 0.15 / config.freqs.length;
    return `sine=frequency=${freq}:duration=${durationSeconds}:sample_rate=44100,volume=${vol.toFixed(3)}`;
  });

  const tremoloSpeed = config.tempo / 60;
  const filterParts = sources.map((_, i) => `[${i}]atremolo=f=${(tremoloSpeed * (i + 1)).toFixed(1)}:d=0.3[t${i}]`);
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
  } catch {
    // Ultra-simple fallback: single sine tone
    execSync(
      `ffmpeg -y -f lavfi -i "sine=frequency=${config.freqs[0]}:duration=${durationSeconds}:sample_rate=44100" ` +
      `-af "volume=0.08,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, durationSeconds - 2)}:d=2" ` +
      `-t ${durationSeconds} -c:a libmp3lame -q:a 4 "${outputPath}"`,
      { timeout: 30_000, stdio: 'pipe' },
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Prepare a background music file for mixing into a video.
 *
 * Priority chain:
 *  1. Local disk cache (instant, no download)
 *  2. R2/CDN (admin-uploaded tracks)
 *  3. Freesound.org API (free, CC0 licensed)
 *  4. FFmpeg sine-wave generator (always works)
 *
 * Downloaded tracks are cached locally so subsequent jobs reuse them.
 * Returns the local file path trimmed/looped to match target duration,
 * or null if trackId is 'none'.
 */
export async function prepareBackgroundMusic(opts: BgMusicOptions): Promise<string | null> {
  const { trackId, durationSeconds } = opts;

  if (!trackId || trackId === 'none') {
    log.info('No background music requested');
    return null;
  }

  ensureCacheDir();

  const cachedPath = getCachedTrackPath(trackId);
  const tmpFile = path.join(os.tmpdir(), `bgm-${trackId}-${Date.now()}.mp3`);

  try {
    // Check local cache first
    if (fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 1000) {
      log.info({ trackId }, 'Using cached music track');
    } else {
      // Try sources in priority order
      let acquired = false;

      // 1. R2/CDN
      if (!acquired) {
        acquired = await downloadFromCDN(trackId, cachedPath);
        if (acquired) log.info({ trackId }, 'Music from R2/CDN');
      }

      // 2. Freesound.org
      if (!acquired) {
        acquired = await downloadFromFreesound(trackId, cachedPath);
        if (acquired) log.info({ trackId }, 'Music from Freesound');
      }

      // 3. FFmpeg sine-wave fallback
      if (!acquired) {
        log.info({ trackId }, 'Using FFmpeg generated music');
        generateSineMusic(trackId, durationSeconds, cachedPath);
      }
    }

    // Trim/loop cached track to match target duration
    execSync(
      `ffmpeg -y -stream_loop -1 -i "${cachedPath}" ` +
      `-t ${durationSeconds} -c:a libmp3lame -q:a 4 "${tmpFile}"`,
      { timeout: 30_000, stdio: 'pipe' },
    );

    const stats = fs.statSync(tmpFile);
    log.info({ trackId, durationSeconds, sizeBytes: stats.size }, 'Background music prepared');
    return tmpFile;
  } catch (err) {
    log.warn({ trackId, err: err instanceof Error ? err.message : err }, 'Failed to prepare background music');
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Generate a background music file for gameplay videos (legacy).
 * Returns a file path to the generated audio, or null if musicStyle is 'none'.
 */
export async function generateBackgroundMusic(opts: MusicOptions): Promise<string | null> {
  const { musicStyle, durationSeconds } = opts;

  if (musicStyle === 'none') {
    log.info('Music style is "none", skipping music generation');
    return null;
  }

  log.info({ musicStyle, durationSeconds }, 'Generating background music');
  return generateSilentMusic(durationSeconds);
}

// ---------------------------------------------------------------------------
// Silent Audio Generator (for legacy gameplay module)
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
