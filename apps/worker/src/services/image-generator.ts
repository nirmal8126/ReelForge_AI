import axios from 'axios';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'image-generator' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneImageOptions {
  prompt: string;
  script?: string;      // full script text — split into scenes for matched visuals
  style: string;
  count: number;        // 3-5 images
  aspectRatio?: string; // '9:16', '16:9', '1:1'
}

// ---------------------------------------------------------------------------
// Aspect ratio to pixel dimensions
// ---------------------------------------------------------------------------

function getImageDimensions(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16': return { width: 768, height: 1344 };
    case '1:1':  return { width: 1024, height: 1024 };
    case '16:9':
    default:     return { width: 1344, height: 768 };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate scene images using Gemini 2.5 Flash Image (gemini-2.5-flash-image).
 *
 * When a script is provided, splits it into scenes and generates
 * images that visually match each scene's content.
 * In DEV_MODE, returns solid-colour placeholder images.
 */
export async function generateSceneImages(opts: SceneImageOptions): Promise<Buffer[]> {
  const { prompt, script, style, count, aspectRatio } = opts;

  if (process.env.DEV_MODE === 'true') {
    log.info({ count }, 'DEV_MODE: Generating placeholder images');
    return generatePlaceholderImages(count);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const { width, height } = getImageDimensions(aspectRatio || '9:16');
  const images: Buffer[] = [];

  // Build scene-specific prompts from script or use generic ones
  let sceneDirections: string[];

  if (script) {
    // Step 1: Use Gemini text model to convert script into English visual descriptions
    sceneDirections = await convertScriptToVisualPrompts(apiKey, script, style, count);
  } else {
    sceneDirections = buildGenericSceneDirections(prompt, style, count);
  }

  log.info({ sceneCount: sceneDirections.length, hasScript: !!script }, 'Scene directions built');

  for (let i = 0; i < sceneDirections.length; i++) {
    try {
      log.info({ scene: i + 1, total: sceneDirections.length, direction: sceneDirections[i].substring(0, 100) }, 'Generating scene image');
      const imageBuffer = await generateSingleImage(apiKey, sceneDirections[i], width, height);
      images.push(imageBuffer);
    } catch (err) {
      log.warn({ scene: i + 1, err }, 'Failed to generate scene image, trying fallback prompt');
      // Retry with simpler prompt
      try {
        const simplePrompt = `${style} style scene: ${prompt}`;
        const imageBuffer = await generateSingleImage(apiKey, simplePrompt, width, height);
        images.push(imageBuffer);
      } catch (retryErr) {
        log.error({ scene: i + 1, err: retryErr }, 'Scene image generation failed completely');
        images.push(generateSolidImage());
      }
    }
  }

  log.info({ count: images.length }, 'Scene images generated');
  return images;
}

// ---------------------------------------------------------------------------
// Gemini 2.5 Flash Image Generation
// Uses the same API key as text generation (?key= in URL).
// Matches proven pattern from admin/marketing/generate-image route.
// ---------------------------------------------------------------------------

async function generateSingleImage(
  apiKey: string,
  prompt: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const model = 'gemini-2.5-flash-image';
  const ar = width > height ? '16:9' : width < height ? '9:16' : '1:1';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  log.debug({ model, aspectRatio: ar, promptLength: prompt.length }, 'Calling Gemini image generation');

  const response = await axios.post(
    url,
    {
      contents: [{
        role: 'user',
        parts: [{ text: `Generate a high-quality image (no text/words/letters in the image): ${prompt}` }],
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: ar,
        },
      },
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 90_000,
    },
  );

  // Extract image from response — Gemini returns camelCase keys (inlineData, mimeType)
  const parts = response.data?.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    throw new Error('No content returned from Gemini image generation');
  }

  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('image/')) {
      log.info({ mimeType: part.inlineData.mimeType }, 'Gemini image generated');
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }

  throw new Error('No image found in Gemini response parts');
}

// ---------------------------------------------------------------------------
// Script → Visual Descriptions (Gemini Text Model)
// ---------------------------------------------------------------------------

