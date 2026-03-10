import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'cartoon-story-generator' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CartoonCharacterInfo {
  name: string;
  description?: string | null;
  personality?: string | null;
}

export interface CartoonStoryScene {
  description: string;
  visualPrompt: string;
  narration: string;
  dialogue: { characterName: string; text: string }[];
}

export interface CartoonStoryResult {
  scenes: CartoonStoryScene[];
  fullScript: string;
}

// ---------------------------------------------------------------------------
// AI Clients (lazy-initialised)
// ---------------------------------------------------------------------------

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return anthropicClient;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateCartoonStory(opts: {
  seriesName: string;
  seriesDescription?: string | null;
  targetAudience?: string | null;
  artStyle?: string | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  characters: CartoonCharacterInfo[];
  episodePrompt: string;
  language: string;
}): Promise<CartoonStoryResult> {
  // Try Gemini first (primary provider)
  if (process.env.GEMINI_API_KEY) {
    try {
      return await generateWithGemini(opts);
    } catch (err) {
      log.warn({ err }, 'Gemini story generation failed, trying Anthropic');
    }
  }

  // Try Anthropic as fallback
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await generateWithAnthropic(opts);
    } catch (err) {
      log.warn({ err }, 'Anthropic story generation failed, falling back to mock');
    }
  }

  // Fallback to mock
  log.warn('No AI provider available, using mock story');
  return generateMockStory(opts.characters, opts.language);
}

// ---------------------------------------------------------------------------
// Anthropic Implementation
// ---------------------------------------------------------------------------

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese (Mandarin)',
  ar: 'Arabic',
  ru: 'Russian',
  tr: 'Turkish',
  nl: 'Dutch',
  pl: 'Polish',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  id: 'Indonesian',
  ms: 'Malay',
  th: 'Thai',
  vi: 'Vietnamese',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  ur: 'Urdu',
};

function getLanguageName(code: string): string {
  return LANGUAGE_MAP[code] || code;
}

async function generateWithAnthropic(opts: {
  seriesName: string;
  seriesDescription?: string | null;
  targetAudience?: string | null;
  artStyle?: string | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  characters: CartoonCharacterInfo[];
  episodePrompt: string;
  language: string;
}): Promise<CartoonStoryResult> {
  const client = getAnthropicClient();

  const languageName = getLanguageName(opts.language);

  const characterList = opts.characters
    .map((c) => `- ${c.name}: ${c.description || 'No description'}. Personality: ${c.personality || 'Not specified'}`)
    .join('\n');

  const systemPrompt = `You are an expert cartoon story writer for animated episodic content.
You write engaging, age-appropriate stories with vivid scene descriptions and natural dialogue.

CRITICAL LANGUAGE REQUIREMENT: You MUST write ALL story content in ${languageName}. All narration, dialogue, and descriptions MUST be in ${languageName}. Do NOT write in English (except visualPrompt). Only ${languageName} is acceptable for narration, dialogue, and description fields.

Series: "${opts.seriesName}"
${opts.seriesDescription ? `Series Description: ${opts.seriesDescription}` : ''}
${opts.targetAudience ? `Target Audience: ${opts.targetAudience}` : ''}
${opts.artStyle ? `Art Style: ${opts.artStyle}` : ''}
${opts.bannerUrl ? `Series Visual Theme: The series has an established visual banner representing its atmosphere and setting.` : ''}

Characters:
${characterList}

IMPORTANT RULES:
1. Write EXACTLY 5-7 scenes (no more!) that tell a complete story with beginning, middle, and end
2. Each scene must have a description, visual prompt (for image generation), narration, and dialogue
3. Use the characters by their exact names
4. Make dialogue natural and match each character's personality
5. Include a moral or lesson appropriate for the target audience
6. The visual prompt MUST be very detailed and include: character appearance details, the art style "${opts.artStyle || 'cartoon'}", background/setting details, lighting, mood, camera angle
7. Each visual prompt should describe the characters by their physical appearance (not just name) so the image AI knows what to draw
8. The LAST scene MUST be a CTA (Call to Action) scene — the narration should ask viewers to like, subscribe, share, and follow for more episodes of "${opts.seriesName}"

CRITICAL LENGTH RULES (for voice clarity):
- Narration: MAX 1-2 short sentences per scene (under 25 words). Keep it brief and clear.
- Dialogue: MAX 1-2 dialogue lines per scene. Each line MAX 12-15 words. Short, punchy, easy to understand when spoken aloud.
- Description: Keep brief (1 short sentence)
- Viewers listen to AI voice narration — long text sounds robotic and confusing. SHORT IS BETTER.

REMINDER: description, narration, and dialogue text MUST be in ${languageName}. Only visualPrompt should be in English.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "scenes": [
    {
      "description": "Brief scene description in ${languageName}",
      "visualPrompt": "Detailed image generation prompt in English — include character appearance, art style, setting, mood, camera angle",
      "narration": "Short narrator text in ${languageName} (1-2 sentences, under 25 words)",
      "dialogue": [
        { "characterName": "ExactName", "text": "Short line in ${languageName} (under 15 words)" }
      ]
    }
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: `Write an episode about: ${opts.episodePrompt}\n\nIMPORTANT: Write all narration, dialogue, and descriptions in ${languageName}. Only visualPrompt should be in English. Write EXACTLY 5-7 scenes (NOT more). Keep narration SHORT (1-2 sentences, under 25 words). Keep dialogue SHORT (1-2 lines per scene, under 15 words each). The LAST scene must be a CTA asking viewers to like, subscribe, and follow for more "${opts.seriesName}" episodes.` },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Anthropic');
  }

  // Parse JSON — handle possible markdown wrapping
  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonText);

  if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
    throw new Error('Invalid story format: missing scenes array');
  }

  // Build full script from narration + dialogue
  const fullScript = parsed.scenes
    .map((s: CartoonStoryScene, i: number) => {
      const lines = [`[Scene ${i + 1}: ${s.description}]`];
      if (s.narration) lines.push(`Narrator: ${s.narration}`);
      for (const d of s.dialogue) {
        lines.push(`${d.characterName}: ${d.text}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');

  log.info({ sceneCount: parsed.scenes.length }, 'Cartoon story generated via Anthropic');

  return { scenes: parsed.scenes, fullScript };
}

