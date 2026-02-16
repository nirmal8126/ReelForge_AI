import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'script-generator' });

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
  if (value === 'gemini' || value === 'anthropic' || value === 'openai') {
    return value;
  }
  return 'auto';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScriptGenerationOptions {
  prompt: string;
  tone: string;
  niche: string;
  language: string;
  durationSeconds: number;
  hookStyle: string;
}

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English',
    es: 'Spanish (Español)',
    fr: 'French (Français)',
    de: 'German (Deutsch)',
    it: 'Italian (Italiano)',
    pt: 'Portuguese (Português)',
    ja: 'Japanese (日本語)',
    ko: 'Korean (한국어)',
    zh: 'Chinese (中文)',
    ar: 'Arabic (العربية)',
    hi: 'Hindi (हिन्दी)',
    pl: 'Polish (Polski)',
  };
  return names[code] || 'English';
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(opts: ScriptGenerationOptions): string {
  // More generous word count: 3 words/sec for short videos, 2.5 for longer
  const wordsPerSecond = opts.durationSeconds <= 10 ? 3 : 2.5;
  const wordTarget = Math.round(opts.durationSeconds * wordsPerSecond);
  const languageName = getLanguageName(opts.language);

  return `You are an expert short-form video scriptwriter specialising in ${opts.niche} content.

CRITICAL: Write the ENTIRE script in ${languageName} language. Every word must be in ${languageName}.

REQUIREMENTS:
- Language: ${languageName} (ISO code: ${opts.language})
- Tone: ${opts.tone.toLowerCase()}
- Duration: ~${opts.durationSeconds} seconds (~${wordTarget} words)
- Hook style: ${opts.hookStyle}
- Write ONLY the spoken script — no stage directions, no timestamps, no emojis.
- CRITICAL: Write a COMPLETE script with proper ending. Do NOT cut off mid-sentence.

STRUCTURE (ALL THREE PARTS REQUIRED):
1. HOOK (first 3 seconds) — grab attention immediately using a ${opts.hookStyle} style hook in ${languageName}.
2. BODY — deliver the core value clearly and concisely with complete thoughts in ${languageName}.
3. CTA — end with a strong, complete call-to-action in ${languageName} (follow, like, comment, share).

IMPORTANT: Ensure the script conveys a complete message from start to finish. Every sentence must be complete. The CTA must be present and complete.

Output the raw script text only. Do not include labels like "Hook:", "Body:", "CTA:" in the final output.`;
}

// ---------------------------------------------------------------------------
// Primary: Anthropic Claude
// ---------------------------------------------------------------------------

