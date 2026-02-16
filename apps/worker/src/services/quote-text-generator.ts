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
    hi: 'Hindi (हिन्दी)',
    pa: 'Punjabi',
    ur: 'Urdu (اردو)',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi',
    gu: 'Gujarati',
  };
  return names[code] || 'English';
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildQuotePrompt(category: string, language: string, userPrompt?: string): string {
  const langName = getLanguageName(language);
  return `You are a creative quote generator. Generate a single beautiful, original ${category} quote in ${langName}.
${userPrompt ? `\nThe user wants the quote to be about: ${userPrompt}` : ''}

Rules:
- The quote must be original, meaningful, and emotionally resonant
- Keep it concise (1-3 sentences, under 200 characters preferred)
- For the author field, create a believable attribution or use "Unknown" for anonymous wisdom
- For Islamic category: use wisdom from Quran/Hadith references appropriately
- For Hindi Shayari: write in proper shayari style with rhyming couplets
- Write the quote in ${langName}

Return ONLY valid JSON in this exact format:
{"quote": "the quote text here", "author": "Author Name"}`;
}

// ---------------------------------------------------------------------------
// Mock quotes for DEV_MODE
// ---------------------------------------------------------------------------

const MOCK_QUOTES: Record<string, QuoteTextResult> = {
  motivational: { quote: 'The only way to do great work is to love what you do.', author: 'Unknown' },
  love: { quote: "Love is not about possession, it's about appreciation.", author: 'Unknown' },
  funny: { quote: "I'm not lazy, I'm on energy saving mode.", author: 'Unknown' },
  wisdom: { quote: 'The mind is everything. What you think, you become.', author: 'Buddha' },
  success: { quote: 'Success is not final, failure is not fatal.', author: 'Winston Churchill' },
  life: { quote: "Life is what happens while you're busy making plans.", author: 'John Lennon' },
  friendship: { quote: 'A real friend walks in when the rest of the world walks out.', author: 'Walter Winchell' },
  islamic: { quote: 'Indeed, with hardship comes ease.', author: 'Quran 94:6' },
  shayari: { quote: 'ज़िन्दगी में कुछ पाना हो तो तरीके बदलो, इरादे नहीं।', author: 'Unknown' },
  custom: { quote: 'Every moment is a fresh beginning.', author: 'T.S. Eliot' },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a quote text using AI providers.
 * Uses the configured AI_PROVIDER with automatic fallback.
 * Falls back to mock quotes in DEV_MODE or when all providers fail.
 */
export async function generateQuoteText(
  category: string,
  language: string,
  userPrompt?: string,
): Promise<QuoteTextResult> {
  // DEV_MODE: return mock quote
  if (process.env.DEV_MODE === 'true') {
    log.info({ category, language }, 'DEV_MODE: Returning mock quote');
    const mock = MOCK_QUOTES[category] || MOCK_QUOTES.motivational;
    return mock;
  }

  const prompt = buildQuotePrompt(category, language, userPrompt);
  const provider = getPreferredProvider();

  // Try providers in order: preferred -> anthropic -> openai
  const providers =
    provider === 'auto'
      ? ['anthropic', 'openai']
      : [provider, ...(provider !== 'anthropic' ? ['anthropic'] : []), ...(provider !== 'openai' ? ['openai'] : [])];

  log.info({ category, language, provider, userPrompt: userPrompt?.substring(0, 50) }, 'Generating quote text');

  for (const p of providers) {
    try {
      let responseText: string;

      if (p === 'anthropic') {
        const client = getAnthropicClient();
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        });
        responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      } else if (p === 'openai') {
        const client = getOpenAIClient();
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        });
        responseText = response.choices[0]?.message?.content || '';
      } else {
        continue; // gemini not implemented for quotes yet
      }

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.quote) {
          log.info({ provider: p, category, quoteLength: parsed.quote.length }, 'Quote generated');
          return { quote: parsed.quote, author: parsed.author || 'Unknown' };
        }
      }

      log.warn({ provider: p, responseText }, 'Failed to parse quote response');
    } catch (err) {
      log.warn({ provider: p, err }, 'Quote generation failed with provider, trying next...');
    }
  }

  // Final fallback to mock
  log.warn('All providers failed, returning mock quote');
  return MOCK_QUOTES[category] || MOCK_QUOTES.motivational;
}
