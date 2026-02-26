import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { downloadStockFootage } from './stock-footage';
import { generateSceneImages } from './image-generator';
import { composeImagesIntoVideo } from './image-video-composer';

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
 * 1. DEV_MODE → placeholder (Gemini images or solid color)
 * 2. NODE_ENV=development → skip RunwayML, use free providers only
 * 3. Premium plans (STARTER+) + RUNWAY_API_KEY → RunwayML AI video
 * 4. Pexels/Pixabay stock footage (free, requires PEXELS_API_KEY)
 * 5. Gemini AI images + FFmpeg Ken Burns composition (fallback)
 */
export async function generateVideo(opts: VideoGenerationOptions): Promise<Buffer> {
  const { prompt, script, style, durationSeconds, aspectRatio, plan } = opts;

  // DEV_MODE: use Gemini images or placeholder
  if (process.env.DEV_MODE === 'true') {
    log.info({ prompt: prompt.substring(0, 50) }, 'DEV_MODE: Using image-based video generation');
    return generateWithGeminiImages(prompt, style, durationSeconds, aspectRatio, script);
  }

  // Premium users: try RunwayML first (skip in development)
  const isPremium = plan && PREMIUM_PLANS.includes(plan);
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    log.info('NODE_ENV=development — skipping RunwayML, using free providers');
  } else if (isPremium && process.env.RUNWAY_API_KEY) {
    try {
      log.info({ plan }, 'Premium plan — trying RunwayML');
      return await generateWithRunway(prompt, style, durationSeconds, aspectRatio);
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : err }, 'RunwayML failed, falling back to stock footage');
    }
  } else {
    log.info({ plan: plan || 'FREE' }, 'Free plan — skipping RunwayML');
  }

  // Try Pexels/Pixabay stock footage
  try {
    return await generateWithStockFootage(prompt, durationSeconds, script);
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : err }, 'Stock footage failed, falling back to Gemini images');
  }

  // Final fallback: Gemini AI images + FFmpeg composition
  return generateWithGeminiImages(prompt, style, durationSeconds, aspectRatio, script);
}

// ---------------------------------------------------------------------------
// Provider 1: RunwayML (Premium only)
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
// Provider 2: Pexels/Pixabay stock footage
// ---------------------------------------------------------------------------

async function generateWithStockFootage(
  prompt: string,
  durationSeconds: number,
  script?: string,
): Promise<Buffer> {
  // Extract a better search query from the script if available
  const searchQuery = script
    ? extractStockSearchQuery(script, prompt)
    : prompt.substring(0, 100);

  log.info({ searchQuery }, 'Searching for stock footage');

  const videoUrl = await downloadStockFootage({
    query: searchQuery,
    durationSeconds,
  });

  // downloadStockFootage returns a placeholder image URL if no stock found
  if (videoUrl.includes('placeholder.com') || !videoUrl.startsWith('http')) {
    throw new Error('No suitable stock footage found');
  }

  log.info({ videoUrl }, 'Downloading stock footage');

  const response = await axios.get(videoUrl, {
    responseType: 'arraybuffer',
    timeout: 60_000,
  });

  const videoBuffer = Buffer.from(response.data);
  log.info({ videoSizeBytes: videoBuffer.length }, 'Stock footage downloaded');

  return videoBuffer;
}

/**
 * Extract a concise English search query from script content for stock footage APIs.
 * Stock footage APIs work best with short English keywords.
 */
function extractStockSearchQuery(script: string, fallbackPrompt: string): string {
  // Use the original prompt as the primary search term (it's usually in English or short)
  // but enhance it with key visual terms from the script
  return fallbackPrompt.substring(0, 100);
}

// ---------------------------------------------------------------------------
// Provider 3: Gemini AI images + FFmpeg composition
// ---------------------------------------------------------------------------

async function generateWithGeminiImages(
  prompt: string,
  style: string,
  durationSeconds: number,
  aspectRatio?: string,
  script?: string,
): Promise<Buffer> {
  // Generate 3-5 images based on duration
  const imageCount = durationSeconds <= 15 ? 3 : durationSeconds <= 30 ? 4 : 5;

  log.info({ imageCount, durationSeconds, aspectRatio, hasScript: !!script }, 'Generating scene images with Gemini');

  const imageBuffers = await generateSceneImages({
    prompt,
    script,
    style,
    count: imageCount,
    aspectRatio,
  });

  log.info({ generatedImages: imageBuffers.length }, 'Composing images into video');

  const videoBuffer = await composeImagesIntoVideo({
    imageBuffers,
    durationSeconds,
    aspectRatio,
    transitionStyle: 'fade',
  });

  return videoBuffer;
}
