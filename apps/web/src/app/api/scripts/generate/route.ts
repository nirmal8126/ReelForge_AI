import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

const scriptSchema = z.object({
  prompt: z.string().min(10).max(2000),
  duration: z.number().min(5).max(60),
  language: z.string().regex(/^[a-z]{2}$/).default('en'),
  tone: z.string().optional(),
  niche: z.string().optional(),
})

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
  }
  return names[code] || 'English'
}

function resolveProviderOrder(): Array<'gemini' | 'anthropic'> {
  const provider = (process.env.AI_PROVIDER || process.env.NEXT_PUBLIC_AI_PROVIDER || '')
    .trim()
    .toLowerCase()
  const hasGemini = Boolean(process.env.GEMINI_API_KEY)
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY)

  if (provider === 'gemini') {
    return ['gemini', 'anthropic']
  }
  if (provider === 'anthropic') {
    return ['anthropic', 'gemini']
  }
  if (hasGemini && !hasAnthropic) {
    return ['gemini', 'anthropic']
  }
  return ['anthropic', 'gemini']
}

async function generateWithAnthropic(
  prompt: string,
  duration: number,
  language: string,
  tone?: string,
  niche?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }

  const wordsTarget = Math.round(duration * 2.5)
  const languageName = getLanguageName(language)
  const anthropic = new Anthropic({ apiKey })
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: `You are an expert short-form video scriptwriter. Write engaging, viral-worthy scripts in ${languageName}.
CRITICAL: Write the ENTIRE script in ${languageName} language. Every word must be in ${languageName}.
Rules:
- Language: ${languageName} (ISO code: ${language})
- Write ~${wordsTarget} words for a ${duration}-second video
- Tone: ${tone || 'professional'}
- Niche: ${niche || 'general'}
- Start with a strong hook in the first 3 seconds
- End with a call-to-action in ${languageName}
- One sentence per line for caption timing
- Return ONLY the script text, no titles or labels`,
    messages: [{ role: 'user', content: `Write 3 different script variations in ${languageName} about: ${prompt}\n\nSeparate each variation with ---` }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

async function generateWithGemini(
  prompt: string,
  duration: number,
  language: string,
  tone?: string,
  niche?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const wordsTarget = Math.round(duration * 2.5)
  const languageName = getLanguageName(language)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `Write 3 different script variations in ${languageName} about: ${prompt}\n\nSeparate each variation with ---` }],
          },
        ],
        systemInstruction: {
          role: 'system',
          parts: [
            {
              text: `You are an expert short-form video scriptwriter. Write engaging, viral-worthy scripts in ${languageName}.
CRITICAL: Write the ENTIRE script in ${languageName} language. Every word must be in ${languageName}.
Rules:
- Language: ${languageName} (ISO code: ${language})
- Write ~${wordsTarget} words for a ${duration}-second video
- Tone: ${tone || 'professional'}
- Niche: ${niche || 'general'}
- Start with a strong hook in the first 3 seconds
- End with a call-to-action in ${languageName}
- One sentence per line for caption timing
- Return ONLY the script text, no titles or labels`,
            },
          ],
        },
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1024,
        },
      }),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Gemini API error: ${response.status} ${errorBody}`)
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim() || ''
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { prompt, duration, language, tone, niche } = scriptSchema.parse(body)

    let text = ''
    let lastError: Error | null = null

    for (const provider of resolveProviderOrder()) {
      try {
        text =
          provider === 'gemini'
            ? await generateWithGemini(prompt, duration, language, tone, niche)
            : await generateWithAnthropic(prompt, duration, language, tone, niche)
        break
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }

    if (!text) {
      throw lastError || new Error('No provider could generate a script')
    }

    const variations = text.split('---').map(v => v.trim()).filter(v => v.length > 0)

    return NextResponse.json({ variations })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Script generation error:', error)
    return NextResponse.json({ error: 'Failed to generate scripts' }, { status: 500 })
  }
}
