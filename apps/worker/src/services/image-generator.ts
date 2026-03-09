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
    log.warn({ count }, 'GEMINI_API_KEY is not set, returning placeholder images');
    return generatePlaceholderImages(count);
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
    // Delay between API calls to avoid Gemini rate limits (skip first)
    if (i > 0) {
      await new Promise(r => setTimeout(r, 2000));
    }

    try {
      log.info({ scene: i + 1, total: sceneDirections.length, direction: sceneDirections[i].substring(0, 100) }, 'Generating scene image');
      const imageBuffer = await generateSingleImage(apiKey, sceneDirections[i], width, height);
      images.push(imageBuffer);
    } catch (err) {
      log.warn({ scene: i + 1, err }, 'Failed to generate scene image, trying fallback prompt');
      // Wait before retry
      await new Promise(r => setTimeout(r, 3000));
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

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 5_000; // 5s initial backoff for rate limits

async function generateSingleImage(
  apiKey: string,
  prompt: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const model = 'gemini-2.5-flash-image';
  const ar = width > height ? '16:9' : width < height ? '9:16' : '1:1';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      log.debug({ model, aspectRatio: ar, promptLength: prompt.length, attempt }, 'Calling Gemini image generation');

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
    } catch (err: any) {
      const status = err?.response?.status;
      const isRateLimit = status === 429 || status === 503;

      if (isRateLimit && attempt < MAX_RETRIES) {
        // Exponential backoff: 5s, 10s, 20s
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        log.warn({ status, attempt, delayMs: delay }, 'Rate limited by Gemini, retrying after backoff');
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Not a rate limit or max retries exhausted
      throw err;
    }
  }

  throw new Error('Image generation failed after all retries');
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
// Script → Pexels Search Keywords (Gemini Text Model)
// ---------------------------------------------------------------------------

export interface SceneKeyword {
  keyword: string;          // e.g. "morning coffee", "person stretching"
  durationSeconds: number;  // how long this scene should last
}

/**
 * Use Gemini text model to convert a voiceover script (in any language)
 * into short English search keywords optimized for Pexels stock video search.
 *
 * Approach:
 *  1. Split the script into N scene chunks (by sentences)
 *  2. Label each chunk explicitly in the prompt so Gemini matches each part
 *  3. Validate and sanitize keywords
 *  4. Fall back to generic keywords for any scene that fails
 *
 * Example input (Hindi script about energy tips):
 *   → [{ keyword: "tired person desk", duration: 5 },
 *      { keyword: "drinking water glass", duration: 5 },
 *      { keyword: "stretching exercise", duration: 5 }]
 */
export async function convertScriptToSearchKeywords(
  script: string,
  sceneCount: number,
  totalDurationSeconds: number,
): Promise<SceneKeyword[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    log.warn('GEMINI_API_KEY not set, using fallback keywords');
    return buildFallbackKeywords(script, sceneCount, totalDurationSeconds);
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const perScene = Math.ceil(totalDurationSeconds / sceneCount);

  // Step 1: Split script into scene chunks so Gemini knows which part = which scene
  const sceneChunks = splitScriptIntoScenes(script, sceneCount);
  log.info({ sceneCount, chunks: sceneChunks.map(c => c.substring(0, 60)) }, 'Script split into scene chunks');

  // Step 2: Build prompt with explicit scene labels
  const labeledScenes = sceneChunks.map((chunk, i) =>
    `SCENE ${i + 1} (${perScene} seconds):\n${chunk}`
  ).join('\n\n');

  const systemPrompt = `You are a stock footage search specialist. For each labeled SCENE below, output ONE search keyword that can find a matching stock video clip on Pexels.com.

RULES:
- Output EXACTLY ${sceneCount} lines
- Format per line: keyword | duration_seconds
- Each keyword = 2-3 SIMPLE English words describing something a CAMERA CAN FILM
- The keyword must visually represent what is being said in that scene
- The script may be in Hindi or other languages — translate the VISUAL MEANING to English

GOOD keywords (filmable scenes):
woman drinking water, person running park, office desk laptop, cooking kitchen,
doctor patient, happy family dinner, sunrise mountains, busy city traffic,
child playing, gym workout, fresh vegetables, sleeping person bed,
woman stretching, man reading book, friends laughing, typing keyboard

BAD keywords (abstract/unfindable):
motivation, success, energy boost, health tips, confidence, mindset,
productivity, life balance, self improvement, growth, wellness journey

Output ONLY the ${sceneCount} lines. No numbering, bullets, markdown, or extra text.`;

  const userMessage = `For each scene below, give me ONE stock video search keyword:\n\n${labeledScenes}`;

  log.info({ model, sceneCount, totalDurationSeconds, scriptLength: script.length }, 'Converting script to search keywords via Gemini');

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
          temperature: 0.3,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      log.error({ status: response.status, body: errBody.substring(0, 200) }, 'Gemini keyword API failed');
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const data: any = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No text returned from Gemini');
    }

    log.info({ rawGeminiResponse: text }, 'Gemini keyword response received');

    // Step 3: Parse and validate keywords
    const scenes = parseAndValidateKeywords(text, sceneCount, perScene);

    log.info({ scenes }, 'Final validated search keywords');
    return scenes;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : err }, 'Keyword conversion failed, using fallbacks');
    return buildFallbackKeywords(script, sceneCount, totalDurationSeconds);
  }
}

