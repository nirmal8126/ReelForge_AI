import axios from 'axios';
import { logger } from '../utils/logger';
import { prisma } from '@reelforge/db';

const log = logger.child({ service: 'stock-footage' });

const PEXELS_API_URL = 'https://api.pexels.com/videos/search';
const PIXABAY_API_URL = 'https://pixabay.com/api/videos';

export interface StockFootageOptions {
  query: string;
  durationSeconds: number;
}

/**
 * Download stock footage from Pexels or Pixabay.
 * Falls back between providers if one fails.
 * Caches results to avoid redundant API calls.
 */
export async function downloadStockFootage(opts: StockFootageOptions): Promise<string> {
  const { query, durationSeconds } = opts;

  log.info({ query, durationSeconds }, 'Searching for stock footage');

  // Check cache first
  const cached = await checkCache(query);
  if (cached) {
    log.info({ query, cachedUrl: cached }, 'Using cached stock footage');
    return cached;
  }

  // Try Pexels first (better quality, free tier: 200 req/hour)
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    try {
      const result = await fetchFromPexels(query, durationSeconds, pexelsKey);
      if (result) {
        await cacheFootage(query, result.url, result.externalId, 'pexels', result.duration);
        return result.url;
      }
    } catch (error) {
      log.warn({ query, err: error }, 'Pexels fetch failed, trying Pixabay');
    }
  }

  // Fallback to Pixabay (free tier: 100 req/min)
  const pixabayKey = process.env.PIXABAY_API_KEY;
  if (pixabayKey) {
    try {
      const result = await fetchFromPixabay(query, durationSeconds, pixabayKey);
      if (result) {
        await cacheFootage(query, result.url, result.externalId, 'pixabay', result.duration);
        return result.url;
      }
    } catch (error) {
      log.error({ query, err: error }, 'Pixabay fetch failed');
    }
  }

  // Fallback to placeholder if both fail or no API keys configured
  log.warn({ query }, 'No stock footage API keys configured, using placeholder');
  return `https://via.placeholder.com/1280x720/6366F1/FFFFFF?text=${encodeURIComponent(query)}`;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

interface StockResult {
  url: string;
  externalId: string;
  duration: number;
}

export interface PexelsClipResult {
  downloadUrl: string;
  duration: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Per-scene Pexels clip search (used by per-scene video pipeline)
// ---------------------------------------------------------------------------

/**
 * Search Pexels for a single video clip matching a keyword.
 * Returns the best HD clip with download URL, or null if nothing found.
 */
export async function searchPexelsForClip(
  keyword: string,
  targetDuration: number,
  orientation: 'landscape' | 'portrait' | 'square' = 'portrait',
): Promise<PexelsClipResult | null> {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) {
    log.warn('PEXELS_API_KEY not set, cannot search for clip');
    return null;
  }

  // Check cache first
  const cached = await checkCache(keyword);
  if (cached) {
    log.info({ keyword, cachedUrl: cached }, 'Using cached clip for scene');
    return { downloadUrl: cached, duration: targetDuration, width: 1280, height: 720 };
  }

