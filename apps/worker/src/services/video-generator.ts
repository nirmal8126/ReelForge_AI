import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'video-generator' });

const RUNWAY_API_URL = 'https://api.dev.runwayml.com/v1';
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoGenerationOptions {
  prompt: string;
  style: string;
  durationSeconds: number;
  aspectRatio?: string; // '16:9' | '9:16' | '1:1'
}

interface RunwayTaskResponse {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  output?: string[];
  failure?: string;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

function getClient(): AxiosInstance {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a video clip using RunwayML Gen-3.
 *
 * 1. Initiates a generation task.
 * 2. Polls for completion at 5-second intervals (max 60 attempts / 5 min).
 * 3. Downloads the completed video.
 *
 * Returns raw video data as a Buffer.
 */
export async function generateVideo(opts: VideoGenerationOptions): Promise<Buffer> {
  const { prompt, style, durationSeconds, aspectRatio } = opts;

  // DEV_MODE: skip RunwayML entirely — throw to trigger fallback chain
  if (process.env.DEV_MODE === 'true') {
    log.info({ prompt: prompt.substring(0, 50) }, 'DEV_MODE: Skipping RunwayML (using stock/static fallback)');
    throw new Error('DEV_MODE: RunwayML skipped — falling back to stock footage or static image');
  }

  const client = getClient();

  // -----------------------------------------------------------------------
  // Step 1: Initiate generation
  // -----------------------------------------------------------------------
  log.info({ style, durationSeconds, aspectRatio }, 'Initiating RunwayML video generation');

  // Gen 4.5 only supports 5s or 10s durations
  const validDuration = durationSeconds <= 5 ? 5 : 10;

  // Map aspect ratio to RunwayML ratio format
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

  // -----------------------------------------------------------------------
  // Step 2: Poll for completion
  // -----------------------------------------------------------------------
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

      // -------------------------------------------------------------------
      // Step 3: Download completed video
      // -------------------------------------------------------------------
      const videoUrl = output[0];
      log.info({ taskId, videoUrl }, 'Downloading generated video');

      const downloadResponse = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
      });

      const videoBuffer = Buffer.from(downloadResponse.data);
      log.info({ taskId, videoSizeBytes: videoBuffer.length }, 'Video downloaded');

      return videoBuffer;
    }

    if (status === 'FAILED') {
      throw new Error(`Video generation failed: ${failure || 'Unknown error'}`);
    }

    // PENDING or PROCESSING — keep polling
  }

  throw new Error(
    `Video generation timed out after ${MAX_POLL_ATTEMPTS} attempts (${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s)`,
  );
}
