import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

// POST /api/cartoon-studio/series/[seriesId]/generate-ideas?count=1|7
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seriesId } = await params
  const { searchParams } = new URL(req.url)
  const count = Math.min(Math.max(parseInt(searchParams.get('count') || '1'), 1), 7)

  // Optional user hint from body
  let hint = ''
  try {
    const body = await req.json()
    hint = body.hint || ''
  } catch {
    // no body is fine
  }

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
    include: {
      characters: { orderBy: { createdAt: 'asc' } },
      episodes: {
        orderBy: { episodeNumber: 'desc' },
        take: 20,
        select: { title: true, synopsis: true, prompt: true },
      },
    },
  })

  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

  // Try Gemini first (primary), then Anthropic as fallback
  const geminiKey = process.env.GEMINI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY



  if (geminiKey) {
    try {
      const ideas = await generateIdeasWithGemini(series, count, hint, geminiKey)
      console.log('[generate-ideas] Gemini success, ideas:', ideas.length)
      return NextResponse.json({ ideas })
    } catch (err: any) {
      console.error('[generate-ideas] Gemini failed:', err.message)
    }
  }

  if (anthropicKey) {
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const ideas = await generateIdeasWithAnthropic(series, count, hint, new Anthropic({ apiKey: anthropicKey }))
      console.log('[generate-ideas] Anthropic success, ideas:', ideas.length)
      return NextResponse.json({ ideas })
    } catch (err: any) {
      console.error('[generate-ideas] Anthropic failed:', err.message)
    }
  }

  // Fallback to mock ideas
  console.log('[generate-ideas] All AI providers failed, using mock ideas')
  const ideas = generateMockIdeas(series, count)
  return NextResponse.json({ ideas })
}

// ---------------------------------------------------------------------------
// Language map
// ---------------------------------------------------------------------------

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French', de: 'German',
  pt: 'Portuguese', it: 'Italian', ja: 'Japanese', ko: 'Korean',
  zh: 'Chinese (Mandarin)', ar: 'Arabic', ru: 'Russian', tr: 'Turkish',
  nl: 'Dutch', pl: 'Polish', sv: 'Swedish', da: 'Danish', no: 'Norwegian',
  fi: 'Finnish', id: 'Indonesian', ms: 'Malay', th: 'Thai', vi: 'Vietnamese',
  bn: 'Bengali', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', gu: 'Gujarati',
  kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', ur: 'Urdu',
}

function getLanguageName(code: string): string {
  return LANGUAGE_MAP[code] || code
}

// ---------------------------------------------------------------------------
// Build prompt (shared between providers)
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  series: {
    name: string
    description: string | null
    targetAudience: string | null
    artStyle: string | null
    language: string
    characters: { name: string; description: string | null; personality: string | null }[]
    episodes: { title: string; synopsis: string | null; prompt: string }[]
  },
  count: number,
  hint: string,
): string {
  const languageName = getLanguageName(series.language)

  const characterList = series.characters
    .map((c) => `- ${c.name}: ${c.description || 'No description'}. Personality: ${c.personality || 'Not specified'}`)
    .join('\n')

  const existingEpisodes = series.episodes.length > 0
    ? series.episodes.map((e) => `- "${e.title}": ${e.synopsis || e.prompt.slice(0, 100)}`).join('\n')
    : 'None yet — this will be the first episode(s).'

  return `You are an expert cartoon series content planner. You generate creative, engaging episode ideas for animated series.

Series: "${series.name}"
${series.description ? `Description: ${series.description}` : ''}
${series.targetAudience ? `Target Audience: ${series.targetAudience}` : ''}
${series.artStyle ? `Art Style: ${series.artStyle}` : ''}
Language: ${languageName}

Characters:
${characterList}

Existing episodes (avoid repeating these themes):
${existingEpisodes}

RULES:
1. Generate exactly ${count} unique episode idea(s)
2. Each idea needs a catchy title, a detailed story prompt (2-4 sentences describing the plot), and a one-line synopsis
3. Make episodes engaging, age-appropriate for the target audience, and use the characters naturally
4. Each episode should teach a lesson or have a moral appropriate for the audience
5. Avoid repeating themes from existing episodes
6. Vary the tone — mix adventure, comedy, heartwarming, and mystery
7. LANGUAGE: You MUST write ALL content (titles, prompts, synopses) in ${languageName}. Every piece of text must be in ${languageName}.
${hint ? `8. User hint: "${hint}" — incorporate this theme/idea into the episodes` : ''}

OUTPUT FORMAT: Return ONLY valid JSON (no markdown, no code blocks):
{
  "ideas": [
    {
      "title": "Episode Title in ${languageName}",
      "prompt": "Detailed story prompt in ${languageName} describing the plot, key events, and character interactions...",
      "synopsis": "One-line summary in ${languageName}"
    }
  ]
}`
}