  try {
    const response = await axios.get(PEXELS_API_URL, {
      params: {
        query: keyword,
        per_page: 15,
        orientation,
      },
      headers: {
        Authorization: pexelsKey,
      },
      timeout: 10_000,
    });

    const videos = response.data.videos || [];
    if (videos.length === 0) {
      log.info({ keyword }, 'No Pexels results for keyword');
      return null;
    }

    // Filter videos with valid video_files
    const valid = videos.filter((v: any) => v.video_files && v.video_files.length > 0);
    if (valid.length === 0) return null;

    // Prefer clips with duration >= target so we can trim (better than looping short clips)
    const longerClips = valid.filter((v: any) => v.duration >= targetDuration);
    const pool = longerClips.length > 0 ? longerClips : valid;

    // Sort by closest duration match
    pool.sort((a: any, b: any) => {
      const aDiff = Math.abs(a.duration - targetDuration);
      const bDiff = Math.abs(b.duration - targetDuration);
      return aDiff - bDiff;
    });

    const video = pool[0];

    // Pick HD quality file
    const hdFile = video.video_files.find(
      (f: any) => f.quality === 'hd' && f.width >= 1280
    ) || video.video_files.find(
      (f: any) => f.quality === 'hd'
    ) || video.video_files[0];

    log.info({ keyword, videoId: video.id, duration: video.duration, quality: hdFile.quality }, 'Pexels clip found for scene');

    // Cache for future use
    await cacheFootage(keyword, hdFile.link, String(video.id), 'pexels', video.duration);

    return {
      downloadUrl: hdFile.link,
      duration: video.duration,
      width: hdFile.width || 1280,
      height: hdFile.height || 720,
    };
  } catch (err) {
    log.warn({ keyword, err: err instanceof Error ? err.message : err }, 'Pexels clip search failed');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pexels Integration
// ---------------------------------------------------------------------------

async function fetchFromPexels(
  query: string,
  durationSeconds: number,
  apiKey: string
): Promise<StockResult | null> {
  const response = await axios.get(PEXELS_API_URL, {
    params: {
      query,
      per_page: 10,
      orientation: 'landscape',
    },
    headers: {
      Authorization: apiKey,
    },
    timeout: 10000,
  });

  const videos = response.data.videos || [];
  if (videos.length === 0) {
    return null;
  }

  // Find video with duration close to target
  const sorted = videos
    .filter((v: any) => v.video_files && v.video_files.length > 0)
    .sort((a: any, b: any) => {
      const aDiff = Math.abs(a.duration - durationSeconds);
      const bDiff = Math.abs(b.duration - durationSeconds);
      return aDiff - bDiff;
    });

  if (sorted.length === 0) {
    return null;
  }

  const video = sorted[0];
  const hdFile = video.video_files.find(
    (f: any) => f.quality === 'hd' && f.width >= 1280
  ) || video.video_files[0];

  log.info({ query, provider: 'Pexels', videoUrl: hdFile.link }, 'Stock footage found');
  return {
    url: hdFile.link,
    externalId: String(video.id),
    duration: video.duration,
  };
}

// ---------------------------------------------------------------------------
// Pixabay Integration
// ---------------------------------------------------------------------------

async function fetchFromPixabay(
  query: string,
  durationSeconds: number,
  apiKey: string
): Promise<StockResult | null> {
  const response = await axios.get(PIXABAY_API_URL, {
    params: {
      key: apiKey,
      q: query,
      per_page: 10,
      video_type: 'all',
    },
    timeout: 10000,
  });

  const videos = response.data.hits || [];
  if (videos.length === 0) {
    return null;
  }

  const sorted = videos
    .filter((v: any) => v.videos && v.videos.large)
    .sort((a: any, b: any) => {
      const aDiff = Math.abs(a.duration - durationSeconds);
      const bDiff = Math.abs(b.duration - durationSeconds);
      return aDiff - bDiff;
    });

  if (sorted.length === 0) {
    return null;
  }

  const video = sorted[0];
  const videoUrl = video.videos.large.url;

  log.info({ query, provider: 'Pixabay', videoUrl }, 'Stock footage found');
  return {
    url: videoUrl,
    externalId: String(video.id),
    duration: video.duration,
  };
}

// ---------------------------------------------------------------------------
// Cache Management (matches StockFootageCache Prisma model)
// ---------------------------------------------------------------------------

async function checkCache(query: string): Promise<string | null> {
  try {
    const cached = await prisma.stockFootageCache.findFirst({
      where: {
        query: query.toLowerCase(),
      },
      orderBy: { createdAt: 'desc' },
    });

    return cached?.url || null;
  } catch (error) {
    log.warn({ err: error }, 'Cache check failed');
    return null;
  }
}

async function cacheFootage(
  query: string,
  url: string,
  externalId: string,
  provider: string,
  duration?: number,
): Promise<void> {
  try {
    await prisma.stockFootageCache.create({
      data: {
        query: query.toLowerCase(),
        url,
        externalId,
        provider,
        duration: duration || null,
      },
    });

    log.info({ query, provider }, 'Stock footage cached');
  } catch (error) {
    log.warn({ err: error }, 'Failed to cache footage (non-critical)');
  }
}
