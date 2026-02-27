import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'quote-text-generator' });

// ---------------------------------------------------------------------------
// Clients (lazy-initialised)
// ---------------------------------------------------------------------------

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }
  return openaiClient;
}

function getPreferredProvider(): 'gemini' | 'anthropic' | 'openai' | 'auto' {
  const value = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (value === 'gemini' || value === 'anthropic' || value === 'openai') return value;
  return 'auto';
}

async function callGemini(prompt: string, maxTokens: number, temperature: number): Promise<string> {
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
          temperature,
          maxOutputTokens: maxTokens,
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

  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim();
  if (!content) throw new Error('No content in Gemini response');

  return content;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuoteTextResult {
  quote: string;
  author: string;
}

// ---------------------------------------------------------------------------
// Language name mapping
// ---------------------------------------------------------------------------

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    pa: 'Punjabi',
    ur: 'Urdu',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi',
    gu: 'Gujarati',
  };
  return names[code] || 'English';
}

function getLanguageScript(code: string): string {
  const scripts: Record<string, string> = {
    hi: 'Devanagari (हिन्दी)',
    pa: 'Gurmukhi (ਪੰਜਾਬੀ)',
    ur: 'Urdu script (اردو)',
    bn: 'Bengali script (বাংলা)',
    ta: 'Tamil script (தமிழ்)',
    te: 'Telugu script (తెలుగు)',
    mr: 'Devanagari (मराठी)',
    gu: 'Gujarati script (ગુજરાતી)',
  };
  return scripts[code] || '';
}

// ---------------------------------------------------------------------------
// Prompt builder — generates 5 variations
// ---------------------------------------------------------------------------

function getQuoteLengthInstruction(quoteLength: string): string {
  switch (quoteLength) {
    case 'short':
      return `LENGTH REQUIREMENT — SHORT (STRICT):
- Each quote MUST be exactly 1-2 sentences, between 10-30 words.
- Punchy, impactful, and memorable. Think: bumper sticker wisdom.
- If any quote exceeds 30 words, it is WRONG. Rewrite it shorter.`;
    case 'long':
      return `LENGTH REQUIREMENT — LONG (STRICT):
- Each quote MUST be a FULL PARAGRAPH of 5-10 sentences, between 80-150 words.
- This is the MOST IMPORTANT rule. Every quote must be LONG and elaborate.
- Weave multiple ideas together. Explore the theme deeply. Use metaphors, examples, and reflections.
- Think: a mini-essay or a heartfelt letter, NOT a one-liner.
- If any quote is under 80 words, it is TOO SHORT. You MUST make it longer with more depth and detail.
- COUNT YOUR WORDS. Each quote should fill an entire paragraph.`;
    case 'medium':
    default:
      return `LENGTH REQUIREMENT — MEDIUM (STRICT):
- Each quote MUST be 3-5 sentences, between 30-80 words.
- Meaningful, complete, and with emotional depth. More than a one-liner, but not a full paragraph.
- If any quote is under 30 words, it is TOO SHORT. Add more substance.`;
  }
}

// Random creative directions to ensure unique output every generation
const CREATIVE_TONES = [
  'poetic and metaphorical', 'philosophical and reflective', 'warm and heartfelt',
  'bold and powerful', 'gentle and soothing', 'passionate and fiery',
  'nostalgic and tender', 'wise and contemplative', 'hopeful and uplifting',
  'raw and honest', 'lyrical and flowing', 'elegant and graceful',
  'spiritual and deep', 'earthy and grounded', 'vivid and expressive',
];