async function generateWithClaude(opts: ScriptGenerationOptions): Promise<string> {
  const client = getAnthropicClient();
  const languageName = getLanguageName(opts.language);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    system: buildSystemPrompt(opts),
    messages: [
      {
        role: 'user',
        content: `Write a short-form video script in ${languageName} about: ${opts.prompt}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Anthropic response');
  }

  return textBlock.text.trim();
}

// ---------------------------------------------------------------------------
// Fallback: OpenAI GPT-4
// ---------------------------------------------------------------------------

async function generateWithOpenAI(opts: ScriptGenerationOptions): Promise<string> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4',
    max_tokens: 1024,
    temperature: 0.8,
    messages: [
      { role: 'system', content: buildSystemPrompt(opts) },
      { role: 'user', content: `Write a short-form video script about: ${opts.prompt}` },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  return content.trim();
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

async function generateWithGemini(opts: ScriptGenerationOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const languageName = getLanguageName(opts.language);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `Write a short-form video script in ${languageName} about: ${opts.prompt}` }],
          },
        ],
        systemInstruction: {
          role: 'system',
          parts: [{ text: buildSystemPrompt(opts) }],
        },
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim();
  if (!content) {
    throw new Error('No content in Gemini response');
  }

  return content;
}

// ---------------------------------------------------------------------------
// Demo/Mock Mode (when no API keys are configured)
// ---------------------------------------------------------------------------

function generateMockScript(opts: ScriptGenerationOptions): string {
  const wordTarget = Math.round(opts.durationSeconds * 2.5);

  const hooks = [
    "Did you know this simple trick could change everything?",
    "Stop what you're doing and listen to this.",
    "This is something you've probably never heard before.",
    "You won't believe what happened next.",
    "Here's the secret nobody tells you about.",
  ];

  const bodies = [
    "This is a demo script generated by ReelForge AI in mock mode. To enable real AI-powered script generation, add your ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY to your .env file. This demo script shows you exactly what the pipeline does - it takes your prompt, generates a script, creates a voiceover, generates video clips, and composites everything together with captions.",
    `Here's your ${opts.durationSeconds}-second reel about "${opts.prompt}". In production mode with API keys configured, this would be a fully customized script matching your ${opts.tone} tone and ${opts.niche} niche. The script would include a compelling ${opts.hookStyle} hook, engaging body content, and a strong call-to-action. Configure your AI provider keys to unlock the full power of ReelForge AI.`,
  ];

  const ctas = [
    "Follow for more tips like this!",
    "Drop a comment if this helped you!",
    "Share this with someone who needs to see it!",
    "Like and subscribe for more content!",
    "Hit that follow button for daily insights!",
  ];

  const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
  const randomBody = bodies[Math.floor(Math.random() * bodies.length)];
  const randomCta = ctas[Math.floor(Math.random() * ctas.length)];

  let script = `${randomHook}\n\n${randomBody}\n\n${randomCta}`;

  // Trim to approximate word count
  const words = script.split(/\s+/);
  if (words.length > wordTarget * 1.2) {
    script = words.slice(0, Math.floor(wordTarget * 1.2)).join(' ') + '...';
  }

  return script;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a short-form video script.
 * Uses Gemini as the primary provider with Claude and GPT-4 fallback.
 * Falls back to demo/mock mode if no API keys are configured.
 */
export async function generateScript(opts: ScriptGenerationOptions): Promise<string> {
  const wordTarget = Math.round(opts.durationSeconds * 2.5);

  // Check if any API keys are configured
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasAnyKey = hasAnthropicKey || hasOpenAIKey || hasGeminiKey;

  // Use mock mode if no API keys are configured
  if (!hasAnyKey) {
    log.warn('No AI API keys configured - using demo/mock mode');
    const mockScript = generateMockScript(opts);
    log.info({ provider: 'mock', wordCount: mockScript.split(/\s+/).length }, 'Mock script generated');
    return mockScript;
  }

  const preferredProvider = getPreferredProvider();
  const attempts: Array<{ name: 'gemini' | 'anthropic' | 'openai'; run: () => Promise<string> }> =
    preferredProvider === 'gemini'
      ? [
          { name: 'gemini', run: () => generateWithGemini(opts) },
          { name: 'anthropic', run: () => generateWithClaude(opts) },
          { name: 'openai', run: () => generateWithOpenAI(opts) },
        ]
      : preferredProvider === 'anthropic'
      ? [
          { name: 'anthropic', run: () => generateWithClaude(opts) },
          { name: 'openai', run: () => generateWithOpenAI(opts) },
          { name: 'gemini', run: () => generateWithGemini(opts) },
        ]
      : preferredProvider === 'openai'
      ? [
          { name: 'openai', run: () => generateWithOpenAI(opts) },
          { name: 'anthropic', run: () => generateWithClaude(opts) },
          { name: 'gemini', run: () => generateWithGemini(opts) },
        ]
      : [
          { name: 'gemini', run: () => generateWithGemini(opts) },
          { name: 'anthropic', run: () => generateWithClaude(opts) },
          { name: 'openai', run: () => generateWithOpenAI(opts) },
        ];

  log.info(
    { wordTarget, tone: opts.tone, niche: opts.niche, hookStyle: opts.hookStyle, preferredProvider },
    'Generating script',
  );

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      const script = await attempt.run();
      log.info({ provider: attempt.name, wordCount: script.split(/\s+/).length }, 'Script generated');
      return script;
    } catch (err) {
      lastError = err;
      log.warn({ provider: attempt.name, err }, 'Script generation provider failed, trying next provider');
    }
  }

  throw new Error(
    `Script generation failed on all providers: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
