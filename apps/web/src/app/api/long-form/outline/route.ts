import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const outlineSchema = z.object({
  prompt: z.string().min(10).max(2000),
  title: z.string().max(255).optional(),
  durationMinutes: z.number().min(5).max(30).default(10),
  language: z.string().regex(/^[a-z]{2}$/).default('hi'),
  niche: z.string().max(100).optional(),
  tone: z.string().max(100).optional(),
})

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German',
    it: 'Italian', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean',
    zh: 'Chinese', ar: 'Arabic', hi: 'Hindi', pl: 'Polish',
  }
  return names[code] || 'English'
}

/**
 * POST /api/long-form/outline
 * Generate a video outline/plan before committing to full generation.
 * Returns chapter structure with titles, descriptions, and durations.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = outlineSchema.parse(body)

    const segmentCount = Math.max(3, Math.ceil(data.durationMinutes / 2))
    const segmentDuration = Math.round((data.durationMinutes * 60) / segmentCount)
    const languageName = getLanguageName(data.language)
    const title = data.title || data.prompt.substring(0, 80)

    // Check for API keys
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY
    const hasGeminiKey = !!process.env.GEMINI_API_KEY

    let outline

    const genOpts = {
      prompt: data.prompt,
      title,
      durationMinutes: data.durationMinutes,
      segmentCount,
      segmentDuration,
      language: languageName,
      niche: data.niche,
      tone: data.tone,
    }

    // Try providers in order: Gemini → Claude → OpenAI → Mock
    if (hasGeminiKey) {
      try {
        outline = await generateWithGemini(genOpts)
      } catch (err) {
        console.error('Gemini outline failed:', err)
      }
    }
    if (!outline && hasAnthropicKey) {
      try {
        outline = await generateWithClaude(genOpts)
      } catch (err) {
        console.error('Claude outline failed:', err)
      }
    }
    if (!outline && hasOpenAIKey) {
      try {
        outline = await generateWithOpenAI(genOpts)
      } catch (err) {
        console.error('OpenAI outline failed:', err)
      }
    }
    if (!outline) {
      outline = generateMockOutline({ title, segmentCount, segmentDuration })
    }

    return NextResponse.json({
      outline,
      metadata: {
        title,
        durationMinutes: data.durationMinutes,
        segmentCount: outline.segments.length,
        totalDurationSeconds: outline.segments.reduce((sum: number, s: any) => sum + s.durationSeconds, 0),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Outline generation error:', error)
    return NextResponse.json({ error: 'Failed to generate outline' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateOpts {
  prompt: string
  title: string
  durationMinutes: number
  segmentCount: number
  segmentDuration: number
  language: string
  niche?: string
  tone?: string
}

const OUTLINE_APPROACHES = [
  'storytelling arc with rising tension', 'problem-solution deep dive',
  'myth-busting journey', 'step-by-step masterclass', 'case study analysis',
  'debate-style pros and cons', 'historical timeline progression',
  'expert interview format', 'challenge and transformation',
  'comparative analysis', 'behind-the-scenes exploration', 'future predictions',
]

const OUTLINE_HOOKS = [
  'shocking statistic opener', 'personal failure story', 'bold prediction',
  'common misconception reveal', 'viewer challenge', 'dramatic question',
  'time-sensitive urgency', 'emotional story', 'controversial opinion',
]

function buildSystemPrompt(opts: GenerateOpts): string {
  const approach = OUTLINE_APPROACHES[Math.floor(Math.random() * OUTLINE_APPROACHES.length)]
  const hookStyle = OUTLINE_HOOKS[Math.floor(Math.random() * OUTLINE_HOOKS.length)]
  const seed = Date.now() + Math.floor(Math.random() * 100000)

  return `You are an expert long-form video content strategist and scriptwriter.

Generate a structured outline for a ${opts.durationMinutes}-minute video with exactly ${opts.segmentCount} segments.

REQUIREMENTS:
- Language: ${opts.language}
${opts.niche ? `- Niche: ${opts.niche}` : ''}
${opts.tone ? `- Tone: ${opts.tone}` : ''}
- Each segment should be approximately ${opts.segmentDuration} seconds
- First segment MUST be a compelling hook/introduction
- Last segment MUST be a strong conclusion with call-to-action
- Each segment needs a clear title, brief description, and talking points

CREATIVE DIRECTION (for uniqueness):
- Overall approach: ${approach}
- Hook style: ${hookStyle}
- Uniqueness seed: ${seed} — create a completely fresh and original outline

Return ONLY valid JSON with this exact structure:
{
  "segments": [
    {
      "title": "Introduction - Hook the Viewer",
      "description": "Brief description of what this segment covers",
      "talkingPoints": ["Point 1", "Point 2", "Point 3"],
      "durationSeconds": ${opts.segmentDuration},
      "visualSuggestion": "What type of visuals would work best (e.g., 'dramatic opening shot', 'screen recording', 'talking head')"
    }
  ]
}

Make the outline engaging, well-structured, and optimized for viewer retention. This must be COMPLETELY ORIGINAL — never repeat structures from previous outlines.`
}

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------

async function generateWithClaude(opts: GenerateOpts) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    temperature: 0.9,
    system: buildSystemPrompt(opts),
    messages: [
      {
        role: 'user',
        content: `Create a detailed outline for a video titled "${opts.title}" about: ${opts.prompt}\n\nMake this outline completely unique and original.`,
      },
    ],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in response')
  }

  return parseOutlineJSON(textBlock.text)
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

async function generateWithGemini(opts: GenerateOpts) {
  const apiKey = process.env.GEMINI_API_KEY!
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `Create a detailed outline for a video titled "${opts.title}" about: ${opts.prompt}` }],
          },
        ],
        systemInstruction: {
          role: 'system',
          parts: [{ text: buildSystemPrompt(opts) }],
        },
        generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
      }),
    }
  )

  if (!response.ok) throw new Error(`Gemini error: ${response.status}`)

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('\n')
  if (!content) throw new Error('No content from Gemini')

  return parseOutlineJSON(content)
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

async function generateWithOpenAI(opts: GenerateOpts) {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  const response = await client.chat.completions.create({
    model: 'gpt-4',
    max_tokens: 4096,
    temperature: 0.9,
    messages: [
      { role: 'system', content: buildSystemPrompt(opts) },
      { role: 'user', content: `Create a detailed outline for a video titled "${opts.title}" about: ${opts.prompt}\n\nMake this outline completely unique and original.` },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No content from OpenAI')

  return parseOutlineJSON(content)
}

// ---------------------------------------------------------------------------
// Mock
// ---------------------------------------------------------------------------

function generateMockOutline(opts: { title: string; segmentCount: number; segmentDuration: number }) {
  const segments = []

  const templates = [
    { title: 'Introduction - Hook the Viewer', description: 'Start with a compelling hook that grabs attention immediately', visualSuggestion: 'Dramatic opening shot with text overlay' },
    { title: 'The Problem', description: 'Explain the problem or challenge that viewers face', visualSuggestion: 'Stock footage showing the problem scenario' },
    { title: 'Why This Matters', description: 'Context and importance of the topic', visualSuggestion: 'Statistics and infographics' },
    { title: 'Solution Overview', description: 'High-level look at the solution or approach', visualSuggestion: 'Animated diagram or flowchart' },
    { title: 'Step-by-Step Guide', description: 'Detailed walkthrough of the process', visualSuggestion: 'Screen recording or demonstration' },
    { title: 'Pro Tips & Best Practices', description: 'Expert advice and insider knowledge', visualSuggestion: 'Talking head with bullet points overlay' },
    { title: 'Common Mistakes to Avoid', description: 'Pitfalls and how to overcome them', visualSuggestion: 'Before/after comparisons' },
    { title: 'Real-World Examples', description: 'Case studies and practical applications', visualSuggestion: 'Screenshots and real examples' },
    { title: 'Advanced Techniques', description: 'Level up with advanced strategies', visualSuggestion: 'Screen recording with annotations' },
    { title: 'Summary & Call to Action', description: 'Recap key points and encourage next steps', visualSuggestion: 'Animated summary with subscribe button' },
  ]

  for (let i = 0; i < opts.segmentCount; i++) {
    const template = templates[Math.min(i, templates.length - 1)]
    segments.push({
      title: i === 0 ? `Introduction - ${opts.title}` : i === opts.segmentCount - 1 ? 'Summary & Call to Action' : template.title,
      description: template.description,
      talkingPoints: [
        `Key point ${i * 3 + 1} about ${opts.title}`,
        `Key point ${i * 3 + 2} about ${opts.title}`,
        `Key point ${i * 3 + 3} about ${opts.title}`,
      ],
      durationSeconds: opts.segmentDuration,
      visualSuggestion: template.visualSuggestion,
    })
  }

  return { segments }
}

// ---------------------------------------------------------------------------
// JSON Parser
// ---------------------------------------------------------------------------

function parseOutlineJSON(text: string) {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.segments || !Array.isArray(parsed.segments)) {
      throw new Error('Invalid outline structure')
    }
    return parsed
  } catch (err) {
    throw new Error('Failed to parse outline JSON')
  }
}