// ---------------------------------------------------------------------------
// Script Scene Splitter
// ---------------------------------------------------------------------------

/**
 * Split a script into N roughly equal scene chunks.
 * Splits by sentence boundaries (periods, question marks, newlines)
 * then groups sentences into N chunks.
 */
function splitScriptIntoScenes(script: string, sceneCount: number): string[] {
  // Split by sentence-ending punctuation or newlines (works for any language)
  const sentences = script
    .split(/(?<=[।.?!?\n])\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length <= sceneCount) {
    // Fewer sentences than scenes — pad with empty to reach sceneCount
    const chunks = [...sentences];
    while (chunks.length < sceneCount) {
      chunks.push(sentences[sentences.length - 1] || script.substring(0, 100));
    }
    return chunks;
  }

  // Group sentences into N roughly equal chunks
  const chunks: string[] = [];
  const perChunk = Math.ceil(sentences.length / sceneCount);

  for (let i = 0; i < sceneCount; i++) {
    const start = i * perChunk;
    const end = Math.min(start + perChunk, sentences.length);
    chunks.push(sentences.slice(start, end).join(' '));
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Keyword Parser & Validator
// ---------------------------------------------------------------------------

/**
 * Parse Gemini response into SceneKeyword[] with validation.
 * Strips markdown, validates keywords are English, replaces bad keywords.
 */
function parseAndValidateKeywords(text: string, sceneCount: number, perSceneDuration: number): SceneKeyword[] {
  // Strip common markdown artifacts
  const cleaned = text
    .replace(/\*\*/g, '')     // bold
    .replace(/\*/g, '')       // italic
    .replace(/`/g, '')        // backticks
    .replace(/^#+\s*/gm, '') // headings
    .replace(/^[-•]\s*/gm, ''); // bullets

  // Parse "keyword | duration" lines
  const lines = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 3);

  const scenes: SceneKeyword[] = [];

  for (const line of lines) {
    if (scenes.length >= sceneCount) break;

    let keyword: string;
    let duration: number;

    if (line.includes('|')) {
      const [kw, dur] = line.split('|').map(s => s.trim());
      keyword = sanitizeKeyword(kw);
      duration = Math.max(3, Math.min(10, parseInt(dur) || perSceneDuration));
    } else {
      // Line without | separator — treat whole line as keyword
      keyword = sanitizeKeyword(line);
      duration = perSceneDuration;
    }

    if (keyword.length >= 3 && isValidStockKeyword(keyword)) {
      scenes.push({ keyword, durationSeconds: duration });
    } else {
      log.debug({ rejected: keyword, original: line }, 'Keyword rejected by validation');
    }
  }

  // Fill any missing scenes with generic keywords
  const genericPool = [
    'person talking', 'city skyline', 'nature landscape', 'office work',
    'people walking', 'sunrise timelapse', 'cooking food', 'workout fitness',
    'happy people', 'technology computer', 'busy street', 'ocean waves',
  ];

  while (scenes.length < sceneCount) {
    const fallback = genericPool[scenes.length % genericPool.length];
    log.warn({ index: scenes.length, fallback }, 'Using generic fallback for missing scene keyword');
    scenes.push({ keyword: fallback, durationSeconds: perSceneDuration });
  }

  return scenes;
}

/**
 * Clean up a raw keyword string from Gemini output.
 */
function sanitizeKeyword(raw: string): string {
  return raw
    .replace(/^\d+[\.\)\-:]\s*/, '')  // strip numbering (1. 2) 3- 4:)
    .replace(/['""`]/g, '')            // strip quotes
    .replace(/\*+/g, '')              // strip markdown bold/italic
    .replace(/[^\x20-\x7E]/g, '')     // strip non-ASCII (keeps English only)
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim()
    .toLowerCase()
    .substring(0, 50);
}

/**
 * Check if a keyword is likely to return stock footage results.
 * Rejects abstract concepts, single characters, etc.
 */
function isValidStockKeyword(keyword: string): boolean {
  // Must have at least 2 words for better search results
  const wordCount = keyword.split(' ').filter(w => w.length >= 2).length;
  if (wordCount < 1) return false;

  // Reject known abstract concepts that never have stock footage
  const abstractTerms = [
    'motivation', 'success', 'confidence', 'mindset', 'productivity',
    'self improvement', 'growth', 'wellness', 'energy boost', 'life balance',
    'health tips', 'positivity', 'abundance', 'manifestation', 'affirmation',
  ];
  if (abstractTerms.some(term => keyword.includes(term))) return false;

  // Must be primarily English letters (at least 70% of characters)
  const letterCount = (keyword.match(/[a-z]/g) || []).length;
  if (letterCount / keyword.length < 0.7) return false;

  return true;
}

/**
 * Fallback when Gemini is unavailable: extract simple keywords from script.
 * Tries to pick meaningful English nouns/phrases; defaults to generic categories.
 */
function buildFallbackKeywords(script: string, sceneCount: number, totalDuration: number): SceneKeyword[] {
  const perScene = Math.ceil(totalDuration / sceneCount);

  // Generic fallback categories that always have Pexels results
  const genericPool = [
    'person talking', 'city skyline', 'nature landscape', 'office work',
    'people walking', 'sunrise timelapse', 'cooking food', 'workout fitness',
    'happy people', 'technology computer', 'busy street', 'ocean waves',
  ];

  // Try to extract English words from the script (skip non-latin characters)
  const englishWords = script
    .replace(/[^\x20-\x7E]/g, ' ')  // keep only ASCII printable
    .split(/\s+/)
    .filter(w => w.length >= 3 && /^[a-zA-Z]+$/.test(w))
    .map(w => w.toLowerCase());

  // Build unique 2-word keyword combinations from English words found
  const usedKeywords: string[] = [];
  if (englishWords.length >= 2) {
    for (let i = 0; i < englishWords.length - 1 && usedKeywords.length < sceneCount; i++) {
      const kw = `${englishWords[i]} ${englishWords[i + 1]}`;
      if (!usedKeywords.includes(kw)) usedKeywords.push(kw);
    }
  }

  // Fill remaining with generic pool (different keyword per scene)
  const scenes: SceneKeyword[] = [];
  for (let i = 0; i < sceneCount; i++) {
    const keyword = usedKeywords[i] || genericPool[i % genericPool.length];
    scenes.push({ keyword, durationSeconds: perScene });
  }

  log.info({ scenes, source: usedKeywords.length > 0 ? 'script-extracted' : 'generic-pool' }, 'Fallback keywords built');
  return scenes;
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