// ---------------------------------------------------------------------------
// Gemini Implementation
// ---------------------------------------------------------------------------

async function generateWithGemini(opts: {
  seriesName: string;
  seriesDescription?: string | null;
  targetAudience?: string | null;
  artStyle?: string | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  characters: CartoonCharacterInfo[];
  episodePrompt: string;
  language: string;
}): Promise<CartoonStoryResult> {
  const languageName = getLanguageName(opts.language);
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const apiKey = process.env.GEMINI_API_KEY!;

  const characterList = opts.characters
    .map((c) => `- ${c.name}: ${c.description || 'No description'}. Personality: ${c.personality || 'Not specified'}`)
    .join('\n');

  const systemPrompt = `You are an expert cartoon story writer for animated episodic content.
You write engaging, age-appropriate stories with vivid scene descriptions and natural dialogue.

CRITICAL LANGUAGE REQUIREMENT: You MUST write ALL story content in ${languageName}. All narration, dialogue, and descriptions MUST be in ${languageName}. Do NOT write in English (except visualPrompt). Only ${languageName} is acceptable for narration, dialogue, and description fields.

Series: "${opts.seriesName}"
${opts.seriesDescription ? `Series Description: ${opts.seriesDescription}` : ''}
${opts.targetAudience ? `Target Audience: ${opts.targetAudience}` : ''}
${opts.artStyle ? `Art Style: ${opts.artStyle}` : ''}
${opts.bannerUrl ? `Series Visual Theme: The series has an established visual banner representing its atmosphere and setting.` : ''}

Characters:
${characterList}

IMPORTANT RULES:
1. Write EXACTLY 5-7 scenes (no more!) that tell a complete story with beginning, middle, and end
2. Each scene must have a description, visual prompt (for image generation), narration, and dialogue
3. Use the characters by their exact names
4. Make dialogue natural and match each character's personality
5. Include a moral or lesson appropriate for the target audience
6. The visual prompt MUST be very detailed and include: character appearance details, the art style "${opts.artStyle || 'cartoon'}", background/setting details, lighting, mood, camera angle
7. Each visual prompt should describe the characters by their physical appearance (not just name) so the image AI knows what to draw
8. The LAST scene MUST be a CTA (Call to Action) scene — the narration should ask viewers to like, subscribe, share, and follow for more episodes of "${opts.seriesName}"

CRITICAL LENGTH RULES (for voice clarity):
- Narration: MAX 1-2 short sentences per scene (under 25 words). Keep it brief and clear.
- Dialogue: MAX 1-2 dialogue lines per scene. Each line MAX 12-15 words. Short, punchy, easy to understand when spoken aloud.
- Description: Keep brief (1 short sentence)
- Viewers listen to AI voice narration — long text sounds robotic and confusing. SHORT IS BETTER.

REMINDER: description, narration, and dialogue text MUST be in ${languageName}. Only visualPrompt should be in English.

OUTPUT FORMAT: Return ONLY valid JSON with this structure:
{
  "scenes": [
    {
      "description": "Brief scene description in ${languageName}",
      "visualPrompt": "Detailed image generation prompt in English — include character appearance, art style, setting, mood, camera angle",
      "narration": "Short narrator text in ${languageName} (1-2 sentences, under 25 words)",
      "dialogue": [
        { "characterName": "ExactName", "text": "Short line in ${languageName} (under 15 words)" }
      ]
    }
  ]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `Write an episode about: ${opts.episodePrompt}\n\nIMPORTANT: Write all narration, dialogue, and descriptions in ${languageName}. Only visualPrompt should be in English. Write EXACTLY 5-7 scenes (NOT more). Keep narration SHORT (1-2 sentences, under 25 words). Keep dialogue SHORT (1-2 lines per scene, under 15 words each). The LAST scene must be a CTA asking viewers to like, subscribe, and follow for more "${opts.seriesName}" episodes.` }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No text in Gemini response');

  let jsonText = text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonText);

  if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
    throw new Error('Invalid story format: missing scenes array');
  }

  const fullScript = parsed.scenes
    .map((s: CartoonStoryScene, i: number) => {
      const lines = [`[Scene ${i + 1}: ${s.description}]`];
      if (s.narration) lines.push(`Narrator: ${s.narration}`);
      for (const d of s.dialogue) {
        lines.push(`${d.characterName}: ${d.text}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');

  log.info({ sceneCount: parsed.scenes.length }, 'Cartoon story generated via Gemini');

  return { scenes: parsed.scenes, fullScript };
}