// ---------------------------------------------------------------------------
// Parse AI response
// ---------------------------------------------------------------------------

function parseIdeasResponse(text: string, count: number): { title: string; prompt: string; synopsis: string }[] {
  let jsonText = text.trim()
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  // Try direct parse first
  try {
    const parsed = JSON.parse(jsonText)
    const ideas = parsed.ideas || parsed
    if (Array.isArray(ideas)) {
      return ideas.slice(0, count).map((idea: any) => ({
        title: idea.title || 'Untitled Episode',
        prompt: idea.prompt || idea.description || '',
        synopsis: idea.synopsis || idea.summary || '',
      }))
    }
  } catch {
    // JSON might be truncated — try to salvage complete objects
  }

  // Fallback: extract complete idea objects from truncated JSON
  const ideaRegex = /\{\s*"title"\s*:\s*"([^"]+)"\s*,\s*"prompt"\s*:\s*"([^"]+)"\s*,\s*"synopsis"\s*:\s*"([^"]+)"\s*\}/g
  const ideas: { title: string; prompt: string; synopsis: string }[] = []
  let match
  while ((match = ideaRegex.exec(jsonText)) !== null && ideas.length < count) {
    ideas.push({ title: match[1], prompt: match[2], synopsis: match[3] })
  }

  if (ideas.length > 0) {
    console.log(`[generate-ideas] Salvaged ${ideas.length} ideas from truncated JSON`)
    return ideas
  }

  throw new Error('Invalid response format: could not parse ideas')
}

// ---------------------------------------------------------------------------
// Gemini Implementation
// ---------------------------------------------------------------------------

async function generateIdeasWithGemini(
  series: any,
  count: number,
  hint: string,
  apiKey: string,
): Promise<{ title: string; prompt: string; synopsis: string }[]> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const systemPrompt = buildSystemPrompt(series, count, hint)
  const userMessage = `Generate ${count} episode idea${count > 1 ? 's' : ''} for this series.${hint ? ` Theme hint: ${hint}` : ''}`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No text in Gemini response')

  return parseIdeasResponse(text, count)
}

// ---------------------------------------------------------------------------
// Anthropic Implementation
// ---------------------------------------------------------------------------

async function generateIdeasWithAnthropic(
  series: any,
  count: number,
  hint: string,
  client: any,
): Promise<{ title: string; prompt: string; synopsis: string }[]> {
  const systemPrompt = buildSystemPrompt(series, count, hint)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      { role: 'user', content: `Generate ${count} episode idea${count > 1 ? 's' : ''} for this series.${hint ? ` Theme hint: ${hint}` : ''}` },
    ],
  })

  const textBlock = response.content.find((b: any) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Anthropic')
  }

  return parseIdeasResponse(textBlock.text, count)
}

// ---------------------------------------------------------------------------
// Mock Ideas (fallback)
// ---------------------------------------------------------------------------

