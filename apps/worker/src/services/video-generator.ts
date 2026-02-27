import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { convertScriptToSearchKeywords, generateSceneImages } from './image-generator';
import { searchPexelsForClip, searchPixabayForClip } from './stock-footage';
import { concatenateClipsWithCrossfade, SceneClip } from './scene-clip-composer';

const log = logger.child({ service: 'video-generator' });

const RUNWAY_API_URL = 'https://api.dev.runwayml.com/v1';
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 60;

// Plans that qualify for RunwayML AI video generation
const PREMIUM_PLANS = ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoGenerationOptions {
  prompt: string;
  script?: string;      // full script text — used to generate scene-matched visuals
  style: string;
  durationSeconds: number;
  aspectRatio?: string; // '16:9' | '9:16' | '1:1'
  plan?: string;        // user subscription plan
}

interface RunwayTaskResponse {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  output?: string[];
  failure?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRunwayClient(): AxiosInstance {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    throw new Error('RUNWAY_API_KEY is not set');
  }

  return axios.create({
    baseURL: RUNWAY_API_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
    },
    timeout: 30_000,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API — Provider chain
// ---------------------------------------------------------------------------

/**
 * Generate a video clip using a provider fallback chain:
 *
 * 1. DEV_MODE → per-scene Pexels pipeline
 * 2. NODE_ENV=development → skip paid providers, use per-scene Pexels
 * 3. Premium plans (STARTER+):
 *    a. RUNWAY_API_KEY → RunwayML AI video (best quality)
 *    b. GEMINI_API_KEY → Google Veo 3 Fast AI video ($0.15/sec, same API key)
 * 4. Per-scene Pexels stock video pipeline (free, default for all)
 */
export async function generateVideo(opts: VideoGenerationOptions): Promise<Buffer> {
  const { prompt, script, style, durationSeconds, aspectRatio, plan } = opts;

  // DEV_MODE: use per-scene Pexels pipeline
  if (process.env.DEV_MODE === 'true') {
    log.info({ prompt: prompt.substring(0, 50) }, 'DEV_MODE: Using per-scene Pexels pipeline');
    return generateWithPerScenePexels(prompt, style, durationSeconds, aspectRatio, script);
  }

  const isPremium = plan && PREMIUM_PLANS.includes(plan);
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    log.info('NODE_ENV=development — skipping paid providers, using per-scene Pexels');
  } else if (isPremium) {
    // Premium: try RunwayML first
    if (process.env.RUNWAY_API_KEY) {
      try {
        log.info({ plan }, 'Premium plan — trying RunwayML');
        return await generateWithRunway(prompt, style, durationSeconds, aspectRatio);
      } catch (err) {
        log.warn({ err: err instanceof Error ? err.message : err }, 'RunwayML failed, trying Veo');
      }
    }

    // Premium fallback: try Google Veo 3 Fast (uses same Gemini API key)
    if (process.env.GEMINI_API_KEY) {
      try {
        log.info({ plan }, 'Premium plan — trying Google Veo 3 Fast');
        return await generateWithVeo(prompt, style, durationSeconds, aspectRatio);
      } catch (err) {
        log.warn({ err: err instanceof Error ? err.message : err }, 'Veo failed, falling back to Pexels');
      }
    }
  } else {
    log.info({ plan: plan || 'FREE' }, 'Free plan — using per-scene Pexels pipeline');
  }

  // Per-scene Pexels stock video pipeline (free, default for all)
  return generateWithPerScenePexels(prompt, style, durationSeconds, aspectRatio, script);
}

// ---------------------------------------------------------------------------
// Provider 1: RunwayML (Premium only, production)
// ---------------------------------------------------------------------------

async function generateWithRunway(
  prompt: string,
  style: string,
  durationSeconds: number,
  aspectRatio?: string,
): Promise<Buffer> {
  const client = getRunwayClient();

  log.info({ style, durationSeconds, aspectRatio }, 'Initiating RunwayML video generation');

  // Gen 4.5 only supports 5s or 10s durations
  const validDuration = durationSeconds <= 5 ? 5 : 10;

  const ratioMap: Record<string, string> = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '1:1': '1080:1080',
  };
  const ratio = ratioMap[aspectRatio || '16:9'] || '1280:720';

