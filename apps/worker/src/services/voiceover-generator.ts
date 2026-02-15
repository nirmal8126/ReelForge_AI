import axios from 'axios';
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
 * Uses the eleven_turbo_v2 model for fast, high-quality TTS.
 * Returns raw audio data as a Buffer (mpeg format).
 */
export async function generateVoiceover(opts: VoiceoverOptions): Promise<Buffer> {
  const { script, voiceId, language } = opts;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set');
  }

  log.info({ voiceId, language, scriptLength: script.length }, 'Generating voiceover via ElevenLabs');

  const requestBody: Record<string, unknown> = {
    text: script,
    model_id: 'eleven_turbo_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.0,
      use_speaker_boost: true,
    },
  };

  // Add language parameter if not English
  if (language && language !== 'en') {
    requestBody.language_code = language;
  }

  const response = await axios.post(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
    requestBody,
    {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'arraybuffer',
      timeout: 30_000, // 30s timeout
    },
  );

  const audioBuffer = Buffer.from(response.data);

  log.info(
    { voiceId, language, audioSizeBytes: audioBuffer.length, contentType: response.headers['content-type'] },
    'Voiceover generated successfully',
  );

  return audioBuffer;
}