const MOCK_TEMPLATES = [
  {
    titleTemplate: 'The Great {thing} Adventure',
    promptTemplate: '{char1} discovers a mysterious {thing} in the neighborhood. Together with {char2}, they embark on an exciting adventure to uncover its secrets. Along the way, they learn about teamwork and the importance of helping others.',
    synopsisTemplate: '{char1} and {char2} go on a {thing} adventure and learn about teamwork.',
    things: ['Treasure', 'Map', 'Crystal', 'Book', 'Key'],
  },
  {
    titleTemplate: 'The Day Everything Changed',
    promptTemplate: 'When a strange event causes everything in the neighborhood to change, {char1} must figure out what happened. With the help of {char2}, they discover the cause and learn that change can be a good thing when you face it with courage.',
    synopsisTemplate: '{char1} faces unexpected changes and learns to embrace them with courage.',
    things: [],
  },
  {
    titleTemplate: '{char1}\'s Big Surprise',
    promptTemplate: '{char1} has been planning a special surprise for {char2}, but things keep going wrong. Through a series of funny mishaps, {char1} learns that the best surprises come from the heart, not from perfection.',
    synopsisTemplate: '{char1} plans a surprise for {char2} but learns perfection isn\'t everything.',
    things: [],
  },
  {
    titleTemplate: 'The Mystery of the Missing {thing}',
    promptTemplate: '{char2}\'s favorite {thing} goes missing! {char1} takes on the role of detective to find it. Following clues through the neighborhood, they discover an unexpected culprit and learn about jumping to conclusions.',
    synopsisTemplate: '{char1} solves the mystery of {char2}\'s missing {thing}.',
    things: ['Toy', 'Recipe', 'Song', 'Painting', 'Medal'],
  },
  {
    titleTemplate: 'A Lesson in {value}',
    promptTemplate: '{char1} accidentally breaks a promise to {char2}, which creates a rift between them. Through a series of events, {char1} realizes the importance of {value} and works to make things right.',
    synopsisTemplate: '{char1} breaks a promise and learns about {value}.',
    things: [],
    values: ['Honesty', 'Kindness', 'Patience', 'Forgiveness', 'Respect'],
  },
  {
    titleTemplate: 'The {thing} Competition',
    promptTemplate: 'The neighborhood announces a {thing} competition! {char1} and {char2} both want to win but have different approaches. They eventually realize that working together produces better results than competing against each other.',
    synopsisTemplate: '{char1} and {char2} compete in a {thing} contest and discover collaboration.',
    things: ['Cooking', 'Science', 'Art', 'Sports', 'Music'],
  },
  {
    titleTemplate: '{char1} Saves the Day',
    promptTemplate: 'When a storm threatens the neighborhood festival, everyone is ready to give up. But {char1} comes up with a creative plan to save the event, with {char2} helping to rally everyone together. They learn that one person can make a difference.',
    synopsisTemplate: '{char1} finds a creative way to save the neighborhood festival.',
    things: [],
  },
]

function generateMockIdeas(
  series: {
    characters: { name: string }[]
    episodes: { title: string }[]
  },
  count: number,
): { title: string; prompt: string; synopsis: string }[] {
  const char1 = series.characters[0]?.name || 'Hero'
  const char2 = series.characters[1]?.name || 'Friend'
  const existingTitles = new Set(series.episodes.map((e) => e.title.toLowerCase()))

  const ideas: { title: string; prompt: string; synopsis: string }[] = []
  const shuffled = [...MOCK_TEMPLATES].sort(() => Math.random() - 0.5)

  for (const template of shuffled) {
    if (ideas.length >= count) break

    const thing = template.things?.[Math.floor(Math.random() * (template.things?.length || 1))] || 'Mystery'
    const value = (template as any).values?.[Math.floor(Math.random() * ((template as any).values?.length || 1))] || 'Honesty'

    const title = template.titleTemplate
      .replace('{char1}', char1)
      .replace('{char2}', char2)
      .replace('{thing}', thing)
      .replace('{value}', value)

    if (existingTitles.has(title.toLowerCase())) continue

    const prompt = template.promptTemplate
      .replace(/{char1}/g, char1)
      .replace(/{char2}/g, char2)
      .replace(/{thing}/g, thing.toLowerCase())
      .replace(/{value}/g, value.toLowerCase())

    const synopsis = template.synopsisTemplate
      .replace(/{char1}/g, char1)
      .replace(/{char2}/g, char2)
      .replace(/{thing}/g, thing.toLowerCase())
      .replace(/{value}/g, value.toLowerCase())

    ideas.push({ title, prompt, synopsis })
  }

  return ideas
}