/**
 * Use Gemini text model to convert a script (in any language) into
 * detailed English visual/image descriptions for each scene.
 *
 * Example input (Hindi script):
 *   "ऊर्जा की कमी महसूस हो रही है?"
 *   "एक गिलास पानी पिएँ"
 *   "कुछ हल्के स्ट्रेच करें"
 *
 * Example output (English visual prompts):
 *   "A tired person sitting at a desk rubbing their eyes, dim lighting"
 *   "A person drinking a fresh glass of water, bright kitchen, healthy lifestyle"
 *   "A person doing gentle stretching exercises in a living room, morning light"
 */
async function convertScriptToVisualPrompts(
  apiKey: string,
  script: string,
  style: string,
  count: number,
): Promise<string[]> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemPrompt = `You are a visual director for short-form video reels. Your job is to convert a voiceover script into exactly ${count} detailed English image descriptions that will be used to generate AI images for each scene of the video.

Rules:
- Output EXACTLY ${count} image descriptions, one per line
- Each description must be a detailed visual/cinematic scene description in English
- Describe what should be SHOWN visually (people, objects, settings, actions, mood, lighting)
- Use "${style}" visual style throughout
- Do NOT include any dialogue, text, or words in the descriptions — only visual elements
- Each description should be 1-2 sentences, very specific and vivid
- The scenes should flow naturally as a visual story matching the script narration
- Include camera angle suggestions (wide shot, close-up, etc.)

Output format: Return ONLY the ${count} descriptions, one per line. No numbering, no bullets, no extra text.`;

  const userMessage = `Convert this voiceover script into ${count} visual scene descriptions:\n\n${script}`;

  log.info({ model, sceneCount: count }, 'Converting script to visual descriptions via Gemini text');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: userMessage }],
        }],
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      log.warn({ status: response.status, errData }, 'Gemini text API failed for scene conversion');
      throw new Error(`Gemini text API returned ${response.status}`);
    }

    const data: any = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No text returned from Gemini for scene conversion');
    }

    // Parse the response into individual scene descriptions
    const descriptions = text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 10); // filter out empty/very short lines

    log.info({ requestedCount: count, parsedCount: descriptions.length }, 'Visual descriptions parsed');

    // Ensure we have exactly `count` descriptions
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      if (i < descriptions.length) {
        result.push(`${style} style. ${descriptions[i]} High quality, cinematic lighting, photorealistic. No text or letters in the image.`);
      } else {
        // Repeat last description if we got fewer than needed
        const lastDesc = descriptions[descriptions.length - 1] || `${style} scene`;
        result.push(`${style} style. ${lastDesc} High quality, cinematic lighting, photorealistic. No text or letters in the image.`);
      }
    }

    return result;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : err }, 'Scene conversion failed, using fallback prompts');
    // Fallback: use generic prompts based on the original script topic
    return buildGenericSceneDirections(script.substring(0, 200), style, count);
  }
}

// ---------------------------------------------------------------------------
// Scene direction builder — Generic (no script)
// ---------------------------------------------------------------------------

function buildGenericSceneDirections(prompt: string, style: string, count: number): string[] {
  const directions: string[] = [];

  const angles = [
    'establishing wide shot',
    'medium close-up shot',
    'dramatic angle',
    'detail close-up shot',
    'dynamic action shot',
  ];

  for (let i = 0; i < count; i++) {
    const angle = angles[i % angles.length];
    directions.push(
      `${style} style, ${angle}. Scene: ${prompt}. ` +
      `High quality, cinematic lighting, vibrant colors. Scene ${i + 1} of ${count}.`
    );
  }

  return directions;
}

// ---------------------------------------------------------------------------
// Placeholders (DEV_MODE / fallback)
// ---------------------------------------------------------------------------

function generatePlaceholderImages(count: number): Buffer[] {
  const images: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    images.push(generateSolidImage());
  }
  return images;
}

/**
 * Generate a minimal solid-colour PNG image (1x1 pixel, scales in FFmpeg).
 */
function generateSolidImage(): Buffer {
  // Minimal valid PNG: 1x1 pixel, dark purple (#6366F1)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  return png;
}