  const requestBody = {
    model: 'gen4.5',
    promptText: `${style} style: ${prompt}`,
    duration: validDuration,
    ratio,
  };

  log.info({ requestBody }, 'Sending RunwayML API request');

  let initResponse;
  try {
    initResponse = await client.post<RunwayTaskResponse>('/text_to_video', requestBody);
  } catch (error: any) {
    log.error({
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      requestBody,
    }, 'RunwayML API request failed');
    throw error;
  }

  const taskId = initResponse.data.id;
  log.info({ taskId }, 'Video generation task created');

  // Poll for completion
  let attempts = 0;
  while (attempts < MAX_POLL_ATTEMPTS) {
    attempts++;
    await sleep(POLL_INTERVAL_MS);

    const statusResponse = await client.get<RunwayTaskResponse>(`/tasks/${taskId}`);
    const { status, output, failure } = statusResponse.data;

    log.debug({ taskId, status, attempt: attempts }, 'Polling video generation status');

    if (status === 'SUCCEEDED') {
      if (!output || output.length === 0) {
        throw new Error('Video generation succeeded but no output URL returned');
      }

      const videoUrl = output[0];
      log.info({ taskId, videoUrl }, 'Downloading generated video');

      const downloadResponse = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
      });

      const videoBuffer = Buffer.from(downloadResponse.data);
      log.info({ taskId, videoSizeBytes: videoBuffer.length }, 'RunwayML video downloaded');

      return videoBuffer;
    }

    if (status === 'FAILED') {
      throw new Error(`Video generation failed: ${failure || 'Unknown error'}`);
    }
  }

  throw new Error(
    `Video generation timed out after ${MAX_POLL_ATTEMPTS} attempts (${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s)`,
  );
}

// ---------------------------------------------------------------------------
// Provider 2: Google Veo 3 Fast (Premium, uses same Gemini API key)
// Cost: ~$0.15/sec — much cheaper than RunwayML
// ---------------------------------------------------------------------------

const VEO_MODEL = 'veo-3.0-fast-generate-001';
const VEO_POLL_INTERVAL_MS = 10_000;
const VEO_MAX_POLL_ATTEMPTS = 36; // 6 minutes max