const CREATIVE_ANGLES = [
  'through the lens of nature and seasons',
  'using metaphors of light, stars, and sky',
  'from the perspective of time and memory',
  'with imagery of journeys and paths',
  'through everyday moments and small gestures',
  'using metaphors of water, rivers, and ocean',
  'from the heart of a storyteller sharing wisdom',
  'with imagery of gardens, roots, and growth',
  'through the eyes of someone looking back on life',
  'using fire, warmth, and home as metaphors',
  'from the perspective of dreams and aspirations',
  'through the beauty of silence and unspoken feelings',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getMinWordCount(quoteLength: string): number {
  switch (quoteLength) {
    case 'short': return 8;
    case 'long': return 60;
    case 'medium':
    default: return 25;
  }
}

function buildQuotePrompt(category: string, language: string, userPrompt?: string, quoteLength?: string): string {
  const langName = getLanguageName(language);
  const langScript = getLanguageScript(language);
  const lengthInstruction = getQuoteLengthInstruction(quoteLength || 'medium');
  const scriptInstruction = langScript
    ? `\n- You MUST write the quotes in ${langName} using ${langScript}. Do NOT write in English or transliteration — use the native script only.`
    : '';

  const lengthLabel = (quoteLength || 'medium').toUpperCase();

  // Inject randomness for unique output every time
  const tone = pickRandom(CREATIVE_TONES);
  const angle = pickRandom(CREATIVE_ANGLES);
  const seed = Math.floor(Math.random() * 99999);

  const longExample = quoteLength === 'long' ? `

EXAMPLE of a LONG quote (80-150 words) for reference — your quotes MUST be at least THIS length:
"Love is not merely a feeling that comes and goes with the seasons — it is a choice we make every single morning when we wake up beside the same person, a decision renewed through years of shared laughter and silent tears, through celebrations and hardships that test the very foundation of our bond. True love is built in the quiet moments — in the cup of tea made without asking, in the hand held during difficult times, in the forgiveness offered when pride says otherwise. It grows deeper not despite the years, but because of them, like roots of an ancient tree that only grow stronger with time."` : '';

  return `You are a creative quote writer. Generate exactly 5 unique, beautiful, original ${category} quotes in ${langName}.
${userPrompt ? `\nThe user wants the quotes to be about: ${userPrompt}` : ''}

Creative Direction for THIS generation (seed: ${seed}):
- Write in a ${tone} tone
- Approach the topic ${angle}
- Make these quotes completely DIFFERENT from any previous generation — be surprising and fresh

${lengthInstruction}
The requested length is ${lengthLabel}. This is the MOST IMPORTANT rule. Every single quote MUST meet the word count requirement.${longExample}

Additional Rules:
- Generate exactly 5 different quote variations, each one unique in perspective and wording
- Each quote must be original, meaningful, and emotionally resonant
- For the author field, create a believable pen name or attribution — vary the author names
- For Islamic category: use wisdom from Quran/Hadith references appropriately
- For Hindi Shayari: write in proper shayari style with rhyming couplets in Devanagari script${scriptInstruction}
- ALL 5 quotes must be written in ${langName}${language !== 'en' ? '. Do NOT write quotes in English.' : ''}
- FINAL CHECK: Before returning, verify EACH quote is ${lengthLabel} length${quoteLength === 'long' ? ' (80-150 words, full paragraph)' : quoteLength === 'short' ? ' (10-30 words)' : ' (30-80 words)'}. ${quoteLength === 'long' ? 'Short one-liners will be REJECTED.' : ''}

Return ONLY valid JSON array in this exact format:
[{"quote": "quote text in ${langName}", "author": "Author Name"}, {"quote": "second quote in ${langName}", "author": "Author Name"}, {"quote": "third quote", "author": "Author"}, {"quote": "fourth quote", "author": "Author"}, {"quote": "fifth quote", "author": "Author"}]`;
}

// ---------------------------------------------------------------------------
// Mock quotes for DEV_MODE — keyed by language, then category
// ---------------------------------------------------------------------------

const MOCK_QUOTES_EN: Record<string, QuoteTextResult[]> = {
  motivational: [
    { quote: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { quote: 'Believe you can and you are halfway there.', author: 'Theodore Roosevelt' },
    { quote: 'Success is not the key to happiness. Happiness is the key to success.', author: 'Albert Schweitzer' },
    { quote: 'Your limitation—it is only your imagination.', author: 'Unknown' },
    { quote: 'Push yourself, because no one else is going to do it for you.', author: 'Unknown' },
  ],
  love: [
    { quote: "Love is not about possession, it's about appreciation.", author: 'Unknown' },
    { quote: 'The best thing to hold onto in life is each other.', author: 'Audrey Hepburn' },
    { quote: 'Love is a friendship set to music.', author: 'Joseph Campbell' },
    { quote: 'Where there is love there is life.', author: 'Mahatma Gandhi' },
    { quote: 'To love and be loved is to feel the sun from both sides.', author: 'David Viscott' },
  ],
  funny: [
    { quote: "I'm not lazy, I'm on energy saving mode.", author: 'Unknown' },
    { quote: 'Life is short. Smile while you still have teeth.', author: 'Unknown' },
    { quote: "I don't need a hair stylist, my pillow gives me a new look every morning.", author: 'Unknown' },
    { quote: 'Common sense is like deodorant. Those who need it most never use it.', author: 'Unknown' },
    { quote: "I'm on a seafood diet. I see food and I eat it.", author: 'Unknown' },
  ],
  wisdom: [
    { quote: 'The mind is everything. What you think, you become.', author: 'Buddha' },
    { quote: 'An unexamined life is not worth living.', author: 'Socrates' },
    { quote: 'The only true wisdom is in knowing you know nothing.', author: 'Socrates' },
    { quote: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
    { quote: 'Knowing yourself is the beginning of all wisdom.', author: 'Aristotle' },
  ],
  success: [
    { quote: 'Success is not final, failure is not fatal.', author: 'Winston Churchill' },
    { quote: 'The road to success and the road to failure are almost exactly the same.', author: 'Colin R. Davis' },
    { quote: 'Success usually comes to those who are too busy to be looking for it.', author: 'Henry David Thoreau' },
    { quote: "Don't be afraid to give up the good to go for the great.", author: 'John D. Rockefeller' },
    { quote: 'I find that the harder I work, the more luck I seem to have.', author: 'Thomas Jefferson' },
  ],
  life: [
    { quote: "Life is what happens while you're busy making plans.", author: 'John Lennon' },
    { quote: 'The purpose of our lives is to be happy.', author: 'Dalai Lama' },
    { quote: 'Life is really simple, but we insist on making it complicated.', author: 'Confucius' },
    { quote: 'In the end, it is not the years in your life that count. It is the life in your years.', author: 'Abraham Lincoln' },
    { quote: 'Life is short, and it is up to you to make it sweet.', author: 'Sarah Louise Delany' },
  ],
  friendship: [
    { quote: 'A real friend walks in when the rest of the world walks out.', author: 'Walter Winchell' },
    { quote: 'Friendship is born at that moment when one person says to another, "What! You too?"', author: 'C.S. Lewis' },
    { quote: 'A friend is someone who knows all about you and still loves you.', author: 'Elbert Hubbard' },
    { quote: 'True friendship comes when the silence between two people is comfortable.', author: 'David Tyson' },
    { quote: 'Friends are the family you choose.', author: 'Jess C. Scott' },
  ],
  islamic: [
    { quote: 'Indeed, with hardship comes ease.', author: 'Quran 94:6' },
    { quote: 'And He found you lost and guided you.', author: 'Quran 93:7' },
    { quote: 'So verily, with the hardship, there is relief.', author: 'Quran 94:5' },
    { quote: 'Allah does not burden a soul beyond that it can bear.', author: 'Quran 2:286' },
    { quote: 'The best among you are those who have the best manners and character.', author: 'Prophet Muhammad (PBUH)' },
  ],
  shayari: [
    { quote: 'Every moment is a fresh beginning.', author: 'T.S. Eliot' },
    { quote: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
    { quote: 'Strive not to be a success, but rather to be of value.', author: 'Albert Einstein' },
    { quote: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins' },
    { quote: 'Act as if what you do makes a difference. It does.', author: 'William James' },
  ],
  custom: [
    { quote: 'Every moment is a fresh beginning.', author: 'T.S. Eliot' },
    { quote: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
    { quote: 'Strive not to be a success, but rather to be of value.', author: 'Albert Einstein' },
    { quote: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins' },
    { quote: 'Act as if what you do makes a difference. It does.', author: 'William James' },
  ],
};

const MOCK_QUOTES_HI: Record<string, QuoteTextResult[]> = {
  motivational: [
    { quote: 'महान कार्य करने का एकमात्र तरीका है कि आप जो करते हैं उससे प्रेम करें।', author: 'स्टीव जॉब्स' },
    { quote: 'विश्वास करो कि तुम कर सकते हो, तुम आधे रास्ते पर हो।', author: 'थियोडोर रूज़वेल्ट' },
    { quote: 'सफलता खुशी की कुंजी नहीं है। खुशी सफलता की कुंजी है।', author: 'अल्बर्ट श्वाइत्ज़र' },
    { quote: 'आपकी सीमा — केवल आपकी कल्पना है।', author: 'अज्ञात' },
    { quote: 'खुद को आगे बढ़ाओ, क्योंकि और कोई तुम्हारे लिए नहीं करेगा।', author: 'अज्ञात' },
  ],
  love: [
    { quote: 'प्रेम अधिकार नहीं, सराहना है।', author: 'अज्ञात' },
    { quote: 'ज़िन्दगी में सबसे अच्छी चीज़ एक दूसरे को थामे रखना है।', author: 'ऑड्रे हेपबर्न' },
    { quote: 'प्रेम संगीत पर बजती मित्रता है।', author: 'जोसेफ कैंपबेल' },
    { quote: 'जहाँ प्रेम है वहाँ जीवन है।', author: 'महात्मा गांधी' },
    { quote: 'प्यार करना और प्यार पाना दोनों ओर से सूरज को महसूस करना है।', author: 'डेविड विस्कॉट' },
  ],
  funny: [
    { quote: 'मैं आलसी नहीं हूँ, मैं ऊर्जा बचत मोड पर हूँ।', author: 'अज्ञात' },
    { quote: 'ज़िन्दगी छोटी है। जब तक दाँत हैं मुस्कुराओ।', author: 'अज्ञात' },
    { quote: 'मुझे हेयर स्टाइलिस्ट की ज़रूरत नहीं, मेरा तकिया रोज़ नया लुक देता है।', author: 'अज्ञात' },
    { quote: 'सामान्य ज्ञान डिओडोरेंट जैसा है। जिन्हें सबसे ज़्यादा ज़रूरत है वो कभी इस्तेमाल नहीं करते।', author: 'अज्ञात' },
    { quote: 'मैं सी-फ़ूड डाइट पर हूँ। खाना दिखता है, खा लेता हूँ।', author: 'अज्ञात' },
  ],
  wisdom: [
    { quote: 'मन ही सब कुछ है। जो आप सोचते हैं, वही बनते हैं।', author: 'बुद्ध' },
    { quote: 'बिना जाँचा जीवन जीने योग्य नहीं है।', author: 'सुकरात' },
    { quote: 'सच्चा ज्ञान यह जानना है कि तुम कुछ नहीं जानते।', author: 'सुकरात' },
    { quote: 'कठिनाई के बीच में अवसर छिपा होता है।', author: 'अल्बर्ट आइंस्टीन' },
    { quote: 'स्वयं को जानना सभी ज्ञान की शुरुआत है।', author: 'अरस्तू' },
  ],
  success: [
    { quote: 'सफलता अंतिम नहीं, असफलता घातक नहीं।', author: 'विंस्टन चर्चिल' },
    { quote: 'सफलता का मार्ग और विफलता का मार्ग लगभग एक ही है।', author: 'कॉलिन आर. डेविस' },
    { quote: 'सफलता उन्हें मिलती है जो उसे ढूँढने में बहुत व्यस्त होते हैं।', author: 'हेनरी डेविड थोरो' },
    { quote: 'अच्छे को छोड़कर महान पाने से मत डरो।', author: 'जॉन डी. रॉकफेलर' },
    { quote: 'जितना कठिन मैं काम करता हूँ, उतना ही भाग्यशाली होता जाता हूँ।', author: 'थॉमस जेफरसन' },
  ],
  life: [
    { quote: 'ज़िन्दगी वो है जो तब होती है जब आप और योजनाएँ बना रहे होते हैं।', author: 'जॉन लेनन' },
    { quote: 'हमारे जीवन का उद्देश्य खुश रहना है।', author: 'दलाई लामा' },
    { quote: 'जीवन वास्तव में सरल है, पर हम इसे जटिल बनाते हैं।', author: 'कन्फ्यूशियस' },
    { quote: 'अंत में ज़िन्दगी में साल नहीं, सालों में ज़िन्दगी मायने रखती है।', author: 'अब्राहम लिंकन' },
    { quote: 'ज़िन्दगी छोटी है, इसे मधुर बनाना आप पर है।', author: 'सारा लुईस डेलेनी' },
  ],
  friendship: [
    { quote: 'सच्चा दोस्त तब आता है जब बाकी दुनिया चली जाती है।', author: 'वाल्टर विंचेल' },
    { quote: 'दोस्ती उस पल जन्म लेती है जब एक कहता है "क्या! तुम भी?"', author: 'सी.एस. लुईस' },
    { quote: 'दोस्त वो है जो तुम्हारे बारे में सब जानता है और फिर भी प्यार करता है।', author: 'एल्बर्ट हबर्ड' },
    { quote: 'सच्ची दोस्ती तब होती है जब दो लोगों के बीच की खामोशी सुकून देती है।', author: 'डेविड टायसन' },
    { quote: 'दोस्त वो परिवार है जो आप चुनते हैं।', author: 'जेस सी. स्कॉट' },
  ],
  islamic: [
    { quote: 'बेशक, तकलीफ के साथ आसानी है।', author: 'क़ुरान 94:6' },
    { quote: 'और उसने तुम्हें भटका पाया और राह दिखाई।', author: 'क़ुरान 93:7' },
    { quote: 'तो बेशक, मुश्किल के साथ राहत है।', author: 'क़ुरान 94:5' },
    { quote: 'अल्लाह किसी जान पर उसकी ताकत से ज़्यादा बोझ नहीं डालता।', author: 'क़ुरान 2:286' },
    { quote: 'तुम में से सबसे अच्छे वो हैं जिनके अख़लाक़ सबसे अच्छे हैं।', author: 'पैगंबर मुहम्मद (स.अ.व.)' },
  ],
  shayari: [
    { quote: 'ज़िन्दगी में कुछ पाना हो तो तरीके बदलो, इरादे नहीं।', author: 'अज्ञात' },
    { quote: 'खुद को इतना बुलंद कर कि खुदा बंदे से पूछे बता तेरी रज़ा क्या है।', author: 'अल्लामा इक़बाल' },
    { quote: 'वो लोग बहुत खुशनसीब होते हैं जिनके हिस्से में सच्चा प्यार आता है।', author: 'अज्ञात' },
    { quote: 'मंज़िलें उन्हीं को मिलती हैं जिनके सपनों में जान होती है।', author: 'अज्ञात' },
    { quote: 'ज़िन्दगी बड़ी होनी चाहिए, लम्बी नहीं।', author: 'राजेश खन्ना' },
  ],
  custom: [
    { quote: 'हर पल एक नई शुरुआत है।', author: 'टी.एस. इलियट' },
    { quote: 'पेड़ लगाने का सबसे अच्छा समय 20 साल पहले था। दूसरा सबसे अच्छा समय अभी है।', author: 'चीनी कहावत' },
    { quote: 'सफल होने की नहीं, मूल्यवान होने की कोशिश करो।', author: 'अल्बर्ट आइंस्टीन' },
    { quote: 'एकमात्र असंभव यात्रा वो है जो आपने कभी शुरू नहीं की।', author: 'टोनी रॉबिन्स' },
    { quote: 'ऐसे काम करो जैसे आपके काम से फ़र्क पड़ता है। पड़ता है।', author: 'विलियम जेम्स' },
  ],
};

const MOCK_QUOTES_PA: Record<string, QuoteTextResult[]> = {
  motivational: [
    { quote: 'ਮਹਾਨ ਕੰਮ ਕਰਨ ਦਾ ਇੱਕੋ ਇੱਕ ਤਰੀਕਾ ਹੈ ਕਿ ਤੁਸੀਂ ਜੋ ਕਰਦੇ ਹੋ ਉਸ ਨੂੰ ਪਿਆਰ ਕਰੋ।', author: 'ਸਟੀਵ ਜੌਬਸ' },
    { quote: 'ਵਿਸ਼ਵਾਸ ਕਰੋ ਕਿ ਤੁਸੀਂ ਕਰ ਸਕਦੇ ਹੋ, ਤੁਸੀਂ ਅੱਧੇ ਰਾਹ ਤੇ ਹੋ।', author: 'ਥੀਓਡੋਰ ਰੂਜ਼ਵੈਲਟ' },
    { quote: 'ਸਫਲਤਾ ਖੁਸ਼ੀ ਦੀ ਕੁੰਜੀ ਨਹੀਂ। ਖੁਸ਼ੀ ਸਫਲਤਾ ਦੀ ਕੁੰਜੀ ਹੈ।', author: 'ਅਲਬਰਟ ਸ਼ਵਾਈਤਜ਼ਰ' },
    { quote: 'ਤੁਹਾਡੀ ਸੀਮਾ — ਸਿਰਫ਼ ਤੁਹਾਡੀ ਕਲਪਨਾ ਹੈ।', author: 'ਅਣਪਛਾਤਾ' },
    { quote: 'ਆਪਣੇ ਆਪ ਨੂੰ ਅੱਗੇ ਧੱਕੋ, ਕਿਉਂਕਿ ਹੋਰ ਕੋਈ ਤੁਹਾਡੇ ਲਈ ਨਹੀਂ ਕਰੇਗਾ।', author: 'ਅਣਪਛਾਤਾ' },
  ],
  love: [
    { quote: 'ਪਿਆਰ ਕਬਜ਼ਾ ਨਹੀਂ, ਕਦਰ ਹੈ।', author: 'ਅਣਪਛਾਤਾ' },
    { quote: 'ਜ਼ਿੰਦਗੀ ਵਿੱਚ ਸਭ ਤੋਂ ਵਧੀਆ ਚੀਜ਼ ਇੱਕ ਦੂਜੇ ਨੂੰ ਫੜੀ ਰੱਖਣਾ ਹੈ।', author: 'ਔਡਰੀ ਹੈਪਬਰਨ' },
    { quote: 'ਪਿਆਰ ਸੰਗੀਤ ਤੇ ਸੈੱਟ ਕੀਤੀ ਦੋਸਤੀ ਹੈ।', author: 'ਜੋਸਫ਼ ਕੈਂਪਬੈਲ' },
    { quote: 'ਜਿੱਥੇ ਪਿਆਰ ਹੈ ਉੱਥੇ ਜ਼ਿੰਦਗੀ ਹੈ।', author: 'ਮਹਾਤਮਾ ਗਾਂਧੀ' },
    { quote: 'ਪਿਆਰ ਕਰਨਾ ਅਤੇ ਪਿਆਰ ਪਾਉਣਾ ਦੋਵੇਂ ਪਾਸਿਆਂ ਤੋਂ ਸੂਰਜ ਮਹਿਸੂਸ ਕਰਨਾ ਹੈ।', author: 'ਡੇਵਿਡ ਵਿਸਕੌਟ' },
  ],
  funny: [
    { quote: 'ਮੈਂ ਆਲਸੀ ਨਹੀਂ ਹਾਂ, ਮੈਂ ਊਰਜਾ ਬਚਤ ਮੋਡ ਤੇ ਹਾਂ।', author: 'ਅਣਪਛਾਤਾ' },
    { quote: 'ਜ਼ਿੰਦਗੀ ਛੋਟੀ ਹੈ। ਜਦੋਂ ਤੱਕ ਦੰਦ ਹਨ ਮੁਸਕਰਾਓ।', author: 'ਅਣਪਛਾਤਾ' },
    { quote: 'ਮੈਨੂੰ ਹੇਅਰ ਸਟਾਈਲਿਸਟ ਦੀ ਲੋੜ ਨਹੀਂ, ਮੇਰਾ ਸਿਰਹਾਣਾ ਰੋਜ਼ ਨਵਾਂ ਲੁੱਕ ਦਿੰਦਾ ਹੈ।', author: 'ਅਣਪਛਾਤਾ' },
    { quote: 'ਆਮ ਸਮਝ ਡੀਓਡਰੈਂਟ ਵਰਗੀ ਹੈ। ਜਿਨ੍ਹਾਂ ਨੂੰ ਸਭ ਤੋਂ ਵੱਧ ਲੋੜ ਹੈ ਉਹ ਕਦੇ ਨਹੀਂ ਵਰਤਦੇ।', author: 'ਅਣਪਛਾਤਾ' },
    { quote: 'ਮੈਂ ਸੀ-ਫੂਡ ਡਾਈਟ ਤੇ ਹਾਂ। ਖਾਣਾ ਦਿਖਦਾ ਹੈ, ਖਾ ਲੈਂਦਾ ਹਾਂ।', author: 'ਅਣਪਛਾਤਾ' },
  ],
  wisdom: [
    { quote: 'ਮਨ ਹੀ ਸਭ ਕੁਝ ਹੈ। ਜੋ ਤੁਸੀਂ ਸੋਚਦੇ ਹੋ, ਉਹੀ ਬਣਦੇ ਹੋ।', author: 'ਬੁੱਧ' },
    { quote: 'ਬਿਨਾਂ ਜਾਂਚੀ ਜ਼ਿੰਦਗੀ ਜਿਊਣ ਯੋਗ ਨਹੀਂ।', author: 'ਸੁਕਰਾਤ' },
    { quote: 'ਸੱਚਾ ਗਿਆਨ ਇਹ ਜਾਣਨਾ ਹੈ ਕਿ ਤੁਸੀਂ ਕੁਝ ਨਹੀਂ ਜਾਣਦੇ।', author: 'ਸੁਕਰਾਤ' },
    { quote: 'ਔਖੀ ਘੜੀ ਵਿੱਚ ਮੌਕਾ ਲੁਕਿਆ ਹੁੰਦਾ ਹੈ।', author: 'ਅਲਬਰਟ ਆਈਨਸਟਾਈਨ' },
    { quote: 'ਆਪਣੇ ਆਪ ਨੂੰ ਜਾਣਨਾ ਸਾਰੇ ਗਿਆਨ ਦੀ ਸ਼ੁਰੂਆਤ ਹੈ।', author: 'ਅਰਸਤੂ' },
  ],
};

const MOCK_QUOTES_UR: Record<string, QuoteTextResult[]> = {
  motivational: [
    { quote: 'عظیم کام کرنے کا واحد طریقہ یہ ہے کہ آپ جو کرتے ہیں اس سے محبت کریں۔', author: 'سٹیو جابز' },
    { quote: 'یقین کرو کہ تم کر سکتے ہو، تم آدھے راستے پر ہو۔', author: 'تھیوڈور روزویلٹ' },
    { quote: 'کامیابی خوشی کی کنجی نہیں۔ خوشی کامیابی کی کنجی ہے۔', author: 'البرٹ شوائٹزر' },
    { quote: 'آپ کی حد — صرف آپ کا تصور ہے۔', author: 'نامعلوم' },
    { quote: 'اپنے آپ کو آگے بڑھاؤ، کیونکہ کوئی اور تمہارے لیے نہیں کرے گا۔', author: 'نامعلوم' },
  ],
  love: [
    { quote: 'محبت قبضہ نہیں، قدر ہے۔', author: 'نامعلوم' },
    { quote: 'زندگی میں سب سے بہترین چیز ایک دوسرے کو تھامے رکھنا ہے۔', author: 'آڈری ہیپبرن' },
    { quote: 'محبت موسیقی پر سجی دوستی ہے۔', author: 'جوزف کیمپبل' },
    { quote: 'جہاں محبت ہے وہاں زندگی ہے۔', author: 'مہاتما گاندھی' },
    { quote: 'محبت کرنا اور محبت پانا دونوں طرف سے دھوپ محسوس کرنا ہے۔', author: 'ڈیوڈ وسکوٹ' },
  ],
  islamic: [
    { quote: 'بے شک، مشکل کے ساتھ آسانی ہے۔', author: 'قرآن 94:6' },
    { quote: 'اور اس نے تمہیں بھٹکا ہوا پایا اور راہ دکھائی۔', author: 'قرآن 93:7' },
    { quote: 'پس بے شک، تکلیف کے ساتھ راحت ہے۔', author: 'قرآن 94:5' },
    { quote: 'اللہ کسی جان پر اس کی طاقت سے زیادہ بوجھ نہیں ڈالتا۔', author: 'قرآن 2:286' },
    { quote: 'تم میں سے بہترین وہ ہے جس کے اخلاق سب سے اچھے ہیں۔', author: 'حضرت محمد ﷺ' },
  ],
};

const MOCK_QUOTES_BN: Record<string, QuoteTextResult[]> = {
  motivational: [
    { quote: 'মহান কাজ করার একমাত্র উপায় হলো তুমি যা করো তা ভালোবাসো।', author: 'স্টিভ জবস' },
    { quote: 'বিশ্বাস করো তুমি পারবে, তুমি অর্ধেক পথে আছো।', author: 'থিওডোর রুজভেল্ট' },
    { quote: 'সাফল্য সুখের চাবি নয়। সুখ সাফল্যের চাবি।', author: 'আলবার্ট শোয়াইৎজার' },
    { quote: 'তোমার সীমাবদ্ধতা — শুধুমাত্র তোমার কল্পনা।', author: 'অজ্ঞাত' },
    { quote: 'নিজেকে এগিয়ে নিয়ে যাও, কারণ আর কেউ তোমার জন্য করবে না।', author: 'অজ্ঞাত' },
  ],
  love: [
    { quote: 'ভালোবাসা দখল নয়, প্রশংসা।', author: 'অজ্ঞাত' },
    { quote: 'জীবনে সবচেয়ে ভালো জিনিস হলো একে অপরকে ধরে রাখা।', author: 'অড্রে হেপবার্ন' },
    { quote: 'ভালোবাসা সঙ্গীতে বাঁধা বন্ধুত্ব।', author: 'জোসেফ ক্যাম্পবেল' },
    { quote: 'যেখানে ভালোবাসা, সেখানে জীবন।', author: 'মহাত্মা গান্ধী' },
    { quote: 'ভালোবাসা দেওয়া আর পাওয়া দুই দিক থেকে রোদ অনুভব করা।', author: 'ডেভিড ভিসকট' },
  ],
};

const MOCK_QUOTES_TA: Record<string, QuoteTextResult[]> = {
  motivational: [
    { quote: 'சிறந்த வேலை செய்வதற்கான ஒரே வழி நீங்கள் செய்வதை நேசிப்பதுதான்.', author: 'ஸ்டீவ் ஜாப்ஸ்' },
    { quote: 'நம்புங்கள் உங்களால் முடியும், நீங்கள் பாதி வழியில் இருக்கிறீர்கள்.', author: 'தியோடோர் ரூஸ்வெல்ட்' },
    { quote: 'வெற்றி மகிழ்ச்சியின் திறவுகோல் அல்ல. மகிழ்ச்சி வெற்றியின் திறவுகோல்.', author: 'ஆல்பர்ட் ஸ்வைட்சர்' },
    { quote: 'உங்கள் வரம்பு — உங்கள் கற்பனை மட்டுமே.', author: 'அறியப்படாதவர்' },
    { quote: 'உங்களை நீங்களே முன்னோக்கி தள்ளுங்கள், வேறு யாரும் உங்களுக்காக செய்ய மாட்டார்கள்.', author: 'அறியப்படாதவர்' },
  ],
};

const MOCK_QUOTES_TE: Record<string, QuoteTextResult[]> = {
  motivational: [
    { quote: 'గొప్ప పనిచేయడానికి ఏకైక మార్గం మీరు చేసేది ప్రేమించడం.', author: 'స్టీవ్ జాబ్స్' },
    { quote: 'మీరు చేయగలరని నమ్మండి, మీరు సగం దారిలో ఉన్నారు.', author: 'థియోడర్ రూజ్‌వెల్ట్' },
    { quote: 'విజయం ఆనందానికి తాళం చెవి కాదు. ఆనందం విజయానికి తాళం చెవి.', author: 'ఆల్బర్ట్ ష్వైట్జర్' },
    { quote: 'మీ పరిమితి — మీ ఊహ మాత్రమే.', author: 'తెలియనిది' },
    { quote: 'మిమ్మల్ని మీరు ముందుకు నెట్టుకోండి, ఎందుకంటే మీ కోసం ఎవరూ చేయరు.', author: 'తెలియనిది' },
  ],
};

const MOCK_QUOTES_MR: Record<string, QuoteTextResult[]> = {
  motivational: [
    { quote: 'उत्कृष्ट काम करण्याचा एकमेव मार्ग म्हणजे तुम्ही जे करता ते आवडणे.', author: 'स्टीव्ह जॉब्स' },
    { quote: 'विश्वास ठेवा की तुम्ही करू शकता, तुम्ही अर्ध्या वाटेवर आहात.', author: 'थिओडोर रुझवेल्ट' },
    { quote: 'यश आनंदाची गुरुकिल्ली नाही. आनंद यशाची गुरुकिल्ली आहे.', author: 'अल्बर्ट श्वाइत्झर' },
    { quote: 'तुमची मर्यादा — फक्त तुमची कल्पना आहे.', author: 'अज्ञात' },
    { quote: 'स्वतःला पुढे ढकला, कारण कोणी तुमच्यासाठी हे करणार नाही.', author: 'अज्ञात' },
  ],
};

const MOCK_QUOTES_GU: Record<string, QuoteTextResult[]> = {
  motivational: [
    { quote: 'મહાન કામ કરવાનો એકમાત્ર રસ્તો એ છે કે તમે જે કરો છો તેને પ્રેમ કરો.', author: 'સ્ટીવ જોબ્સ' },
    { quote: 'વિશ્વાસ કરો કે તમે કરી શકો છો, તમે અડધા રસ્તે છો.', author: 'થિયોડોર રૂઝવેલ્ટ' },
    { quote: 'સફળતા ખુશીની ચાવી નથી. ખુશી સફળતાની ચાવી છે.', author: 'આલ્બર્ટ શ્વાઈત્ઝર' },
    { quote: 'તમારી મર્યાદા — ફક્ત તમારી કલ્પના છે.', author: 'અજ્ઞાત' },
    { quote: 'તમારી જાતને આગળ ધકેલો, કારણ કે બીજું કોઈ તમારા માટે નહીં કરે.', author: 'અજ્ઞાત' },
  ],
};

// Map language codes to their mock quote sets
const MOCK_QUOTES_BY_LANG: Record<string, Record<string, QuoteTextResult[]>> = {
  en: MOCK_QUOTES_EN,
  hi: MOCK_QUOTES_HI,
  pa: MOCK_QUOTES_PA,
  ur: MOCK_QUOTES_UR,
  bn: MOCK_QUOTES_BN,
  ta: MOCK_QUOTES_TA,
  te: MOCK_QUOTES_TE,
  mr: MOCK_QUOTES_MR,
  gu: MOCK_QUOTES_GU,
};

function getMockQuotes(category: string, language: string): QuoteTextResult[] {
  const langQuotes = MOCK_QUOTES_BY_LANG[language] || MOCK_QUOTES_BY_LANG['hi'];
  // Try category in the language set, fall back to motivational, then to Hindi
  return langQuotes[category] || langQuotes['motivational'] || MOCK_QUOTES_HI['motivational'];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate 5 quote text variations using AI providers.
 * Returns an array of 5 {quote, author} objects.
 */
export async function generateQuoteVariations(
  category: string,
  language: string,
  userPrompt?: string,
  quoteLength?: string,
): Promise<QuoteTextResult[]> {
  // DEV_MODE: return mock quotes
  if (process.env.DEV_MODE === 'true') {
    log.info({ category, language }, 'DEV_MODE: Returning mock quotes');
    return getMockQuotes(category, language);
  }

  const effectiveLength = quoteLength || 'medium';
  const provider = getPreferredProvider();
  const maxTokens = effectiveLength === 'long' ? 4000 : effectiveLength === 'medium' ? 2500 : 1500;
  const minWords = getMinWordCount(effectiveLength);
  const MAX_ATTEMPTS = 2;

  // Build provider chain — only include providers with valid API keys
  const allProviders: string[] = [];
  if (provider !== 'auto') allProviders.push(provider);
  for (const p of ['gemini', 'anthropic', 'openai']) {
    if (!allProviders.includes(p)) allProviders.push(p);
  }
  // Filter to only providers with keys
  const providers = allProviders.filter((p) => {
    if (p === 'gemini') return !!process.env.GEMINI_API_KEY;
    if (p === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
    if (p === 'openai') return !!process.env.OPENAI_API_KEY;
    return false;
  });

  log.info({ category, language, providers, quoteLength: effectiveLength, maxTokens, minWords, userPrompt: userPrompt?.substring(0, 50) }, 'Generating 5 quote variations');

  if (providers.length === 0) {
    log.warn('No AI provider keys configured, returning mock quotes');
    return getMockQuotes(category, language);
  }

  for (const p of providers) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // Rebuild prompt each attempt for fresh random direction
        const prompt = buildQuotePrompt(category, language, userPrompt, effectiveLength);
        let responseText: string;

        if (p === 'gemini') {
          responseText = await callGemini(prompt, maxTokens, 0.9 + (attempt - 1) * 0.05);
        } else if (p === 'anthropic') {
          const client = getAnthropicClient();
          const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: maxTokens,
            temperature: 0.9 + (attempt - 1) * 0.05,
            messages: [{ role: 'user', content: prompt }],
          });
          responseText = response.content[0].type === 'text' ? response.content[0].text : '';
        } else if (p === 'openai') {
          const client = getOpenAIClient();
          const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: maxTokens,
            temperature: 0.9 + (attempt - 1) * 0.05,
            messages: [{ role: 'user', content: prompt }],
          });
          responseText = response.choices[0]?.message?.content || '';
        } else {
          break;
        }

        // Strip markdown code blocks (```json ... ```) before parsing
        let cleanedResponse = responseText;
        const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          cleanedResponse = codeBlockMatch[1].trim();
        }

        // Parse JSON array response
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          log.warn({ provider: p, attempt, responseText: responseText.substring(0, 300) }, 'Failed to parse JSON from response');
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]) as Array<{ quote: string; author: string }>;
        if (!Array.isArray(parsed) || parsed.length < 1) {
          log.warn({ provider: p, attempt }, 'Parsed result is not a valid array');
          continue;
        }

        const variations = parsed
          .filter((item) => item.quote)
          .slice(0, 5)
          .map((item) => ({ quote: item.quote, author: item.author || 'Unknown' }));

        if (variations.length < 1) continue;

        // Check word counts
        const wordCounts = variations.map((v) => v.quote.split(/\s+/).length);
        const avgWords = Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);

        log.info(
          { provider: p, category, attempt, count: variations.length, quoteLength: effectiveLength, wordCounts, avgWords, minWords },
          'Quote variations generated',
        );

        // If average word count is too low and we have retries left, try again
        if (avgWords < minWords && attempt < MAX_ATTEMPTS) {
          log.warn(
            { avgWords, minWords, quoteLength: effectiveLength, attempt },
            'Quotes too short for requested length, retrying with fresh prompt',
          );
          continue;
        }

        return variations;
      } catch (err) {
        log.warn({ provider: p, attempt, err }, 'Quote generation failed');
        break; // Try next provider
      }
    }
  }

  // Final fallback to mock
  log.warn('All providers failed, returning mock quotes');
  return getMockQuotes(category, language);
}
