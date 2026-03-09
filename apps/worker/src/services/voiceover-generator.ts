import axios from 'axios';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'voiceover-generator' });

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoiceoverOptions {
  script: string;
  voiceId: string;
  language?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a voiceover audio buffer using ElevenLabs text-to-speech.
 *
 * In DEV_MODE, generates a silent audio track via FFmpeg to avoid burning
 * real ElevenLabs credits during development.
 */
export async function generateVoiceover(opts: VoiceoverOptions): Promise<Buffer> {
  const { script, voiceId, language } = opts;

  // DEV_MODE: generate silent audio instead of calling ElevenLabs
  if (process.env.DEV_MODE === 'true') {
    log.info({ scriptLength: script.length }, 'DEV_MODE: Generating silent audio (skipping ElevenLabs)');
    return generateSilentAudio(script);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    log.warn('ELEVENLABS_API_KEY is not set, generating silent audio fallback');
    return generateSilentAudio(script);
  }

  log.info({ voiceId, language, scriptLength: script.length }, 'Generating voiceover via ElevenLabs');

  // Use multilingual model for non-English languages
  const isEnglish = !language || language === 'en';
  const modelId = isEnglish ? 'eleven_turbo_v2' : 'eleven_multilingual_v2';

  const requestBody: Record<string, unknown> = {
    text: script,
    model_id: modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.0,
      use_speaker_boost: true,
    },
  };

  // Add language_code for multilingual model
  if (!isEnglish) {
    requestBody.language_code = language;
  }

  let response;
  try {
    response = await axios.post(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      requestBody,
      {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
        timeout: 180_000, // 3 min timeout for long-form scripts
      },
    );
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response) {
      const errorText = Buffer.from(err.response.data).toString('utf-8');
      log.error({ status: err.response.status, body: errorText, voiceId, modelId, language }, 'ElevenLabs API error');
      throw new Error(`ElevenLabs API error ${err.response.status}: ${errorText}`);
    }
    throw err;
  }

  const audioBuffer = Buffer.from(response.data);

  log.info(
    { voiceId, language, audioSizeBytes: audioBuffer.length, contentType: response.headers['content-type'] },
    'Voiceover generated successfully',
  );

  return audioBuffer;
}

// ---------------------------------------------------------------------------
// Dev Mode: Silent Audio Generator
// ---------------------------------------------------------------------------

/**
 * Generate a silent MP3 audio file using FFmpeg.
 * Duration estimated from script word count (~150 words/min).
 */
function generateSilentAudio(script: string): Buffer {
  const wordCount = script.split(/\s+/).length;
  const durationSeconds = Math.max(30, Math.ceil((wordCount / 150) * 60));

  const tmpFile = path.join(os.tmpdir(), `dev-silent-${Date.now()}.mp3`);

  try {
    execSync(
      `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t ${durationSeconds} -q:a 9 "${tmpFile}"`,
      { timeout: 30_000, stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 }
    );

    const buffer = fs.readFileSync(tmpFile);
    log.info({ durationSeconds, wordCount, audioSizeBytes: buffer.length }, 'DEV_MODE: Silent audio generated');
    return buffer;
  } catch {
    // Fallback: minimal valid MP3 buffer (silence frames)
    log.warn('DEV_MODE: FFmpeg silent audio failed, using minimal MP3 buffer');
    return createMinimalMp3(durationSeconds);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Create a minimal valid MP3 buffer with silence frames.
 */
function createMinimalMp3(durationSeconds: number): Buffer {
  // MPEG1 Layer3, 128kbps, 44100Hz mono silence frame header
  const frameHeader = Buffer.from([0xFF, 0xFB, 0x90, 0x00]);
  const frameData = Buffer.alloc(413, 0);
  const singleFrame = Buffer.concat([frameHeader, frameData]);

  // ~38 frames per second at 128kbps
  const frameCount = Math.ceil(durationSeconds * 38);
  const frames = Array(frameCount).fill(singleFrame);
  return Buffer.concat(frames);
}
