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
 * Generate a silent audio buffer for the given duration.
 * Used when voiceEnabled=false — video plays with music only, no narration.
 */
export function generateSilentAudioForDuration(durationSeconds: number): Buffer {
  const tmpFile = path.join(os.tmpdir(), `silent-${Date.now()}.mp3`);
  try {
    execSync(
      `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t ${durationSeconds} -q:a 9 "${tmpFile}"`,
      { timeout: 30_000, stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 },
    );
    const buffer = fs.readFileSync(tmpFile);
    log.info({ durationSeconds, audioSizeBytes: buffer.length }, 'Silent audio generated (no voice mode)');
    return buffer;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

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

      // Fallback to Google TTS if ElevenLabs fails
      log.info('Attempting Google TTS fallback...');
      try {
        return await generateWithGoogleTTS(script, language);
      } catch (fallbackErr) {
        log.error({ err: fallbackErr }, 'Google TTS fallback also failed');
        throw new Error(`ElevenLabs API error ${err.response.status}: ${errorText}`);
      }
    }
    // For non-API errors (timeout, network), also try Google TTS
    log.info('ElevenLabs request failed, attempting Google TTS fallback...');
    try {
      return await generateWithGoogleTTS(script, language);
    } catch (fallbackErr) {
      log.error({ err: fallbackErr }, 'Google TTS fallback also failed');
      throw err;
    }
  }

  const audioBuffer = Buffer.from(response.data);

  log.info(
    { voiceId, language, audioSizeBytes: audioBuffer.length, contentType: response.headers['content-type'] },
    'Voiceover generated successfully',
  );

  return audioBuffer;
}

// ---------------------------------------------------------------------------
// Google TTS Fallback (uses Gemini API)
// ---------------------------------------------------------------------------

const GOOGLE_TTS_VOICES: Record<string, string> = {
  en: 'en-US-Standard-D',
  hi: 'hi-IN-Standard-D',
  es: 'es-ES-Standard-B',
  fr: 'fr-FR-Standard-D',
  de: 'de-DE-Standard-D',
  pt: 'pt-BR-Standard-B',
  ja: 'ja-JP-Standard-D',
  ko: 'ko-KR-Standard-D',
  zh: 'cmn-CN-Standard-D',
  ar: 'ar-XA-Standard-D',
  ru: 'ru-RU-Standard-D',
  it: 'it-IT-Standard-D',
};

async function generateWithGoogleTTS(script: string, language?: string): Promise<Buffer> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY not set for Google TTS fallback');
  }

  const lang = language || 'en';
  const voiceName = GOOGLE_TTS_VOICES[lang] || GOOGLE_TTS_VOICES['en'];

  log.info({ language: lang, voiceName, scriptLength: script.length }, 'Generating voiceover via Gemini TTS');

  // Use Gemini 2.5 Flash TTS via generateContent with audio output
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiKey}`,
      {
        contents: [{ parts: [{ text: script }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: lang === 'hi' ? 'Puck' : lang === 'es' ? 'Kore' : 'Kore',
              },
            },
          },
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 180_000,
      },
    );

    const audioData = response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error('Gemini TTS returned no audio data');
    }

    // Gemini returns PCM audio, convert to MP3 via ffmpeg
    const pcmBuffer = Buffer.from(audioData, 'base64');
    const tmpPcm = path.join(os.tmpdir(), `gemini-tts-${Date.now()}.pcm`);
    const tmpMp3 = path.join(os.tmpdir(), `gemini-tts-${Date.now()}.mp3`);

    try {
      fs.writeFileSync(tmpPcm, pcmBuffer);
      execSync(
        `ffmpeg -y -f s16le -ar 24000 -ac 1 -i "${tmpPcm}" -codec:a libmp3lame -b:a 128k "${tmpMp3}"`,
        { timeout: 60_000, stdio: 'pipe' },
      );
      const mp3Buffer = fs.readFileSync(tmpMp3);
      log.info({ audioSizeBytes: mp3Buffer.length, voiceName }, 'Gemini TTS voiceover generated successfully');
      return mp3Buffer;
    } finally {
      try { fs.unlinkSync(tmpPcm); } catch { /* ignore */ }
      try { fs.unlinkSync(tmpMp3); } catch { /* ignore */ }
    }
  } catch (geminiErr: unknown) {
    log.error({ err: geminiErr }, 'Gemini TTS failed, trying Google Cloud TTS API');
  }

  // Fallback: Google Cloud TTS API
  const langCode = voiceName.split('-').slice(0, 2).join('-');
  const response = await axios.post(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${geminiKey}`,
    {
      input: { text: script },
      voice: {
        languageCode: langCode,
        name: voiceName,
        ssmlGender: 'MALE',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0,
      },
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 180_000,
    },
  );

  if (!response.data.audioContent) {
    throw new Error('Google TTS returned empty audio');
  }

  const audioBuffer = Buffer.from(response.data.audioContent, 'base64');
  log.info({ audioSizeBytes: audioBuffer.length, voiceName }, 'Google Cloud TTS voiceover generated successfully');
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
