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
  return generateMockStory(opts.characters);
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

Characters:
${characterList}

IMPORTANT RULES:
1. Write 6-10 scenes that tell a complete story with beginning, middle, and end
2. Each scene must have a description, visual prompt (for image generation), narration, and dialogue
3. Use the characters by their exact names
4. Make dialogue natural and match each character's personality
5. Include a moral or lesson appropriate for the target audience
6. The visual prompt should describe the scene in detail for image generation (art style: ${opts.artStyle || 'cartoon'})

REMINDER: description, narration, and dialogue text MUST be in ${languageName}. Only visualPrompt should be in English.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "scenes": [
    {
      "description": "Brief scene description in ${languageName}",
      "visualPrompt": "Detailed image generation prompt in English for this scene",
      "narration": "Narrator text in ${languageName}",
      "dialogue": [
        { "characterName": "ExactName", "text": "What they say in ${languageName}" }
      ]
    }
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: `Write an episode about: ${opts.episodePrompt}\n\nIMPORTANT: Write all narration, dialogue, and descriptions in ${languageName}. Only visualPrompt should be in English.` },
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

Characters:
${characterList}

IMPORTANT RULES:
1. Write 6-10 scenes that tell a complete story with beginning, middle, and end
2. Each scene must have a description, visual prompt (for image generation), narration, and dialogue
3. Use the characters by their exact names
4. Make dialogue natural and match each character's personality
5. Include a moral or lesson appropriate for the target audience
6. The visual prompt should describe the scene in detail for image generation (art style: ${opts.artStyle || 'cartoon'})

REMINDER: description, narration, and dialogue text MUST be in ${languageName}. Only visualPrompt should be in English.

OUTPUT FORMAT: Return ONLY valid JSON with this structure:
{
  "scenes": [
    {
      "description": "Brief scene description in ${languageName}",
      "visualPrompt": "Detailed image generation prompt in English for this scene",
      "narration": "Narrator text in ${languageName}",
      "dialogue": [
        { "characterName": "ExactName", "text": "What they say in ${languageName}" }
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
        contents: [{ role: 'user', parts: [{ text: `Write an episode about: ${opts.episodePrompt}\n\nIMPORTANT: Write all narration, dialogue, and descriptions in ${languageName}. Only visualPrompt should be in English.` }] }],
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

  const data = await response.json();
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

function generateMockStory(characters: CartoonCharacterInfo[]): CartoonStoryResult {
  const char1 = characters[0]?.name || 'Hero';
  const char2 = characters[1]?.name || 'Friend';

  const scenes: CartoonStoryScene[] = [
    {
      description: `${char1} discovers something unusual in the garden`,
      visualPrompt: `Cartoon illustration of ${char1} looking surprised at a glowing object in a garden, colorful, child-friendly`,
      narration: `One bright sunny morning, ${char1} went out to play in the garden and found something amazing.`,
      dialogue: [
        { characterName: char1, text: 'Wow, look at this! What could it be?' },
      ],
    },
    {
      description: `${char1} calls ${char2} to come see`,
      visualPrompt: `Cartoon illustration of ${char1} excitedly calling ${char2}, garden background, warm lighting`,
      narration: `Excited by the discovery, ${char1} called out to their best friend.`,
      dialogue: [
        { characterName: char1, text: `${char2}! Come here quick! You have to see this!` },
        { characterName: char2, text: `I'm coming! What did you find?` },
      ],
    },
    {
      description: `Both friends examine the glowing object together`,
      visualPrompt: `Cartoon illustration of two friends kneeling and looking at a magical glowing crystal, sparkles`,
      narration: `Together, they carefully examined the mysterious object. It was a beautiful crystal that glowed with different colors.`,
      dialogue: [
        { characterName: char2, text: 'It looks like a magic crystal! Maybe it grants wishes!' },
        { characterName: char1, text: 'Should we make a wish? What should we wish for?' },
      ],
    },
    {
      description: `They decide to share the crystal with everyone`,
      visualPrompt: `Cartoon illustration of friends showing crystal to neighborhood kids, happy community scene`,
      narration: `After thinking about it, they decided the best wish would be one that helps everyone.`,
      dialogue: [
        { characterName: char1, text: 'I wish for everyone to have a wonderful day!' },
        { characterName: char2, text: "That's the best wish ever! Sharing is caring!" },
      ],
    },
    {
      description: `Happy ending with all friends together`,
      visualPrompt: `Cartoon illustration of group of happy friends playing together, sunset, rainbow, warm scene`,
      narration: `And so, the magic of sharing and kindness brought everyone together for the most wonderful day ever. The end!`,
      dialogue: [
        { characterName: char1, text: 'This was the best day ever!' },
        { characterName: char2, text: 'Because we shared it with friends!' },
      ],
    },
  ];

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
