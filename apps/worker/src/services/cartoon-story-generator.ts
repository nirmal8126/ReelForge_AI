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
  visualPrompts?: string[];
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

/**
 * Normalize AI output scenes — ensure visualPrompts array exists.
 * Handles both old format (single visualPrompt) and new format (visualPrompts array).
 */
function normalizeScenes(scenes: any[]): CartoonStoryScene[] {
  return scenes.map((s) => {
    let visualPrompts: string[] = [];

    if (Array.isArray(s.visualPrompts) && s.visualPrompts.length > 0) {
      visualPrompts = s.visualPrompts;
    } else if (s.visualPrompt) {
      visualPrompts = [s.visualPrompt];
    }

    return {
      description: s.description || '',
      visualPrompt: visualPrompts[0] || s.visualPrompt || '',
      visualPrompts,
      narration: s.narration || '',
      dialogue: Array.isArray(s.dialogue) ? s.dialogue : [],
    };
  });
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
1. Write EXACTLY 10-15 scenes that tell a complete story with beginning, middle, and end
2. Each scene must have a description, visual prompt (for image generation), narration, and dialogue
3. Use the characters by their exact names
4. Make dialogue natural and match each character's personality
5. Include a moral or lesson appropriate for the target audience
6. Each visual prompt MUST be very detailed and include: character appearance details, the art style "${opts.artStyle || 'cartoon'}", background/setting details, lighting, mood, camera angle
7. Each visual prompt should describe the characters by their physical appearance (not just name) so the image AI knows what to draw
8. The LAST scene MUST be a CTA (Call to Action) scene — the narration should ask viewers to like, subscribe, share, and follow for more episodes of "${opts.seriesName}"

DURATION TARGET: The final episode video MUST be 2-4 minutes long. This means each scene needs enough spoken content.

NARRATION & DIALOGUE LENGTH RULES (for 2-4 minute episodes):
- Narration: 2-4 sentences per scene (30-50 words). Descriptive, engaging, storytelling tone. Clear and natural for AI voice.
- Dialogue: 2-4 dialogue lines per scene. Each line 10-20 words. Natural, expressive, conversational.
- Description: Keep brief (1 short sentence)
- Use simple, clear language — avoid overly complex sentences that sound robotic when spoken aloud.
- Each scene should have ~15-20 seconds of spoken content (narration + dialogue combined).

MULTIPLE IMAGES PER SCENE:
- Each scene MUST have a "visualPrompts" array with 2-3 different image prompts showing different angles/moments of that scene
- This creates visual variety — viewers see multiple images per scene instead of one static image
- Each prompt should show a different camera angle, zoom level, or moment within the same scene action
- Example: Scene about a character finding something → [wide shot of garden, close-up of character's surprised face, close-up of the object]

REMINDER: description, narration, and dialogue text MUST be in ${languageName}. Only visualPrompts should be in English.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "scenes": [
    {
      "description": "Brief scene description in ${languageName}",
      "visualPrompts": [
        "First image: wide/establishing shot — detailed prompt in English",
        "Second image: different angle/moment — detailed prompt in English",
        "Third image (optional): close-up/reaction — detailed prompt in English"
      ],
      "narration": "Narrator text in ${languageName} (2-4 sentences, 30-50 words, engaging storytelling)",
      "dialogue": [
        { "characterName": "ExactName", "text": "Dialogue line in ${languageName} (10-20 words, natural speech)" }
      ]
    }
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      { role: 'user', content: `Write an episode about: ${opts.episodePrompt}\n\nIMPORTANT: Write all narration, dialogue, and descriptions in ${languageName}. Only visualPrompts should be in English. Write EXACTLY 10-15 scenes. Each scene MUST have "visualPrompts" array with 2-3 different image prompts. TARGET DURATION: 2-4 minutes. Narration should be 2-4 sentences (30-50 words) per scene. Dialogue should be 2-4 lines per scene (10-20 words each). The LAST scene must be a CTA asking viewers to like, subscribe, and follow for more "${opts.seriesName}" episodes.` },
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

  // Normalize scenes: ensure visualPrompts array exists
  const normalizedScenes = normalizeScenes(parsed.scenes);

  // Build full script from narration + dialogue
  const fullScript = normalizedScenes
    .map((s: CartoonStoryScene, i: number) => {
      const lines = [`[Scene ${i + 1}: ${s.description}]`];
      if (s.narration) lines.push(`Narrator: ${s.narration}`);
      for (const d of s.dialogue) {
        lines.push(`${d.characterName}: ${d.text}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');

  log.info({ sceneCount: normalizedScenes.length }, 'Cartoon story generated via Anthropic');

  return { scenes: normalizedScenes, fullScript };
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
1. Write EXACTLY 10-15 scenes that tell a complete story with beginning, middle, and end
2. Each scene must have a description, visual prompt (for image generation), narration, and dialogue
3. Use the characters by their exact names
4. Make dialogue natural and match each character's personality
5. Include a moral or lesson appropriate for the target audience
6. Each visual prompt MUST be very detailed and include: character appearance details, the art style "${opts.artStyle || 'cartoon'}", background/setting details, lighting, mood, camera angle
7. Each visual prompt should describe the characters by their physical appearance (not just name) so the image AI knows what to draw
8. The LAST scene MUST be a CTA (Call to Action) scene — the narration should ask viewers to like, subscribe, share, and follow for more episodes of "${opts.seriesName}"

DURATION TARGET: The final episode video MUST be 2-4 minutes long. This means each scene needs enough spoken content.

NARRATION & DIALOGUE LENGTH RULES (for 2-4 minute episodes):
- Narration: 2-4 sentences per scene (30-50 words). Descriptive, engaging, storytelling tone. Clear and natural for AI voice.
- Dialogue: 2-4 dialogue lines per scene. Each line 10-20 words. Natural, expressive, conversational.
- Description: Keep brief (1 short sentence)
- Use simple, clear language — avoid overly complex sentences that sound robotic when spoken aloud.
- Each scene should have ~15-20 seconds of spoken content (narration + dialogue combined).

MULTIPLE IMAGES PER SCENE:
- Each scene MUST have a "visualPrompts" array with 2-3 different image prompts showing different angles/moments of that scene
- This creates visual variety — viewers see multiple images per scene instead of one static image
- Each prompt should show a different camera angle, zoom level, or moment within the same scene action
- Example: Scene about a character finding something → [wide shot of garden, close-up of character's surprised face, close-up of the object]

REMINDER: description, narration, and dialogue text MUST be in ${languageName}. Only visualPrompts should be in English.

OUTPUT FORMAT: Return ONLY valid JSON with this structure:
{
  "scenes": [
    {
      "description": "Brief scene description in ${languageName}",
      "visualPrompts": [
        "First image: wide/establishing shot — detailed prompt in English",
        "Second image: different angle/moment — detailed prompt in English",
        "Third image (optional): close-up/reaction — detailed prompt in English"
      ],
      "narration": "Narrator text in ${languageName} (2-4 sentences, 30-50 words, engaging storytelling)",
      "dialogue": [
        { "characterName": "ExactName", "text": "Dialogue line in ${languageName} (10-20 words, natural speech)" }
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
        contents: [{ role: 'user', parts: [{ text: `Write an episode about: ${opts.episodePrompt}\n\nIMPORTANT: Write all narration, dialogue, and descriptions in ${languageName}. Only visualPrompts should be in English. Write EXACTLY 10-15 scenes. Each scene MUST have "visualPrompts" array with 2-3 different image prompts. TARGET DURATION: 2-4 minutes. Narration should be 2-4 sentences (30-50 words) per scene. Dialogue should be 2-4 lines per scene (10-20 words each). The LAST scene must be a CTA asking viewers to like, subscribe, and follow for more "${opts.seriesName}" episodes.` }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 8192,
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

  const normalizedScenes = normalizeScenes(parsed.scenes);

  const fullScript = normalizedScenes
    .map((s: CartoonStoryScene, i: number) => {
      const lines = [`[Scene ${i + 1}: ${s.description}]`];
      if (s.narration) lines.push(`Narrator: ${s.narration}`);
      for (const d of s.dialogue) {
        lines.push(`${d.characterName}: ${d.text}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');

  log.info({ sceneCount: normalizedScenes.length }, 'Cartoon story generated via Gemini');

  return { scenes: normalizedScenes, fullScript };
}

// ---------------------------------------------------------------------------
// Mock Story (fallback)
// ---------------------------------------------------------------------------

// Language-specific mock stories
const MOCK_STORIES: Record<string, (char1: string, char2: string) => CartoonStoryScene[]> = {
  hi: (char1, char2) => [
    {
      description: `${char1} सुबह की सैर पर निकलता है`,
      visualPrompt: `Cartoon illustration of ${char1} walking on a sunny morning path in an Indian village, birds flying, warm sunrise, wide shot, child-friendly art style`,
      visualPrompts: [
        `Wide cartoon illustration of a peaceful Indian village morning, sunrise, birds flying, ${char1} walking on a path, child-friendly art style`,
        `Cartoon medium shot of ${char1} stretching and yawning happily on a village path, warm golden sunrise behind`,
      ],
      narration: `एक सुनहरी सुबह ${char1} अपने घर से बाहर निकला। आसमान में पक्षी उड़ रहे थे और हवा में ताज़गी थी। ${char1} को सुबह की सैर बहुत पसंद थी, क्योंकि इससे उसका पूरा दिन अच्छा बीतता था।`,
      dialogue: [
        { characterName: char1, text: 'वाह, आज तो मौसम कितना सुहाना है! चलो आज कुछ नया खोजते हैं।' },
        { characterName: char1, text: 'सुबह की ताज़ी हवा में घूमने का मज़ा ही कुछ और है!' },
      ],
    },
    {
      description: `${char1} को बगीचे में चमकती चीज़ दिखती है`,
      visualPrompt: `Cartoon illustration of ${char1} noticing a glow behind bushes in a garden, curious expression, morning light, medium shot`,
      visualPrompts: [
        `Cartoon illustration of ${char1} walking past colorful flower bushes, noticing a strange glow, curious look, morning light`,
        `Cartoon close-up of a mysterious golden glow coming from behind green bushes, sparkles, magical atmosphere`,
      ],
      narration: `${char1} जब बगीचे के पास से गुज़रा तो उसे झाड़ियों के पीछे से एक अजीब सी रोशनी दिखी। वो रोशनी सुनहरी थी और टिमटिमा रही थी। ${char1} का दिल ज़ोर ज़ोर से धड़कने लगा।`,
      dialogue: [
        { characterName: char1, text: 'अरे, ये चमक कहाँ से आ रही है? कुछ तो ज़रूर है वहाँ!' },
        { characterName: char1, text: 'मुझे देखना होगा, लेकिन थोड़ा डर भी लग रहा है।' },
      ],
    },
    {
      description: `${char1} को जादुई क्रिस्टल मिलता है`,
      visualPrompt: `Cartoon close-up of ${char1} picking up a glowing magical crystal from grass, sparkles, wonder on face, warm lighting`,
      visualPrompts: [
        `Cartoon illustration of ${char1} pushing aside bushes and finding a glowing crystal, surprised face, magical sparkles`,
        `Cartoon close-up of a beautiful multicolored crystal in ${char1}'s hands, rainbow sparkles, soft golden light`,
      ],
      narration: `${char1} ने हिम्मत करके झाड़ियों को हटाया और वहाँ एक चमकता हुआ क्रिस्टल पड़ा था। उसमें इंद्रधनुष जैसे रंग चमक रहे थे। ${char1} ने उसे धीरे से उठाया तो पूरे बगीचे में रोशनी फैल गई।`,
      dialogue: [
        { characterName: char1, text: 'ये तो बहुत ही सुंदर और अनोखा है! ऐसा कभी नहीं देखा।' },
        { characterName: char1, text: 'ये क्रिस्टल ज़रूर जादुई है, मुझे ${char2} को दिखाना होगा!' },
      ],
    },
    {
      description: `${char1} दौड़कर ${char2} को बुलाता है`,
      visualPrompt: `Cartoon illustration of ${char1} running excitedly towards ${char2}'s house, village background, energetic pose, medium wide shot`,
      visualPrompts: [
        `Cartoon illustration of ${char1} running excitedly through a village lane, waving hands, energetic, wide shot`,
        `Cartoon illustration of ${char2} opening door surprised, ${char1} catching breath outside, medium shot`,
      ],
      narration: `${char1} क्रिस्टल लेकर तेज़ी से ${char2} के घर की तरफ भागा। उसकी साँसें फूल रही थीं लेकिन उत्साह कम नहीं हुआ। ${char2} दरवाज़े पर खड़ा था और ${char1} को इतना उत्साहित देखकर हैरान हो गया।`,
      dialogue: [
        { characterName: char1, text: `${char2}! जल्दी आओ, मुझे कुछ बहुत अनोखा मिला है!` },
        { characterName: char2, text: 'क्या हुआ? तुम इतने उत्साहित क्यों हो? बताओ तो!' },
        { characterName: char1, text: 'पहले चलो बगीचे में, फिर खुद देख लेना!' },
      ],
    },
    {
      description: `${char2} क्रिस्टल देखकर हैरान`,
      visualPrompt: `Cartoon illustration of ${char2} looking amazed at the crystal in ${char1}'s hands, garden, warm lighting, close-up`,
      visualPrompts: [
        `Cartoon illustration of ${char1} showing crystal to ${char2}, both amazed, garden background, warm lighting`,
        `Cartoon close-up of ${char2}'s surprised and excited face looking at the glowing crystal`,
      ],
      narration: `${char2} ने जब क्रिस्टल देखा तो उसकी आँखें चौड़ी हो गईं। इतना सुंदर और चमकदार क्रिस्टल उसने पहले कभी नहीं देखा था। दोनों दोस्त उस जादुई चमक को देखते रहे।`,
      dialogue: [
        { characterName: char2, text: 'ये तो सच में जादुई लग रहा है! कितनी खूबसूरत रोशनी है!' },
        { characterName: char1, text: 'मैंने कहा था ना! ये कोई साधारण चीज़ नहीं है।' },
        { characterName: char2, text: 'लेकिन इसका इस्तेमाल कैसे करें? सोचना पड़ेगा।' },
      ],
    },
    {
      description: `क्रिस्टल अचानक हवा में तैरने लगता है`,
      visualPrompt: `Cartoon illustration of a crystal floating in the air between two amazed children, rainbow glow, magical swirls, dramatic lighting`,
      visualPrompts: [
        `Cartoon illustration of crystal glowing brighter in ${char1}'s hands, rainbow light rays, dramatic lighting, close-up`,
        `Cartoon illustration of crystal floating up in the air, ${char1} and ${char2} looking up amazed, magical swirls, low angle shot`,
      ],
      narration: `तभी अचानक क्रिस्टल ${char1} के हाथों से निकलकर हवा में तैरने लगा! उसमें से इंद्रधनुषी रोशनी चारों तरफ फैलने लगी। दोनों दोस्त हैरानी से मुँह खोले देखते रहे।`,
      dialogue: [
        { characterName: char2, text: 'अरे! ये तो उड़ रहा है! ये असली जादू है!' },
        { characterName: char1, text: 'मुझे लगता है ये हमसे कुछ कहना चाहता है।' },
        { characterName: char2, text: 'शायद ये चाहता है कि हम कोई इच्छा मांगें!' },
      ],
    },
    {
      description: `दोनों सोचते हैं क्या इच्छा मांगें`,
      visualPrompt: `Cartoon illustration of two friends sitting under a tree, thinking deeply, soft golden lighting, medium shot`,
      visualPrompts: [
        `Cartoon illustration of ${char1} and ${char2} sitting under a big tree, thinking with hands on chin, soft light`,
        `Cartoon close-up of ${char1} with a thought bubble showing happy village people, warm colors`,
      ],
      narration: `दोनों दोस्त पेड़ के नीचे बैठकर सोचने लगे कि क्या इच्छा मांगें। बहुत सारी चीज़ें दिमाग में आईं — खिलौने, मिठाई, नई साइकिल। लेकिन फिर ${char1} को एक बहुत अच्छा विचार आया।`,
      dialogue: [
        { characterName: char1, text: 'अगर हम सिर्फ अपने लिए मांगें तो बाकी सबका क्या?' },
        { characterName: char2, text: 'तुम सही कह रहे हो। कुछ ऐसा मांगते हैं जो सबके काम आए।' },
        { characterName: char1, text: 'हाँ! चलो सबकी खुशी की इच्छा मांगते हैं!' },
      ],
    },
    {
      description: `दोनों मिलकर सबकी खुशी की इच्छा मांगते हैं`,
      visualPrompt: `Cartoon illustration of two friends holding crystal up high together, heroic pose, golden hour lighting, wide shot`,
      visualPrompts: [
        `Cartoon illustration of ${char1} and ${char2} holding crystal up high together, determined faces, golden hour lighting`,
        `Cartoon close-up of crystal bursting with rainbow light, magical sparkles radiating outward`,
      ],
      narration: `दोनों ने मिलकर क्रिस्टल को ऊपर उठाया और ज़ोर से बोला — सबकी खुशी की इच्छा! क्रिस्टल में एक ज़बरदस्त रोशनी फूटी जो आसमान तक पहुँच गई। पूरा गाँव उस जादुई रोशनी से नहा गया।`,
      dialogue: [
        { characterName: char1, text: 'हम चाहते हैं कि सबका दिन शानदार और खुशियों भरा हो!' },
        { characterName: char2, text: 'हर किसी के चेहरे पर मुस्कान आए, यही हमारी इच्छा है!' },
      ],
    },
    {
      description: `जादुई रोशनी पूरे मोहल्ले में फैलती है`,
      visualPrompt: `Cartoon aerial illustration of magical rainbow sparkles spreading across a colorful Indian neighborhood, houses glowing, fantasy atmosphere`,
      visualPrompts: [
        `Cartoon aerial illustration of magical rainbow sparkles spreading across a colorful Indian neighborhood, houses glowing`,
        `Cartoon illustration of villagers looking up at the sky in wonder, colorful light falling like rain, wide shot`,
      ],
      narration: `क्रिस्टल की जादुई रोशनी पूरे मोहल्ले में फैल गई। हर घर, हर गली, हर पेड़ उस सुनहरी रोशनी से चमक उठा। लोग अपने घरों से बाहर आकर आसमान की तरफ देखने लगे।`,
      dialogue: [
        { characterName: char1, text: 'देखो, पूरा गाँव कितना सुंदर लग रहा है!' },
        { characterName: char2, text: 'ये रोशनी हर किसी तक पहुँच रही है! कमाल है!' },
      ],
    },
    {
      description: `सब लोग खुश, बच्चे खेलते हैं`,
      visualPrompt: `Cartoon illustration of happy Indian neighbors in a colorful street, children playing, flowers blooming, bright sunny day, wide shot`,
      visualPrompts: [
        `Cartoon illustration of happy Indian villagers dancing and celebrating in the street, colorful decorations, wide shot`,
        `Cartoon illustration of children playing together, laughing, flowers blooming around them, bright sunny day`,
      ],
      narration: `जादू काम कर गया! हर तरफ खुशी ही खुशी थी। बच्चे खेल रहे थे, बड़े हँस रहे थे, और फूल खिल उठे थे। पूरा मोहल्ला जैसे एक बड़े त्योहार में बदल गया था।`,
      dialogue: [
        { characterName: char2, text: 'देखो, सबके चेहरे पर कितनी प्यारी मुस्कान है!' },
        { characterName: char1, text: 'ये सब हमारी इच्छा की वजह से हुआ! बहुत अच्छा लग रहा है!' },
      ],
    },
    {
      description: `${char1} और ${char2} को सीख मिलती है`,
      visualPrompt: `Cartoon illustration of ${char1} and ${char2} smiling at sunset, warm golden light, village silhouette background, medium shot`,
      visualPrompts: [
        `Cartoon illustration of ${char1} and ${char2} sitting on a hill watching sunset, warm golden light, peaceful`,
        `Cartoon close-up of both friends smiling at each other, village silhouette in background, warm tones`,
      ],
      narration: `शाम को दोनों दोस्त पहाड़ी पर बैठकर डूबते सूरज को देख रहे थे। आज उन्होंने एक बहुत बड़ी बात सीखी — जब हम दूसरों की खुशी के बारे में सोचते हैं, तो सबसे ज़्यादा खुशी हमें ही मिलती है।`,
      dialogue: [
        { characterName: char1, text: 'आज मैंने सीखा कि बांटने में ही असली खुशी है।' },
        { characterName: char2, text: 'हाँ, दयालुता सबसे बड़ा जादू है दुनिया में!' },
        { characterName: char1, text: 'अब हम हमेशा सबकी मदद करेंगे और खुशियाँ बांटेंगे।' },
      ],
    },
    {
      description: `CTA — सब्सक्राइब करें`,
      visualPrompt: `Colorful cartoon end screen with cute animated characters waving at camera, subscribe and like button icons, bright cheerful background with stars and sparkles`,
      visualPrompts: [
        `Colorful cartoon end screen with cute animated characters waving at camera, subscribe and like button icons, bright cheerful background with stars and sparkles`,
      ],
      narration: `तो दोस्तों, कहानी कैसी लगी? अगर आपको मज़ा आया तो वीडियो को लाइक करें, चैनल को सब्सक्राइब करें, और बेल आइकन दबाना बिलकुल मत भूलिए!`,
      dialogue: [
        { characterName: char1, text: 'अगली कहानी और भी मज़ेदार होगी, ज़रूर देखना!' },
        { characterName: char2, text: 'तब तक के लिए अलविदा, जल्दी मिलते हैं दोस्तों!' },
      ],
    },
  ],
  en: (char1, char2) => [
    {
      description: `${char1} goes for a morning walk`,
      visualPrompt: `Cartoon illustration of ${char1} walking on a sunny morning path, birds flying, warm sunrise, wide shot, child-friendly art style`,
      visualPrompts: [
        `Wide cartoon illustration of a peaceful neighborhood morning, sunrise, birds flying, ${char1} walking on a path, child-friendly art style`,
        `Cartoon medium shot of ${char1} stretching happily on a sidewalk, warm golden sunrise behind`,
      ],
      narration: `One beautiful morning, ${char1} stepped outside and took a deep breath. The birds were singing, the sun was shining, and everything felt perfect. ${char1} loved morning walks because they always led to exciting adventures.`,
      dialogue: [
        { characterName: char1, text: 'What a lovely day to explore! I have a feeling something special will happen today.' },
        { characterName: char1, text: 'The fresh morning air always makes me happy and ready for adventure!' },
      ],
    },
    {
      description: `${char1} notices something glowing in the bushes`,
      visualPrompt: `Cartoon illustration of ${char1} noticing a glow behind bushes in a garden, curious expression, morning light, medium shot`,
      visualPrompts: [
        `Cartoon illustration of ${char1} walking past flower bushes, noticing a strange glow, curious look, morning light`,
        `Cartoon close-up of a mysterious golden glow coming from behind green bushes, sparkles, magical atmosphere`,
      ],
      narration: `As ${char1} walked past the garden, a strange golden light caught his eye. It was coming from behind the bushes and flickering like a tiny star. ${char1}'s heart started beating faster with curiosity and excitement.`,
      dialogue: [
        { characterName: char1, text: 'Wait, what is that glow? There is something shining behind those bushes!' },
        { characterName: char1, text: 'I need to check it out, but I am a little nervous too.' },
      ],
    },
    {
      description: `${char1} finds a magic crystal`,
      visualPrompt: `Cartoon close-up of ${char1} picking up a glowing crystal from grass, sparkles, wonder on face, warm lighting`,
      visualPrompts: [
        `Cartoon illustration of ${char1} pushing aside bushes discovering a glowing crystal, surprised face, magical sparkles`,
        `Cartoon close-up of a beautiful multicolored crystal in ${char1}'s hands, rainbow sparkles, soft golden light`,
      ],
      narration: `${char1} carefully pushed the bushes aside and found a beautiful glowing crystal lying in the grass. It sparkled with all the colors of the rainbow and felt warm to the touch. The whole garden lit up the moment ${char1} picked it up.`,
      dialogue: [
        { characterName: char1, text: 'This is the most beautiful thing I have ever seen! It is glowing like magic!' },
        { characterName: char1, text: 'I must show this to ${char2} right away. This is unbelievable!' },
      ],
    },
    {
      description: `${char1} runs to find ${char2}`,
      visualPrompt: `Cartoon illustration of ${char1} running excitedly towards ${char2}'s house, neighborhood background, energetic pose`,
      visualPrompts: [
        `Cartoon illustration of ${char1} running excitedly through a neighborhood, waving hands, energetic, wide shot`,
        `Cartoon illustration of ${char2} opening door surprised, ${char1} catching breath outside, medium shot`,
      ],
      narration: `${char1} ran as fast as possible to ${char2}'s house, holding the crystal carefully. By the time ${char1} reached the door, he was completely out of breath. ${char2} was standing at the door and could not understand why ${char1} was so excited.`,
      dialogue: [
        { characterName: char1, text: `${char2}, come quickly! I found something truly amazing in the garden!` },
        { characterName: char2, text: 'What happened? Why are you so excited? Tell me everything right now!' },
        { characterName: char1, text: 'You have to see it to believe it. Come with me to the garden!' },
      ],
    },
    {
      description: `${char2} is amazed by the crystal`,
      visualPrompt: `Cartoon illustration of ${char2} looking amazed at the crystal in ${char1}'s hands, warm lighting, close-up`,
      visualPrompts: [
        `Cartoon illustration of ${char1} showing crystal to ${char2}, both amazed, garden background, warm lighting`,
        `Cartoon close-up of ${char2}'s surprised and excited face looking at the glowing crystal`,
      ],
      narration: `When ${char2} saw the crystal, his eyes grew wide with wonder. He had never seen anything so beautiful and magical in his entire life. Both friends stood there in the garden, completely mesmerized by the sparkling light.`,
      dialogue: [
        { characterName: char2, text: 'This is truly magical! Look at all those beautiful colors shining from inside!' },
        { characterName: char1, text: 'I told you it was special! This is not an ordinary crystal at all.' },
        { characterName: char2, text: 'But what should we do with it? We need to think carefully.' },
      ],
    },
    {
      description: `The crystal starts floating`,
      visualPrompt: `Cartoon illustration of a crystal floating between two amazed children, rainbow glow, magical swirls, dramatic lighting`,
      visualPrompts: [
        `Cartoon close-up of crystal glowing brighter in ${char1}'s hands, rainbow light rays, dramatic lighting`,
        `Cartoon illustration of crystal floating up in the air, ${char1} and ${char2} looking up amazed, magical swirls, low angle shot`,
      ],
      narration: `Suddenly the crystal lifted right out of ${char1}'s hands and began floating in the air! Rainbow light poured out in every direction, creating beautiful swirls all around them. Both friends gasped and stared up in complete amazement.`,
      dialogue: [
        { characterName: char2, text: 'Oh my goodness! It is floating by itself! This is real magic!' },
        { characterName: char1, text: 'I think it is trying to tell us something important.' },
        { characterName: char2, text: 'Maybe it wants us to make a wish! That is what magic crystals do!' },
      ],
    },
    {
      description: `They think about what to wish for`,
      visualPrompt: `Cartoon illustration of two friends sitting under a tree, thinking deeply, soft golden lighting, medium shot`,
      visualPrompts: [
        `Cartoon illustration of ${char1} and ${char2} sitting under a big tree, thinking with hands on chin, soft light`,
        `Cartoon close-up of ${char1} with a thought bubble showing happy neighbors, warm colors`,
      ],
      narration: `The two friends sat under the big tree to think about their wish. They thought of toys, candy, and new bicycles. But then ${char1} had a wonderful idea that was much bigger and much better than anything just for themselves.`,
      dialogue: [
        { characterName: char1, text: 'What if instead of wishing for ourselves, we wish for something for everyone?' },
        { characterName: char2, text: 'You are absolutely right. Something that helps everyone would be the best wish.' },
        { characterName: char1, text: 'Let us wish for happiness for the whole neighborhood!' },
      ],
    },
    {
      description: `They make the wish together`,
      visualPrompt: `Cartoon illustration of two friends holding crystal up high together, heroic pose, golden hour lighting, wide shot`,
      visualPrompts: [
        `Cartoon illustration of ${char1} and ${char2} holding crystal up high together, determined faces, golden hour lighting`,
        `Cartoon close-up of crystal bursting with rainbow light, magical sparkles radiating outward`,
      ],
      narration: `Together they held the crystal up high and shouted their wish for everyone's happiness. The crystal burst with an incredible light that shot straight into the sky. The entire neighborhood was bathed in that warm, magical golden glow.`,
      dialogue: [
        { characterName: char1, text: 'We wish for everyone to have a wonderful and happy day!' },
        { characterName: char2, text: 'May every single person smile and feel joy in their heart today!' },
      ],
    },
    {
      description: `Magic light spreads across the neighborhood`,
      visualPrompt: `Cartoon aerial illustration of magical rainbow sparkles spreading across a colorful neighborhood, houses glowing, fantasy atmosphere`,
      visualPrompts: [
        `Cartoon aerial illustration of magical rainbow sparkles spreading across a colorful neighborhood, houses glowing`,
        `Cartoon illustration of people looking up at the sky in wonder, colorful light falling like rain, wide shot`,
      ],
      narration: `The crystal's magical light spread across every house, every street, and every corner of the neighborhood. Golden sparkles floated down from the sky like gentle rain. People came out of their homes and looked up at the beautiful sky in wonder.`,
      dialogue: [
        { characterName: char1, text: 'Look at how beautiful everything looks now! The whole place is glowing!' },
        { characterName: char2, text: 'The magic is reaching every single person. This is incredible!' },
      ],
    },
    {
      description: `Everyone is happy and celebrating`,
      visualPrompt: `Cartoon illustration of happy diverse neighbors in a colorful street, children playing, flowers blooming, bright sunny day, wide shot`,
      visualPrompts: [
        `Cartoon illustration of happy neighbors dancing and celebrating in the street, colorful decorations, wide shot`,
        `Cartoon illustration of children playing together, laughing, flowers blooming around them, bright sunny day`,
      ],
      narration: `The magic worked perfectly! Children were playing and laughing, adults were smiling and dancing, and flowers bloomed everywhere. The whole neighborhood had turned into one big celebration of joy and togetherness.`,
      dialogue: [
        { characterName: char2, text: 'Look at everyone! Every single face has the most beautiful smile!' },
        { characterName: char1, text: 'This is the best feeling ever! Our wish really came true for everyone!' },
      ],
    },
    {
      description: `${char1} and ${char2} learn the lesson`,
      visualPrompt: `Cartoon illustration of ${char1} and ${char2} smiling at sunset, warm golden light, neighborhood silhouette background`,
      visualPrompts: [
        `Cartoon illustration of ${char1} and ${char2} sitting on a hill watching sunset, warm golden light, peaceful`,
        `Cartoon close-up of both friends smiling at each other, neighborhood silhouette background, warm tones`,
      ],
      narration: `As the sun set, both friends sat on the hill and watched the golden sky. Today they learned something very important — when we think about others and share our blessings, the greatest happiness comes back to us.`,
      dialogue: [
        { characterName: char1, text: 'Today I learned that sharing and caring is the greatest magic in the world.' },
        { characterName: char2, text: 'Kindness is the most powerful gift anyone can give to others.' },
        { characterName: char1, text: 'From now on, we will always help others and spread happiness everywhere.' },
      ],
    },
    {
      description: `CTA — Subscribe for more`,
      visualPrompt: `Colorful cartoon end screen with cute characters waving at camera, Subscribe and Like icons, bright cheerful background with stars and sparkles`,
      visualPrompts: [
        `Colorful cartoon end screen with cute characters waving at camera, Subscribe and Like icons, bright cheerful background with stars and sparkles`,
      ],
      narration: `So friends, did you enjoy the story? If you loved it, please hit the like button, subscribe to our channel, and do not forget to press the bell icon so you never miss a new episode!`,
      dialogue: [
        { characterName: char1, text: 'The next episode is going to be even more exciting, so make sure to watch it!' },
        { characterName: char2, text: 'Until next time, goodbye friends! See you very soon!' },
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