async function generateWithVeo(
  prompt: string,
  style: string,
  durationSeconds: number,
  aspectRatio?: string,
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  // Veo supports up to 8s per clip
  const veoDuration = Math.min(8, durationSeconds);
  const ar = aspectRatio === '9:16' ? '9:16' : aspectRatio === '1:1' ? '1:1' : '16:9';

  log.info({ model: VEO_MODEL, durationSeconds: veoDuration, aspectRatio: ar }, 'Initiating Veo video generation');

  // Step 1: Start async generation
  const initResponse = await axios.post(
    `${baseUrl}/models/${VEO_MODEL}:predictLongRunning`,
    {
      instances: [{
        prompt: `${style} style, cinematic: ${prompt}`,
      }],
      parameters: {
        aspectRatio: ar,
        durationSeconds: String(veoDuration),
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      timeout: 30_000,
    },
  );

  const operationName = initResponse.data.name;
  if (!operationName) {
    throw new Error('Veo: No operation name returned');
  }

  log.info({ operationName }, 'Veo generation started, polling...');

  // Step 2: Poll for completion
  let attempts = 0;
  while (attempts < VEO_MAX_POLL_ATTEMPTS) {
    attempts++;
    await sleep(VEO_POLL_INTERVAL_MS);

    const pollResponse = await axios.get(
      `${baseUrl}/${operationName}`,
      {
        headers: { 'x-goog-api-key': apiKey },
        timeout: 15_000,
      },
    );

    const { done, response: opResponse, error: opError } = pollResponse.data;

    log.debug({ operationName, done, attempt: attempts }, 'Polling Veo status');

    if (opError) {
      throw new Error(`Veo generation failed: ${opError.message || JSON.stringify(opError)}`);
    }

    if (done && opResponse) {
      const samples = opResponse.generateVideoResponse?.generatedSamples;
      if (!samples || samples.length === 0) {
        throw new Error('Veo: No video samples returned');
      }

      const videoUri = samples[0].video?.uri;
      if (!videoUri) {
        throw new Error('Veo: No video URI in response');
      }

      log.info({ videoUri: videoUri.substring(0, 80) }, 'Downloading Veo video');

      // Step 3: Download the video
      const downloadResponse = await axios.get(videoUri, {
        responseType: 'arraybuffer',
        headers: { 'x-goog-api-key': apiKey },
        timeout: 60_000,
      });

      const videoBuffer = Buffer.from(downloadResponse.data);
      log.info({ videoSizeBytes: videoBuffer.length }, 'Veo video downloaded');

      return videoBuffer;
    }
  }

  throw new Error(`Veo timed out after ${VEO_MAX_POLL_ATTEMPTS * VEO_POLL_INTERVAL_MS / 1000}s`);
}

// ---------------------------------------------------------------------------
// Provider 3: Per-Scene Pexels Stock Video Pipeline (Free)
// ---------------------------------------------------------------------------

/**
 * Generate a video by searching stock video sites for clips per script scene,
 * then concatenating them with crossfade transitions.
 *
 * Flow:
 *  1. Gemini text model converts script → English search keywords per scene
 *  2. For each scene, try multiple search strategies:
 *     a. Full keyword on Pexels (e.g. "tired person desk")
 *     b. Simplified keyword on Pexels (e.g. "tired person")
 *     c. Single word on Pexels (e.g. "tired")
 *     d. Full keyword on Pixabay (fallback provider)
 *     e. Gemini AI image (last resort)
 *  3. Concatenate all clips with FFmpeg xfade transitions
 */
async function generateWithPerScenePexels(
  prompt: string,
  style: string,
  durationSeconds: number,
  aspectRatio?: string,
  script?: string,
): Promise<Buffer> {
  const sceneCount = durationSeconds <= 15 ? 3 : durationSeconds <= 30 ? 4 : 5;
  const orientation = aspectRatio === '9:16' ? 'portrait' : aspectRatio === '1:1' ? 'square' : 'landscape';

  // Step 1: Generate scene keywords from script
  log.info({ sceneCount, durationSeconds, hasScript: !!script }, 'Step 1: Generating scene keywords from script');
  const scenes = await convertScriptToSearchKeywords(
    script || prompt,
    sceneCount,
    durationSeconds,
  );

  log.info({ scenes: scenes.map(s => ({ keyword: s.keyword, duration: s.durationSeconds })) }, 'Scene keywords generated');

  // Step 2: Search stock video providers for each scene
  log.info({ sceneCount: scenes.length }, 'Step 2: Searching stock video providers for scene clips');
  const clips: SceneClip[] = [];

  for (let idx = 0; idx < scenes.length; idx++) {
    const scene = scenes[idx];
    log.info({ scene: idx + 1, total: scenes.length, keyword: scene.keyword, duration: scene.durationSeconds }, 'Searching for scene clip');

    let result = await findBestClipForScene(scene.keyword, scene.durationSeconds, orientation);

    if (result) {
      log.info({ scene: idx + 1, keyword: scene.keyword, provider: 'stock-video', duration: result.duration }, 'Stock clip found');
      clips.push({
        downloadUrl: result.downloadUrl,
        durationSeconds: scene.durationSeconds,
        actualDuration: result.duration,
        keyword: scene.keyword,
      });
    } else {
      // Final fallback: Gemini AI image for this scene
      log.warn({ scene: idx + 1, keyword: scene.keyword }, 'No stock video found after all retries, falling back to Gemini image');
      try {
        const [imageBuffer] = await generateSceneImages({
          prompt: scene.keyword,
          style,
          count: 1,
          aspectRatio,
        });
        clips.push({
          downloadUrl: '',
          durationSeconds: scene.durationSeconds,
          actualDuration: scene.durationSeconds,
          keyword: scene.keyword,
          isFallbackImage: true,
          imageBuffer,
        });
      } catch (imgErr) {
        log.error({ err: imgErr, keyword: scene.keyword }, 'Gemini image fallback also failed, using solid color');
        clips.push({
          downloadUrl: '',
          durationSeconds: scene.durationSeconds,
          actualDuration: scene.durationSeconds,
          keyword: scene.keyword,
          isFallbackImage: true,
          imageBuffer: generateSolidColorPlaceholder(),
        });
      }
    }

    // Brief delay between API calls to respect rate limits
    await sleep(300);
  }

  // Step 3: Concatenate with crossfade transitions
  const stockClipCount = clips.filter(c => !c.isFallbackImage).length;
  log.info({
    clipCount: clips.length,
    stockClipCount,
    fallbackCount: clips.length - stockClipCount,
    keywords: clips.map(c => c.keyword),
  }, 'Step 3: Concatenating scene clips');

  return concatenateClipsWithCrossfade({
    clips,
    totalDurationSeconds: durationSeconds,
    aspectRatio,
    crossfadeDurationSeconds: 0.5,
  });
}

/**
 * Try multiple search strategies to find a stock video clip for a scene.
 * Returns the first successful match or null if all strategies fail.
 */
async function findBestClipForScene(
  keyword: string,
  targetDuration: number,
  orientation: 'landscape' | 'portrait' | 'square',
): Promise<{ downloadUrl: string; duration: number } | null> {
  const words = keyword.split(' ').filter(w => w.length >= 2);

  // Strategy 1: Full keyword on Pexels
  let result = await searchPexelsForClip(keyword, targetDuration, orientation);
  if (result) {
    log.debug({ keyword, strategy: 'pexels-full' }, 'Clip found');
    return result;
  }

  // Strategy 2: Two-word simplified keyword on Pexels
  if (words.length > 2) {
    const twoWord = words.slice(0, 2).join(' ');
    log.debug({ original: keyword, simplified: twoWord }, 'Trying 2-word keyword on Pexels');
    await sleep(200);
    result = await searchPexelsForClip(twoWord, targetDuration, orientation);
    if (result) return result;
  }

  // Strategy 3: Single main word on Pexels
  if (words.length > 1) {
    const singleWord = words[0];
    log.debug({ original: keyword, simplified: singleWord }, 'Trying single word on Pexels');
    await sleep(200);
    result = await searchPexelsForClip(singleWord, targetDuration, orientation);
    if (result) return result;
  }

  // Strategy 4: Full keyword on Pixabay
  log.debug({ keyword }, 'Trying keyword on Pixabay');
  await sleep(200);
  const pixabayResult = await searchPixabayForClip(keyword, targetDuration);
  if (pixabayResult) {
    log.debug({ keyword, strategy: 'pixabay-full' }, 'Clip found');
    return pixabayResult;
  }

  // Strategy 5: Simplified keyword on Pixabay
  if (words.length > 1) {
    const simplified = words[0];
    log.debug({ original: keyword, simplified }, 'Trying single word on Pixabay');
    await sleep(200);
    const pixSimple = await searchPixabayForClip(simplified, targetDuration);
    if (pixSimple) return pixSimple;
  }

  log.warn({ keyword }, 'All stock video search strategies exhausted');
  return null;
}

// ---------------------------------------------------------------------------
// Solid color placeholder (last resort fallback)
// ---------------------------------------------------------------------------

function generateSolidColorPlaceholder(): Buffer {
  // Minimal valid PNG: 1x1 pixel, dark purple (#6366F1)
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
}
