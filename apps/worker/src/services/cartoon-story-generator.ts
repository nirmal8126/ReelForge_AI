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
1. Write 10-15 scenes that tell a complete story with beginning, middle, and end
2. Each scene must have a description, visual prompt (for image generation), narration, and dialogue
3. Use the characters by their exact names
4. Make dialogue natural and match each character's personality
5. Include a moral or lesson appropriate for the target audience
6. The visual prompt MUST be very detailed and include: character appearance details, the art style "${opts.artStyle || 'cartoon'}", background/setting details, lighting, mood, camera angle
7. Each visual prompt should describe the characters by their physical appearance (not just name) so the image AI knows what to draw
8. The LAST scene MUST be a CTA (Call to Action) scene — the narration should ask viewers to like, subscribe, share, and follow for more episodes of "${opts.seriesName}"

REMINDER: description, narration, and dialogue text MUST be in ${languageName}. Only visualPrompt should be in English.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "scenes": [
    {
      "description": "Brief scene description in ${languageName}",
      "visualPrompt": "Detailed image generation prompt in English — include character appearance, art style, setting, mood, camera angle",
      "narration": "Narrator text in ${languageName}",
      "dialogue": [
        { "characterName": "ExactName", "text": "What they say in ${languageName}" }
      ]
    }
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 6144,
    system: systemPrompt,
    messages: [
      { role: 'user', content: `Write an episode about: ${opts.episodePrompt}\n\nIMPORTANT: Write all narration, dialogue, and descriptions in ${languageName}. Only visualPrompt should be in English. Write 10-15 scenes. The LAST scene must be a CTA asking viewers to like, subscribe, and follow for more "${opts.seriesName}" episodes.` },
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
1. Write 10-15 scenes that tell a complete story with beginning, middle, and end
2. Each scene must have a description, visual prompt (for image generation), narration, and dialogue
3. Use the characters by their exact names
4. Make dialogue natural and match each character's personality
5. Include a moral or lesson appropriate for the target audience
6. The visual prompt MUST be very detailed and include: character appearance details, the art style "${opts.artStyle || 'cartoon'}", background/setting details, lighting, mood, camera angle
7. Each visual prompt should describe the characters by their physical appearance (not just name) so the image AI knows what to draw
8. The LAST scene MUST be a CTA (Call to Action) scene — the narration should ask viewers to like, subscribe, share, and follow for more episodes of "${opts.seriesName}"

REMINDER: description, narration, and dialogue text MUST be in ${languageName}. Only visualPrompt should be in English.

OUTPUT FORMAT: Return ONLY valid JSON with this structure:
{
  "scenes": [
    {
      "description": "Brief scene description in ${languageName}",
      "visualPrompt": "Detailed image generation prompt in English — include character appearance, art style, setting, mood, camera angle",
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
        contents: [{ role: 'user', parts: [{ text: `Write an episode about: ${opts.episodePrompt}\n\nIMPORTANT: Write all narration, dialogue, and descriptions in ${languageName}. Only visualPrompt should be in English. Write 10-15 scenes. The LAST scene must be a CTA asking viewers to like, subscribe, and follow for more "${opts.seriesName}" episodes.` }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 6144,
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
      description: `${char1} को बगीचे में कुछ अनोखा मिलता है`,
      visualPrompt: `Cartoon illustration of ${char1} looking surprised at a glowing magical object in a beautiful Indian garden, colorful flowers, morning sunlight, wide shot, child-friendly art style`,
      narration: `एक खूबसूरत सुबह, ${char1} बगीचे में खेलने गया और उसे कुछ अद्भुत मिला।`,
      dialogue: [
        { characterName: char1, text: 'वाह, ये देखो! ये क्या हो सकता है?' },
      ],
    },
    {
      description: `${char1} रहस्यमयी चीज़ उठाता है`,
      visualPrompt: `Close-up cartoon illustration of small hands picking up a glowing multicolored crystal from green grass, magical sparkles, warm golden lighting, wonder atmosphere`,
      narration: `${char1} ने ध्यान से उस रहस्यमयी चमकती चीज़ को उठाया। उसके हाथों में गर्माहट और झनझनाहट महसूस हुई।`,
      dialogue: [
        { characterName: char1, text: 'ये तो जादुई लग रहा है! पता नहीं ये कहाँ से आया...' },
      ],
    },
    {
      description: `${char1} ${char2} को बुलाता है`,
      visualPrompt: `Cartoon illustration of ${char1} excitedly waving and calling ${char2} who is running towards them, lush garden background, warm golden hour lighting, medium shot`,
      narration: `इस खोज से उत्साहित होकर, ${char1} ने अपने सबसे अच्छे दोस्त को पुकारा।`,
      dialogue: [
        { characterName: char1, text: `${char2}! जल्दी आओ! तुम्हें ये देखना होगा!` },
        { characterName: char2, text: 'मैं आ रहा हूँ! क्या मिला तुम्हें?' },
      ],
    },
    {
      description: `दोनों दोस्त एक साथ चमकती चीज़ की जांच करते हैं`,
      visualPrompt: `Cartoon illustration of two friends kneeling together examining a magical glowing crystal, rainbow sparkles and light rays, wonder on their faces, close-up shot`,
      narration: `दोनों ने मिलकर उस रहस्यमयी चीज़ को देखा। वह एक सुंदर क्रिस्टल था जो अलग-अलग रंगों में चमक रहा था।`,
      dialogue: [
        { characterName: char2, text: 'ये जादुई क्रिस्टल लग रहा है! शायद ये इच्छाएँ पूरी करता है!' },
        { characterName: char1, text: 'क्या हम एक इच्छा मांगें? हमें क्या मांगना चाहिए?' },
      ],
    },
    {
      description: `क्रिस्टल और तेज़ चमकने लगता है`,
      visualPrompt: `Cartoon illustration of a magical crystal floating in the air between two amazed children, intense rainbow glow, magical swirls around it, dramatic lighting, low angle shot`,
      narration: `अचानक, क्रिस्टल और भी तेज़ चमकने लगा और हवा में तैरने लगा!`,
      dialogue: [
        { characterName: char1, text: 'अरे वाह! ये तो उड़ रहा है!' },
        { characterName: char2, text: 'जल्दी इच्छा मांगो! कुछ अद्भुत सोचो!' },
      ],
    },
    {
      description: `दोनों सोचते हैं कि क्या इच्छा मांगें`,
      visualPrompt: `Cartoon illustration of two children sitting under a big tree thinking deeply, thought bubbles showing toys vs helping others, split composition, soft dappled lighting`,
      narration: `दोनों पुराने पेड़ के नीचे बैठकर ध्यान से सोचने लगे कि क्या इच्छा मांगें।`,
      dialogue: [
        { characterName: char2, text: 'हम कुछ भी मांग सकते हैं! खिलौने, मिठाई, एक ट्रीहाउस...' },
        { characterName: char1, text: 'लेकिन अगर हम कुछ ऐसा मांगें जो सबकी मदद करे?' },
      ],
    },
    {
      description: `वे क्रिस्टल को सबके साथ बांटने का फैसला करते हैं`,
      visualPrompt: `Cartoon illustration of two friends standing confidently together holding the crystal up high, determined heroic expressions, golden hour lighting, medium wide shot`,
      narration: `सोचने के बाद, उन्होंने फैसला किया कि सबसे अच्छी इच्छा वह होगी जो सबकी मदद करे।`,
      dialogue: [
        { characterName: char1, text: 'मैं चाहता हूँ कि सबका दिन शानदार हो!' },
        { characterName: char2, text: 'ये सबसे अच्छी इच्छा है! बांटने में ही खुशी है!' },
      ],
    },
    {
      description: `क्रिस्टल का जादू पूरे मोहल्ले में फैलता है`,
      visualPrompt: `Cartoon illustration of magical rainbow sparkles spreading across a colorful Indian neighborhood, houses glowing, people looking up in wonder, aerial wide shot, fantasy atmosphere`,
      narration: `क्रिस्टल इंद्रधनुषी चमक में बिखर गया और उसकी रोशनी पूरे मोहल्ले में फैल गई!`,
      dialogue: [],
    },
    {
      description: `मोहल्ले के सब लोग खुश हैं`,
      visualPrompt: `Cartoon illustration of happy diverse Indian neighbors waving and smiling in a colorful street, children playing, flowers blooming everywhere, bright sunny day, wide shot`,
      narration: `जहाँ-जहाँ चमक पहुँची, लोग मुस्कुराए, फूल खिले, और पूरा मोहल्ला खुशियों से भर गया।`,
      dialogue: [
        { characterName: char1, text: 'देखो सबको! सब कितने खुश हैं!' },
        { characterName: char2, text: 'हमारी इच्छा सच में पूरी हुई! दयालुता सबसे बड़ा जादू है!' },
      ],
    },
    {
      description: `सभी दोस्त साथ मिलकर खुशी मनाते हैं`,
      visualPrompt: `Cartoon illustration of a group of happy friends playing together in a park, beautiful sunset sky, rainbow in background, warm golden cinematic lighting, wide shot`,
      narration: `और इस तरह, बांटने और दयालुता के जादू ने सबको एक साथ ला दिया। अंत!`,
      dialogue: [
        { characterName: char1, text: 'ये अब तक का सबसे अच्छा दिन था!' },
        { characterName: char2, text: 'क्योंकि हमने इसे दोस्तों के साथ बांटा!' },
      ],
    },
    {
      description: `CTA — सब्सक्राइब करें`,
      visualPrompt: `Colorful cartoon end screen with cute animated characters waving at the camera, subscribe and like button icons, bright cheerful background with stars and sparkles, fun and inviting`,
      narration: `क्या आपको ये कहानी पसंद आई? तो वीडियो को लाइक करें, चैनल को सब्सक्राइब करें, और अपने दोस्तों के साथ शेयर करें! अगली कहानी में फिर मिलेंगे!`,
      dialogue: [
        { characterName: char1, text: 'अगली कहानी में मिलते हैं!' },
        { characterName: char2, text: 'सब्सक्राइब करना मत भूलना!' },
      ],
    },
  ],
  en: (char1, char2) => [
    {
      description: `${char1} discovers something unusual in the garden`,
      visualPrompt: `Cartoon illustration of ${char1} looking surprised at a glowing object in a beautiful garden, colorful flowers, morning sunlight, wide shot, child-friendly art style`,
      narration: `One bright sunny morning, ${char1} went out to play in the garden and found something amazing.`,
      dialogue: [
        { characterName: char1, text: 'Wow, look at this! What could it be?' },
      ],
    },
    {
      description: `${char1} picks up the mysterious object`,
      visualPrompt: `Close-up cartoon illustration of small hands picking up a glowing multicolored crystal from the grass, sparkles, magical atmosphere, warm lighting`,
      narration: `${char1} carefully picked up the mysterious glowing object. It felt warm and tingly in their hands.`,
      dialogue: [
        { characterName: char1, text: 'It feels magical! I wonder where it came from...' },
      ],
    },
    {
      description: `${char1} calls ${char2} to come see`,
      visualPrompt: `Cartoon illustration of ${char1} excitedly waving and calling ${char2} who is running towards them, garden background, warm golden lighting, medium shot`,
      narration: `Excited by the discovery, ${char1} called out to their best friend.`,
      dialogue: [
        { characterName: char1, text: `${char2}! Come here quick! You have to see this!` },
        { characterName: char2, text: `I'm coming! What did you find?` },
      ],
    },
    {
      description: `Both friends examine the glowing object together`,
      visualPrompt: `Cartoon illustration of two friends kneeling together and looking at a magical glowing crystal between them, sparkles and light rays, wonder on their faces, close-up shot`,
      narration: `Together, they carefully examined the mysterious object. It was a beautiful crystal that glowed with different colors.`,
      dialogue: [
        { characterName: char2, text: 'It looks like a magic crystal! Maybe it grants wishes!' },
        { characterName: char1, text: 'Should we make a wish? What should we wish for?' },
      ],
    },
    {
      description: `The crystal starts glowing brighter`,
      visualPrompt: `Cartoon illustration of a magical crystal floating in the air between two amazed children, intense rainbow glow, magical swirls, dramatic lighting, low angle shot`,
      narration: `Suddenly, the crystal began to glow even brighter, lifting into the air between them!`,
      dialogue: [
        { characterName: char1, text: 'Whoa! It is flying!' },
        { characterName: char2, text: 'Quick, make a wish! Think of something wonderful!' },
      ],
    },
    {
      description: `They think about what to wish for`,
      visualPrompt: `Cartoon illustration of two children sitting under a tree thinking deeply, thought bubbles showing toys and candy vs helping others, split composition, soft lighting`,
      narration: `They sat together under the old oak tree, thinking carefully about what to wish for.`,
      dialogue: [
        { characterName: char2, text: 'We could wish for anything! Toys, candy, a treehouse...' },
        { characterName: char1, text: 'But what if we wished for something that helps everyone?' },
      ],
    },
    {
      description: `They decide to share the crystal with everyone`,
      visualPrompt: `Cartoon illustration of two friends standing confidently together holding the crystal up high, determined expressions, golden hour lighting, heroic pose, medium wide shot`,
      narration: `After thinking about it, they decided the best wish would be one that helps everyone.`,
      dialogue: [
        { characterName: char1, text: 'I wish for everyone to have a wonderful day!' },
        { characterName: char2, text: "That's the best wish ever! Sharing is caring!" },
      ],
    },
    {
      description: `The crystal spreads magic across the neighborhood`,
      visualPrompt: `Cartoon illustration of magical sparkles and rainbow light spreading across a colorful neighborhood, houses glowing, people looking up in wonder, aerial wide shot, fantasy atmosphere`,
      narration: `The crystal burst into a shower of rainbow sparkles that spread across the entire neighborhood!`,
      dialogue: [],
    },
    {
      description: `Everyone in the neighborhood is happy`,
      visualPrompt: `Cartoon illustration of happy diverse neighbors waving and smiling in a colorful street, children playing, flowers blooming, bright sunny day, community celebration, wide shot`,
      narration: `Everywhere the sparkles touched, people smiled, flowers bloomed, and the whole neighborhood lit up with joy.`,
      dialogue: [
        { characterName: char1, text: 'Look at everyone! They are all so happy!' },
        { characterName: char2, text: 'Our wish really worked! Kindness is the best magic!' },
      ],
    },
    {
      description: `Happy ending with all friends together`,
      visualPrompt: `Cartoon illustration of a group of happy diverse friends playing together in a park, beautiful sunset, rainbow in the sky, warm golden lighting, wide cinematic shot`,
      narration: `And so, the magic of sharing and kindness brought everyone together for the most wonderful day ever. The end!`,
      dialogue: [
        { characterName: char1, text: 'This was the best day ever!' },
        { characterName: char2, text: 'Because we shared it with friends!' },
      ],
    },
    {
      description: `CTA — Subscribe for more adventures`,
      visualPrompt: `Colorful cartoon end screen with cute characters waving at the camera, "Subscribe" and "Like" icons, bright cheerful background with stars and sparkles, fun typography space`,
      narration: `Did you enjoy this adventure? Like this video, subscribe to our channel, and share it with your friends so you never miss an episode! See you next time!`,
      dialogue: [
        { characterName: char1, text: 'See you in the next episode!' },
        { characterName: char2, text: 'Don\'t forget to subscribe!' },
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
