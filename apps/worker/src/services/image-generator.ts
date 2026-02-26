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
  const sceneDirections = script
    ? buildSceneDirectionsFromScript(script, style, count)
    : buildGenericSceneDirections(prompt, style, count);

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
// Scene direction builder — Script-based (scene-matched)
// ---------------------------------------------------------------------------

/**
 * Split script into logical scene groups and create visual prompts
 * that match each scene's actual content.
 *
 * For a script like:
 *   "ऊर्जा की कमी महसूस हो रही है?"     → image of a tired person
 *   "एक गिलास पानी पिएँ"                → image of drinking water
 *   "कुछ हल्के स्ट्रेच करें"              → image of stretching
 *
 * Each image will visually represent that part of the narration.
 */
function buildSceneDirectionsFromScript(script: string, style: string, count: number): string[] {
  // Split script into individual lines (sentences)
  const lines = script
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return buildGenericSceneDirections(script, style, count);
  }

  // Group lines into `count` scene groups
  const sceneGroups = groupLinesIntoScenes(lines, count);

  log.info({ totalLines: lines.length, sceneGroups: sceneGroups.length }, 'Script split into scene groups');

  const directions: string[] = [];
  const angles = [
    'establishing wide shot',
    'medium close-up',
    'dramatic angle',
    'detail close-up',
    'dynamic action shot',
  ];

  for (let i = 0; i < sceneGroups.length; i++) {
    const sceneText = sceneGroups[i].join(' ');
    const angle = angles[i % angles.length];

    // Create a visual description prompt from the scene text
    const visualPrompt = [
      `${style} style, ${angle}.`,
      `Visually illustrate this scene: "${sceneText}".`,
      `High quality, cinematic lighting, vibrant colors, photorealistic.`,
      `No text, no words, no letters, no subtitles in the image.`,
    ].join(' ');

    directions.push(visualPrompt);
  }

  return directions;
}

/**
 * Distribute script lines evenly across N scene groups.
 *
 * Example: 10 lines, 4 groups → [3, 3, 2, 2] lines per group
 */
function groupLinesIntoScenes(lines: string[], count: number): string[][] {
  const groups: string[][] = [];
  const linesPerGroup = Math.max(1, Math.ceil(lines.length / count));

  for (let i = 0; i < count; i++) {
    const start = i * linesPerGroup;
    const end = Math.min(start + linesPerGroup, lines.length);
    if (start < lines.length) {
      groups.push(lines.slice(start, end));
    }
  }

  // If we got fewer groups than requested (very short script), fill with last group repeated
  while (groups.length < count && groups.length > 0) {
    groups.push(groups[groups.length - 1]);
  }

  return groups;
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