// ---------------------------------------------------------------------------
// Mock Story (fallback)
// ---------------------------------------------------------------------------

// Language-specific mock stories
const MOCK_STORIES: Record<string, (char1: string, char2: string) => CartoonStoryScene[]> = {
  hi: (char1, char2) => [
    {
      description: `${char1} को बगीचे में जादुई क्रिस्टल मिलता है`,
      visualPrompt: `Cartoon illustration of ${char1} looking surprised at a glowing magical crystal in a beautiful Indian garden, colorful flowers, morning sunlight, wide shot, child-friendly art style`,
      narration: `एक सुबह ${char1} को बगीचे में एक चमकता क्रिस्टल मिला।`,
      dialogue: [
        { characterName: char1, text: 'वाह, ये क्या है? कितना सुंदर!' },
      ],
    },
    {
      description: `${char1} ${char2} को दिखाता है`,
      visualPrompt: `Cartoon illustration of ${char1} showing a glowing crystal to ${char2}, both excited, lush garden background, warm golden lighting, medium shot`,
      narration: `${char1} ने तुरंत अपने दोस्त ${char2} को बुलाया।`,
      dialogue: [
        { characterName: char1, text: `${char2}, जल्दी आओ! देखो क्या मिला!` },
        { characterName: char2, text: 'ये तो जादुई लग रहा है!' },
      ],
    },
    {
      description: `क्रिस्टल हवा में तैरने लगता है`,
      visualPrompt: `Cartoon illustration of a magical crystal floating between two amazed children, rainbow glow, magical swirls, dramatic lighting, low angle shot`,
      narration: `अचानक क्रिस्टल चमका और हवा में तैरने लगा!`,
      dialogue: [
        { characterName: char2, text: 'जल्दी इच्छा मांगो!' },
      ],
    },
    {
      description: `दोनों सबकी खुशी की इच्छा मांगते हैं`,
      visualPrompt: `Cartoon illustration of two friends holding crystal up high together, determined heroic expressions, golden hour lighting, medium wide shot`,
      narration: `दोनों ने सोचा और सबकी खुशी की इच्छा मांगी।`,
      dialogue: [
        { characterName: char1, text: 'मैं चाहता हूँ सबका दिन शानदार हो!' },
        { characterName: char2, text: 'बांटने में ही खुशी है!' },
      ],
    },
    {
      description: `पूरा मोहल्ला खुशियों से भर जाता है`,
      visualPrompt: `Cartoon illustration of happy Indian neighbors in a colorful street, children playing, flowers blooming, bright sunny day, wide shot`,
      narration: `क्रिस्टल की रोशनी फैली और सब खुश हो गए!`,
      dialogue: [
        { characterName: char1, text: 'दयालुता सबसे बड़ा जादू है!' },
      ],
    },
    {
      description: `CTA — सब्सक्राइब करें`,
      visualPrompt: `Colorful cartoon end screen with cute animated characters waving at camera, subscribe and like button icons, bright cheerful background with stars and sparkles`,
      narration: `कहानी पसंद आई? लाइक और सब्सक्राइब करें!`,
      dialogue: [
        { characterName: char1, text: 'अगली कहानी में मिलते हैं!' },
      ],
    },
  ],
  en: (char1, char2) => [
    {
      description: `${char1} finds a magic crystal in the garden`,
      visualPrompt: `Cartoon illustration of ${char1} looking surprised at a glowing crystal in a beautiful garden, colorful flowers, morning sunlight, wide shot, child-friendly art style`,
      narration: `One morning, ${char1} found a glowing crystal in the garden.`,
      dialogue: [
        { characterName: char1, text: 'Wow, what is this? So beautiful!' },
      ],
    },
    {
      description: `${char1} shows ${char2} the crystal`,
      visualPrompt: `Cartoon illustration of ${char1} showing a glowing crystal to ${char2}, both excited, garden background, warm golden lighting, medium shot`,
      narration: `${char1} called their best friend ${char2} to see it.`,
      dialogue: [
        { characterName: char1, text: `${char2}, come quick! Look what I found!` },
        { characterName: char2, text: 'It looks magical!' },
      ],
    },
    {
      description: `The crystal floats into the air`,
      visualPrompt: `Cartoon illustration of a magical crystal floating between two amazed children, rainbow glow, magical swirls, dramatic lighting, low angle shot`,
      narration: `Suddenly the crystal glowed bright and floated up!`,
      dialogue: [
        { characterName: char2, text: 'Quick, make a wish!' },
      ],
    },
    {
      description: `They wish for everyone's happiness`,
      visualPrompt: `Cartoon illustration of two friends holding crystal up high together, determined expressions, golden hour lighting, heroic pose, medium wide shot`,
      narration: `They decided to wish for everyone's happiness.`,
      dialogue: [
        { characterName: char1, text: 'I wish everyone has a wonderful day!' },
        { characterName: char2, text: 'Sharing is the best magic!' },
      ],
    },
    {
      description: `The whole neighborhood lights up with joy`,
      visualPrompt: `Cartoon illustration of happy diverse neighbors in a colorful street, children playing, flowers blooming, bright sunny day, wide shot`,
      narration: `The crystal's magic spread and everyone was happy!`,
      dialogue: [
        { characterName: char1, text: 'Kindness is the best magic of all!' },
      ],
    },
    {
      description: `CTA — Subscribe for more`,
      visualPrompt: `Colorful cartoon end screen with cute characters waving at camera, Subscribe and Like icons, bright cheerful background with stars and sparkles`,
      narration: `Enjoyed the story? Like and subscribe for more!`,
      dialogue: [
        { characterName: char1, text: 'See you in the next episode!' },
      ],
    },
  ],
};

function generateMockStory(characters: CartoonCharacterInfo[], language: string): CartoonStoryResult {
  const char1 = characters[0]?.name || 'Hero';
  const char2 = characters[1]?.name || 'Friend';

  // Use language-specific mock or fallback to English
  const storyFn = MOCK_STORIES[language] || MOCK_STORIES['en'];
  const scenes = storyFn(char1, char2);

  const fullScript = scenes
    .map((s, i) => {
      const lines = [`[Scene ${i + 1}: ${s.description}]`];
      if (s.narration) lines.push(`Narrator: ${s.narration}`);
      for (const d of s.dialogue) lines.push(`${d.characterName}: ${d.text}`);
      return lines.join('\n');
    })
    .join('\n\n');

  return { scenes, fullScript };
}
