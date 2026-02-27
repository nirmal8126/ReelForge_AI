import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'challenge-content-generator' });

// ---------------------------------------------------------------------------
// Clients (lazy-initialised)
// ---------------------------------------------------------------------------

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return openaiClient;
}

function getPreferredProvider(): 'gemini' | 'anthropic' | 'openai' | 'auto' {
  const value = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (value === 'gemini' || value === 'anthropic' || value === 'openai') return value;
  return 'auto';
}

// ---------------------------------------------------------------------------
// Gemini API (native fetch – no SDK needed)
// ---------------------------------------------------------------------------

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
          responseMimeType: 'application/json',
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

export interface ChallengeQuestion {
  hookText: string;
  question: string;
  options?: string[];        // for gk_quiz (4 MCQ options)
  emojis?: string;           // for emoji_guess
  optionA?: string;          // for would_you_rather
  optionB?: string;          // for would_you_rather
  answer: string;
  explanation?: string;
}

export interface ChallengeContent {
  questions: ChallengeQuestion[];
  ctaText: string;
}

// ---------------------------------------------------------------------------
// Language name mapping
// ---------------------------------------------------------------------------

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English', hi: 'Hindi', pa: 'Punjabi', ur: 'Urdu',
    bn: 'Bengali', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', gu: 'Gujarati',
  };
  return names[code] || 'English';
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildChallengePrompt(
  challengeType: string,
  category: string,
  difficulty: string,
  numQuestions: number,
  language: string,
  userPrompt?: string,
): string {
  const langName = getLanguageName(language);

  const typeInstructions: Record<string, string> = {
    emoji_guess: `Generate "Guess the Emoji" challenges. Each question should have 3-5 emojis that represent a movie, song, phrase, or famous person. The answer is what the emojis represent.
Return each question with: hookText, emojis (the emoji string), question (e.g. "Can you guess the movie?"), answer.`,

    riddle: `Generate clever riddle challenges. Each riddle should be thought-provoking and fun, appropriate for the ${difficulty} difficulty level.
Return each question with: hookText, question (the riddle text), answer, explanation (brief explanation of the answer).`,

    math: `Generate quick math problems. Difficulty: ${difficulty} (easy=basic arithmetic, medium=multi-step, hard=algebra/fractions, impossible=complex mental math).
Return each question with: hookText, question (the math problem as text), answer (the number/result).`,

    gk_quiz: `Generate general knowledge / trivia multiple-choice questions. Each question must have exactly 4 options with one correct answer.
Return each question with: hookText, question, options (array of 4 strings), answer (the correct option text).`,

    would_you_rather: `Generate fun "Would You Rather" dilemmas. Make them creative, thought-provoking, and conversation-starting. No correct answer — both options should be interesting.
Return each question with: hookText, question ("Would you rather..."), optionA, optionB, answer ("Comment A or B!").`,
  };

  const randomSeed = Math.random().toString(36).substring(2, 10);

  return `You are an expert viral social media content creator. Generate ${numQuestions} UNIQUE and ORIGINAL interactive ${challengeType.replace(/_/g, ' ')} challenge(s) in ${langName}.

Category: ${category}
Difficulty: ${difficulty}
Seed: ${randomSeed}
${userPrompt ? `Additional context: ${userPrompt}` : ''}

${typeInstructions[challengeType] || typeInstructions['riddle']}

Rules:
- ALL text must be in ${langName}${language !== 'en' ? '. Do NOT write in English.' : ''}
- hookText should be a short attention-grabbing line (e.g., "Can YOU solve this?", "Only 1% get this right!")
- Make content engaging, fun, and shareable
- Generate COMPLETELY DIFFERENT questions every time — never repeat previous content. Use the seed "${randomSeed}" to inspire fresh, creative variations.
- ${difficulty === 'easy' ? 'Keep it simple and accessible' : difficulty === 'hard' ? 'Make it genuinely challenging' : difficulty === 'impossible' ? 'Make it extremely difficult — only experts should get it' : 'Balance challenge and fun'}
- Category "${category}" should influence the topic/theme of questions

Also generate ONE engaging CTA (Call to Action) text in ${langName} that encourages comments, shares, or follows (e.g., "Comment your answer!", "Tag a friend who can solve this!").

Return ONLY valid JSON in this exact format:
{"questions": [${Array.from({ length: numQuestions }, () => '{...question fields...}').join(', ')}], "ctaText": "your CTA text"}`;
}

