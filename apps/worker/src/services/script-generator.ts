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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScriptGenerationOptions {
  prompt: string;
  tone: string;
  niche: string;
  durationSeconds: number;
  hookStyle: string;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(opts: ScriptGenerationOptions): string {
  const wordTarget = Math.round(opts.durationSeconds * 2.5);

  return `You are an expert short-form video scriptwriter specialising in ${opts.niche} content.

REQUIREMENTS:
- Tone: ${opts.tone.toLowerCase()}
- Duration: ~${opts.durationSeconds} seconds (~${wordTarget} words)
- Hook style: ${opts.hookStyle}
- Write ONLY the spoken script — no stage directions, no timestamps, no emojis.

STRUCTURE:
1. HOOK (first 3 seconds) — grab attention immediately using a ${opts.hookStyle} style hook.
2. BODY — deliver the core value clearly and concisely.
3. CTA — end with a strong call-to-action (follow, like, comment, share).

Output the raw script text only. Do not include labels like "Hook:", "Body:", "CTA:" in the final output.`;
}

// ---------------------------------------------------------------------------
// Primary: Anthropic Claude
// ---------------------------------------------------------------------------

async function generateWithClaude(opts: ScriptGenerationOptions): Promise<string> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: buildSystemPrompt(opts),
    messages: [
      {
        role: 'user',
        content: `Write a short-form video script about: ${opts.prompt}`,
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a short-form video script.
 * Uses Claude claude-sonnet-4-5-20250929 as the primary provider with GPT-4 fallback.
 */
export async function generateScript(opts: ScriptGenerationOptions): Promise<string> {
  const wordTarget = Math.round(opts.durationSeconds * 2.5);
  log.info({ wordTarget, tone: opts.tone, niche: opts.niche, hookStyle: opts.hookStyle }, 'Generating script');

  try {
    const script = await generateWithClaude(opts);
    log.info({ provider: 'anthropic', wordCount: script.split(/\s+/).length }, 'Script generated');
    return script;
  } catch (err) {
    log.warn({ err }, 'Anthropic script generation failed, falling back to OpenAI');

    try {
      const script = await generateWithOpenAI(opts);
      log.info({ provider: 'openai', wordCount: script.split(/\s+/).length }, 'Script generated (fallback)');
      return script;
    } catch (fallbackErr) {
      log.error({ err: fallbackErr }, 'OpenAI fallback also failed');
      throw new Error(
        `Script generation failed on all providers: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
