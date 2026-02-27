import { logger } from '../utils/logger';

const log = logger.child({ service: 'hashtag-generator' });

// ---------------------------------------------------------------------------
// Gemini API (native fetch)
// ---------------------------------------------------------------------------

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 256,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorBody.substring(0, 200)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  if (!content) throw new Error('No content in Gemini response');

  return content;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface HashtagInput {
  title: string;
  prompt?: string;
  style?: string;
  language?: string;
  category?: string;
  module: 'reel' | 'long_form' | 'quote' | 'challenge' | 'gameplay' | 'image_studio' | 'cartoon';
}

/**
 * Generate 15-20 relevant hashtags for a content piece using Gemini.
 * Returns a string like "#reels #viral #motivation ..."
 */
export async function generateHashtags(input: HashtagInput): Promise<string> {
  try {
    const moduleLabels: Record<string, string> = {
      reel: 'short-form vertical video reel',
      long_form: 'long-form YouTube video',
      quote: 'motivational quote image/video',
      challenge: 'interactive challenge/quiz video',
      gameplay: 'gameplay recording video',
      image_studio: 'AI-generated image/video',
      cartoon: 'animated cartoon episode',
    };

    const prompt = `Generate 15-20 trending social media hashtags for the following content.

Content type: ${moduleLabels[input.module] || input.module}
Title: ${input.title}
${input.prompt ? `Topic: ${input.prompt}` : ''}
${input.style ? `Style: ${input.style}` : ''}
${input.category ? `Category: ${input.category}` : ''}
${input.language && input.language !== 'en' ? `Language: ${input.language} (include some hashtags in this language)` : ''}

Rules:
- Return ONLY hashtags separated by spaces, nothing else
- Each hashtag must start with #
- Mix broad/popular hashtags (e.g. #viral #trending) with niche-specific ones
- Include platform hashtags like #reels #shorts #youtube where relevant
- Keep hashtags lowercase, no special characters
- Do NOT include numbering or explanations`;

    const result = await callGemini(prompt);

    // Clean up: extract only valid hashtags
    const hashtags = result
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter((t) => t.startsWith('#') && t.length > 1)
      .map((t) => t.toLowerCase().replace(/[^a-z0-9#_\u0900-\u097F\u0A00-\u0A7F\u0980-\u09FF\u0B80-\u0BFF\u0C00-\u0C7F]/g, ''))
      .filter((t) => t.length > 1)
      .slice(0, 20);

    if (hashtags.length < 5) {
      throw new Error('Too few hashtags generated');
    }

    const hashtagString = hashtags.join(' ');
    log.info({ module: input.module, count: hashtags.length }, 'Hashtags generated');
    return hashtagString;
  } catch (err) {
    log.warn({ err, module: input.module }, 'Hashtag generation failed, using fallback');
    return getFallbackHashtags(input);
  }
}

// ---------------------------------------------------------------------------
// Fallback hashtags per module
// ---------------------------------------------------------------------------

function getFallbackHashtags(input: HashtagInput): string {
  const base = '#viral #trending #fyp #explore #content #ai';

  const moduleHashtags: Record<string, string> = {
    reel: '#reels #shorts #reelsinstagram #shortsvideo #reelsviral #instareels #shortsyoutube #viralreels',
    long_form: '#youtube #video #longform #youtubevideo #educational #documentary #watchnow #subscribe',
    quote: '#quotes #motivation #inspiration #motivationalquotes #dailyquotes #quotesoftheday #wisdom #mindset',
    challenge: '#challenge #quiz #trivia #brainteaser #puzzles #riddles #funquiz #testyourknowledge',
    gameplay: '#gaming #gameplay #gamer #mobilegaming #gamingvideos #indiegame #gamedev #playnow',
    image_studio: '#aiart #digitalart #aigenerated #creative #artwork #design #visualart #aesthetic',
    cartoon: '#cartoon #animation #animated #cartoonvideo #animatedstory #kids #storytelling #toons',
  };

  return `${base} ${moduleHashtags[input.module] || ''}`.trim();
}