// ---------------------------------------------------------------------------
// Mock content for DEV_MODE
// ---------------------------------------------------------------------------

function getMockContent(
  challengeType: string,
  numQuestions: number,
  language: string,
): ChallengeContent {
  const isHindi = language === 'hi';

  const mockByType: Record<string, ChallengeQuestion[]> = {
    emoji_guess: [
      { hookText: isHindi ? 'क्या आप यह guess कर सकते हैं? 🤔' : 'Can YOU guess this? 🤔', question: isHindi ? 'इन emojis से कौन सी फिल्म है?' : 'What movie do these emojis represent?', emojis: '🦁👑🌅', answer: isHindi ? 'द लायन किंग' : 'The Lion King' },
      { hookText: isHindi ? 'सिर्फ 1% लोग बता पाए! 🔥' : 'Only 1% got this right! 🔥', question: isHindi ? 'यह कौन सी फिल्म है?' : 'Which movie is this?', emojis: '🕷️🧑🏙️', answer: isHindi ? 'स्पाइडर-मैन' : 'Spider-Man' },
      { hookText: isHindi ? 'यह तो आसान है! 😏' : 'This one is easy! 😏', question: isHindi ? 'इन emojis से क्या बनता है?' : 'What do these emojis mean?', emojis: '❄️👸⛄', answer: isHindi ? 'फ्रोज़न' : 'Frozen' },
      { hookText: isHindi ? 'बताओ कौन सी फिल्म? 🎬' : 'Name this movie! 🎬', question: isHindi ? 'यह emojis किस फिल्म को दर्शाते हैं?' : 'What movie is shown?', emojis: '🚢💑🧊', answer: isHindi ? 'टाइटैनिक' : 'Titanic' },
      { hookText: isHindi ? 'Genius ही बता पाएगा! 🧠' : 'Only a genius gets this! 🧠', question: isHindi ? 'कौन सी फिल्म?' : 'Which movie?', emojis: '🐀👨‍🍳🇫🇷', answer: isHindi ? 'रैटाटूई' : 'Ratatouille' },
      { hookText: isHindi ? 'यह कठिन है! 💪' : 'This is tricky! 💪', question: isHindi ? 'कौन सा गाना?' : 'What song is this?', emojis: '🌧️☔💜', answer: isHindi ? 'पर्पल रेन' : 'Purple Rain' },
      { hookText: isHindi ? '10 सेकंड में बताओ! ⏱️' : '10 seconds to guess! ⏱️', question: isHindi ? 'यह कौन सी फिल्म है?' : 'Name the movie!', emojis: '🧙‍♂️💍🌋', answer: isHindi ? 'लॉर्ड ऑफ द रिंग्स' : 'Lord of the Rings' },
      { hookText: isHindi ? 'बच्चों की फेवरिट! 🎉' : 'Kids favorite! 🎉', question: isHindi ? 'कौन सी फिल्म?' : 'Which movie?', emojis: '🤖🚀♾️', answer: isHindi ? 'वॉल-ई' : 'WALL-E' },
      { hookText: isHindi ? 'हिंट: सुपरहीरो! 🦸' : 'Hint: Superhero! 🦸', question: isHindi ? 'कौन सी फिल्म?' : 'Which movie?', emojis: '🦇🌃🃏', answer: isHindi ? 'द डार्क नाइट' : 'The Dark Knight' },
      { hookText: isHindi ? 'Classic फिल्म! 🎥' : 'Classic film! 🎥', question: isHindi ? 'कौन सी फिल्म?' : 'Which movie?', emojis: '👻🔫🏚️', answer: isHindi ? 'घोस्टबस्टर्स' : 'Ghostbusters' },
    ],
    riddle: [
      { hookText: isHindi ? 'यह पहेली सुलझाओ! 🧩' : 'Solve this riddle! 🧩', question: isHindi ? 'मेरे पास चाबियां हैं पर कोई ताला नहीं। मैं क्या हूं?' : 'I have keys but no locks. What am I?', answer: isHindi ? 'कीबोर्ड' : 'A keyboard', explanation: isHindi ? 'कीबोर्ड में keys होती हैं पर ताले नहीं!' : 'A keyboard has keys but no locks!' },
      { hookText: isHindi ? 'दिमाग लगाओ! 🤯' : 'Think hard! 🤯', question: isHindi ? 'जितना ज़्यादा लो, उतना ज़्यादा पीछे छोड़ो। मैं क्या हूं?' : 'The more you take, the more you leave behind. What am I?', answer: isHindi ? 'क़दम' : 'Footsteps', explanation: isHindi ? 'जब आप चलते हैं, हर क़दम पीछे रह जाता है!' : 'Each step leaves a footprint behind!' },
      { hookText: isHindi ? 'क्या आप बता सकते हैं? 🔍' : 'Can you figure it out? 🔍', question: isHindi ? 'मेरा रंग काला है, पर मैं अंधेरे में नहीं दिखता। मैं क्या हूं?' : 'I am black when clean and white when dirty. What am I?', answer: isHindi ? 'ब्लैकबोर्ड' : 'A chalkboard' },
      { hookText: isHindi ? '5 सेकंड में बताओ! ⏰' : '5 seconds to answer! ⏰', question: isHindi ? 'मेरे पास हाथ हैं पर मैं ताली नहीं बजा सकता। मैं क्या हूं?' : 'I have hands but I can not clap. What am I?', answer: isHindi ? 'घड़ी' : 'A clock' },
      { hookText: isHindi ? 'Impossible! 😱' : 'Impossible! 😱', question: isHindi ? 'मैं हमेशा आता हूं पर कभी नहीं पहुंचता। मैं क्या हूं?' : 'I am always coming but never arrive. What am I?', answer: isHindi ? 'कल (Tomorrow)' : 'Tomorrow' },
      { hookText: isHindi ? 'सोचो सोचो! 💭' : 'Think think! 💭', question: isHindi ? 'मेरे पास शहर हैं पर कोई घर नहीं, जंगल हैं पर पेड़ नहीं। मैं क्या हूं?' : 'I have cities but no houses, forests but no trees. What am I?', answer: isHindi ? 'नक्शा' : 'A map', explanation: isHindi ? 'नक्शे में शहर और जंगल दिखते हैं पर असली नहीं होते!' : 'A map shows cities and forests but they are not real!' },
      { hookText: isHindi ? 'दिमागी कसरत! 🏋️' : 'Brain workout! 🏋️', question: isHindi ? 'मैं भारी नहीं हूं पर दुनिया का सबसे ताकतवर आदमी भी मुझे 5 मिनट तक नहीं पकड़ सकता। मैं क्या हूं?' : 'I am not heavy but the strongest person cannot hold me for 5 minutes. What am I?', answer: isHindi ? 'सांस' : 'Your breath', explanation: isHindi ? 'कोई भी 5 मिनट तक सांस नहीं रोक सकता!' : 'Nobody can hold their breath for 5 minutes!' },
      { hookText: isHindi ? 'बूझो तो जानें! 🎯' : 'Guess if you can! 🎯', question: isHindi ? 'मुझे तोड़ो बिना छुए। मैं क्या हूं?' : 'Break me without touching me. What am I?', answer: isHindi ? 'वादा' : 'A promise', explanation: isHindi ? 'वादा बिना छुए टूट सकता है!' : 'A promise can be broken without touching!' },
      { hookText: isHindi ? 'IQ 150+ चाहिए! 🧪' : 'IQ 150+ needed! 🧪', question: isHindi ? 'जो बनाता है वो बेचता है, जो खरीदता है वो इस्तेमाल नहीं करता, जो इस्तेमाल करता है उसे पता नहीं। मैं क्या हूं?' : 'The maker does not want it, the buyer does not use it, the user never sees it. What am I?', answer: isHindi ? 'ताबूत' : 'A coffin' },
      { hookText: isHindi ? 'ट्रिकी सवाल! 🎪' : 'Tricky one! 🎪', question: isHindi ? 'मेरे पास सिर है और पूंछ भी, पर कोई शरीर नहीं। मैं क्या हूं?' : 'I have a head and a tail but no body. What am I?', answer: isHindi ? 'सिक्का' : 'A coin', explanation: isHindi ? 'सिक्के में हेड और टेल होता है!' : 'A coin has a head side and a tail side!' },
    ],
    math: [
      { hookText: isHindi ? '5 सेकंड में हल करो! ⚡' : 'Solve in 5 seconds! ⚡', question: '25 × 4 + 13 = ?', answer: '113' },
      { hookText: isHindi ? 'यह कर के दिखाओ! 🔥' : 'Try this one! 🔥', question: '144 ÷ 12 + 8 = ?', answer: '20' },
      { hookText: isHindi ? 'दिमाग चकरा जाएगा! 🌀' : 'Mind blown! 🌀', question: '15 × 3 - 17 + 9 = ?', answer: '37' },
      { hookText: isHindi ? 'Genius Test! 🧠' : 'Genius Test! 🧠', question: '(50 + 30) × 2 - 45 = ?', answer: '115' },
      { hookText: isHindi ? 'Calculator मत उठाना! 🚫' : 'No calculator allowed! 🚫', question: '999 + 1 × 0 + 1 = ?', answer: '1000' },
      { hookText: isHindi ? '3 सेकंड! ⏱️' : '3 seconds! ⏱️', question: '12 × 12 - 44 = ?', answer: '100' },
      { hookText: isHindi ? 'Mental Math! 🧮' : 'Mental Math! 🧮', question: '250 ÷ 5 + 75 = ?', answer: '125' },
      { hookText: isHindi ? 'सिर्फ Topper बता पाएगा! 📐' : 'Only toppers get this! 📐', question: '√169 + √144 = ?', answer: '25' },
      { hookText: isHindi ? 'Speed Test! 🏎️' : 'Speed Test! 🏎️', question: '33 × 3 + 1 = ?', answer: '100' },
      { hookText: isHindi ? 'दिमाग तेज़ करो! ⚙️' : 'Sharpen your brain! ⚙️', question: '1000 - 777 + 277 = ?', answer: '500' },
    ],
    gk_quiz: [
      { hookText: isHindi ? 'GK Quiz Time! 📚' : 'GK Quiz Time! 📚', question: isHindi ? 'दुनिया का सबसे बड़ा महासागर कौन सा है?' : 'What is the largest ocean on Earth?', options: isHindi ? ['प्रशांत महासागर', 'अटलांटिक महासागर', 'हिंद महासागर', 'आर्कटिक महासागर'] : ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'], answer: isHindi ? 'प्रशांत महासागर' : 'Pacific Ocean' },
      { hookText: isHindi ? 'बताओ सही जवाब! 🎯' : 'Pick the right answer! 🎯', question: isHindi ? 'मोना लिसा किसने बनाई?' : 'Who painted the Mona Lisa?', options: isHindi ? ['लियोनार्डो दा विंची', 'माइकलएंजेलो', 'पिकासो', 'वैन गॉग'] : ['Leonardo da Vinci', 'Michelangelo', 'Picasso', 'Van Gogh'], answer: isHindi ? 'लियोनार्डो दा विंची' : 'Leonardo da Vinci' },
      { hookText: isHindi ? 'सोचो और बताओ! 💭' : 'Think and answer! 💭', question: isHindi ? 'पृथ्वी सूर्य का चक्कर कितने दिनों में लगाती है?' : 'How many days does Earth take to orbit the Sun?', options: ['365', '360', '400', '300'], answer: '365' },
      { hookText: isHindi ? 'यह तो आना चाहिए! 😤' : 'You should know this! 😤', question: isHindi ? 'भारत की राजधानी क्या है?' : 'What is the capital of Japan?', options: isHindi ? ['नई दिल्ली', 'मुंबई', 'कोलकाता', 'चेन्नई'] : ['Tokyo', 'Osaka', 'Kyoto', 'Nagoya'], answer: isHindi ? 'नई दिल्ली' : 'Tokyo' },
      { hookText: isHindi ? 'IQ Test! 🧪' : 'IQ Test! 🧪', question: isHindi ? 'पानी का रासायनिक सूत्र क्या है?' : 'What is the chemical formula of water?', options: ['H2O', 'CO2', 'NaCl', 'O2'], answer: 'H2O' },
      { hookText: isHindi ? 'Geography Time! 🌍' : 'Geography Time! 🌍', question: isHindi ? 'दुनिया का सबसे ऊंचा पर्वत कौन सा है?' : 'What is the tallest mountain in the world?', options: isHindi ? ['माउंट एवरेस्ट', 'K2', 'कंचनजंगा', 'मकालू'] : ['Mount Everest', 'K2', 'Kangchenjunga', 'Makalu'], answer: isHindi ? 'माउंट एवरेस्ट' : 'Mount Everest' },
      { hookText: isHindi ? 'Science Quiz! 🔬' : 'Science Quiz! 🔬', question: isHindi ? 'प्रकाश की गति कितनी है?' : 'What is the speed of light?', options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '100,000 km/s'], answer: '300,000 km/s' },
      { hookText: isHindi ? 'History Time! 📜' : 'History Time! 📜', question: isHindi ? 'भारत को आज़ादी कब मिली?' : 'In which year did World War II end?', options: isHindi ? ['1947', '1950', '1942', '1945'] : ['1945', '1944', '1946', '1943'], answer: isHindi ? '1947' : '1945' },
      { hookText: isHindi ? 'Space Quiz! 🚀' : 'Space Quiz! 🚀', question: isHindi ? 'सूर्य से सबसे नज़दीकी ग्रह कौन सा है?' : 'Which planet is closest to the Sun?', options: isHindi ? ['बुध', 'शुक्र', 'पृथ्वी', 'मंगल'] : ['Mercury', 'Venus', 'Earth', 'Mars'], answer: isHindi ? 'बुध' : 'Mercury' },
      { hookText: isHindi ? 'Sports Quiz! ⚽' : 'Sports Quiz! ⚽', question: isHindi ? 'ओलंपिक खेल कितने साल में एक बार होते हैं?' : 'How often are the Olympic Games held?', options: isHindi ? ['4 साल', '2 साल', '3 साल', '5 साल'] : ['Every 4 years', 'Every 2 years', 'Every 3 years', 'Every 5 years'], answer: isHindi ? '4 साल' : 'Every 4 years' },
    ],
    would_you_rather: [
      { hookText: isHindi ? 'A या B बताओ! 🤔' : 'Choose A or B! 🤔', question: isHindi ? 'आप क्या चुनोगे?' : 'Would you rather...', optionA: isHindi ? 'उड़ने की शक्ति' : 'Fly anywhere', optionB: isHindi ? 'अदृश्य होने की शक्ति' : 'Be invisible', answer: isHindi ? 'कमेंट में A या B लिखो!' : 'Comment A or B!' },
      { hookText: isHindi ? 'मुश्किल सवाल! 😅' : 'Tough one! 😅', question: isHindi ? 'आप क्या चुनोगे?' : 'Would you rather...', optionA: isHindi ? 'हमेशा सच बोलना' : 'Always tell the truth', optionB: isHindi ? 'हमेशा झूठ बोलना' : 'Always lie', answer: isHindi ? 'अपना जवाब कमेंट करो!' : 'Drop your answer below!' },
      { hookText: isHindi ? 'यह सोचो! 💭' : 'Think about this! 💭', question: isHindi ? 'आप क्या चुनोगे?' : 'Would you rather...', optionA: isHindi ? '₹1 करोड़ अभी' : '$1 million now', optionB: isHindi ? '₹1 लाख हर महीने ज़िन्दगी भर' : '$10,000 every month for life', answer: isHindi ? 'कमेंट करो A या B!' : 'Comment A or B!' },
      { hookText: isHindi ? 'सिर्फ एक चुनो! ☝️' : 'Pick only one! ☝️', question: isHindi ? 'आप क्या चुनोगे?' : 'Would you rather...', optionA: isHindi ? 'समय में वापस जाना' : 'Travel to the past', optionB: isHindi ? 'भविष्य में जाना' : 'Travel to the future', answer: isHindi ? 'बताओ कमेंट में!' : 'Tell us in the comments!' },
      { hookText: isHindi ? 'Impossible Choice! 😱' : 'Impossible Choice! 😱', question: isHindi ? 'आप क्या चुनोगे?' : 'Would you rather...', optionA: isHindi ? 'कभी फोन नहीं इस्तेमाल करना' : 'Never use a phone again', optionB: isHindi ? 'कभी इंटरनेट नहीं इस्तेमाल करना' : 'Never use the internet again', answer: isHindi ? 'A या B? कमेंट करो!' : 'A or B? Comment now!' },
      { hookText: isHindi ? 'सोच के बताओ! 🧠' : 'Think carefully! 🧠', question: isHindi ? 'आप क्या चुनोगे?' : 'Would you rather...', optionA: isHindi ? 'दिमाग पढ़ने की शक्ति' : 'Read minds', optionB: isHindi ? 'भविष्य देखने की शक्ति' : 'See the future', answer: isHindi ? 'कमेंट में बताओ!' : 'Comment below!' },
      { hookText: isHindi ? 'Crazy सवाल! 🤪' : 'Crazy question! 🤪', question: isHindi ? 'आप क्या चुनोगे?' : 'Would you rather...', optionA: isHindi ? 'हमेशा गर्मी' : 'Always summer', optionB: isHindi ? 'हमेशा सर्दी' : 'Always winter', answer: isHindi ? 'A या B लिखो!' : 'Type A or B!' },
      { hookText: isHindi ? 'कठिन फैसला! ⚖️' : 'Hard decision! ⚖️', question: isHindi ? 'आप क्या चुनोगे?' : 'Would you rather...', optionA: isHindi ? 'कभी न सोना' : 'Never sleep again', optionB: isHindi ? 'कभी न खाना' : 'Never eat again', answer: isHindi ? 'जवाब दो!' : 'Answer now!' },
      { hookText: isHindi ? 'Fun Choice! 🎮' : 'Fun Choice! 🎮', question: isHindi ? 'आप क्या चुनोगे?' : 'Would you rather...', optionA: isHindi ? 'सभी भाषाएं बोलना' : 'Speak every language', optionB: isHindi ? 'सभी वाद्ययंत्र बजाना' : 'Play every instrument', answer: isHindi ? 'कमेंट करो!' : 'Comment your pick!' },
      { hookText: isHindi ? 'दिल या दिमाग? ❤️' : 'Heart or brain? ❤️', question: isHindi ? 'आप क्या चुनोगे?' : 'Would you rather...', optionA: isHindi ? 'बहुत अमीर पर अकेले' : 'Very rich but alone', optionB: isHindi ? 'गरीब पर प्यार भरा परिवार' : 'Poor but with loving family', answer: isHindi ? 'A या B?' : 'A or B?' },
    ],
  };

  const allQuestions = [...(mockByType[challengeType] || mockByType['riddle'])];
  // Shuffle so each challenge gets different questions
  for (let i = allQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
  }
  const questions = allQuestions.slice(0, numQuestions);

  return {
    questions,
    ctaText: isHindi
      ? 'अगर सही जवाब पता है तो कमेंट करो! 🔥 और फॉलो करो रोज़ नई चैलेंज के लिए!'
      : 'Comment your answer below! 🔥 Follow for daily challenges!',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateChallengeContent(
  challengeType: string,
  category: string,
  difficulty: string,
  numQuestions: number,
  language: string,
  userPrompt?: string,
): Promise<ChallengeContent> {
  // DEV_MODE: return mock content
  if (process.env.DEV_MODE === 'true') {
    log.info({ challengeType, category, numQuestions, language }, 'DEV_MODE: Returning mock challenge content');
    return getMockContent(challengeType, numQuestions, language);
  }

  const prompt = buildChallengePrompt(challengeType, category, difficulty, numQuestions, language, userPrompt);
  const provider = getPreferredProvider();

  // Build provider chain — Gemini first (most reliable in this codebase), then Anthropic, then OpenAI
  const allProviders = ['gemini', 'anthropic', 'openai'];
  const providers =
    provider === 'auto'
      ? allProviders
      : [provider, ...allProviders.filter((p) => p !== provider)];

  log.info({ challengeType, category, difficulty, numQuestions, language, provider, chain: providers }, 'Generating challenge content');

  for (const p of providers) {
    try {
      let responseText: string;

      if (p === 'gemini') {
        responseText = await callGemini(prompt, 2000, 0.9);
      } else if (p === 'anthropic') {
        const client = getAnthropicClient();
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          temperature: 0.9,
          messages: [{ role: 'user', content: prompt }],
        });
        responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      } else if (p === 'openai') {
        const client = getOpenAIClient();
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 2000,
          temperature: 0.9,
          messages: [{ role: 'user', content: prompt }],
        });
        responseText = response.choices[0]?.message?.content || '';
      } else {
        continue;
      }

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ChallengeContent;
        if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length >= 1) {
          log.info({ provider: p, questionCount: parsed.questions.length }, 'Challenge content generated');
          return {
            questions: parsed.questions.slice(0, numQuestions),
            ctaText: parsed.ctaText || 'Comment your answer! Follow for more!',
          };
        }
      }

      log.warn({ provider: p, responseText: responseText.substring(0, 200) }, 'Failed to parse challenge content');
    } catch (err) {
      log.warn({ provider: p, err }, 'Challenge content generation failed, trying next...');
    }
  }

  // Final fallback to mock
  log.warn('All providers failed, returning mock challenge content');
  return getMockContent(challengeType, numQuestions, language);
}
