import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const ideaSchema = z.object({
  type: z.enum(['reel', 'long-form']),
  niche: z.string().optional(),
  language: z.string().optional(),
  channelProfile: z
    .object({
      name: z.string(),
      niche: z.string(),
      tone: z.string(),
    })
    .optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = ideaSchema.parse(body)

    const niche = parsed.channelProfile?.niche || parsed.niche || 'general'
    const tone = parsed.channelProfile?.tone || 'professional'
    const channelName = parsed.channelProfile?.name || ''
    const language = parsed.language || 'en'
    const isReel = parsed.type === 'reel'

    const langMap: Record<string, string> = {
      hi: 'Hindi', en: 'English', pa: 'Punjabi', ur: 'Urdu',
      bn: 'Bengali', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', gu: 'Gujarati',
    }
    const languageName = langMap[language] || 'English'

    const systemPrompt = `You are a creative content strategist for social media and YouTube. Generate ONE unique, trending content idea.

Return ONLY a JSON object in this exact format (no markdown, no code fences):
{"title":"<catchy title>","prompt":"<detailed 2-3 sentence description of the content>"}

Rules:
- IMPORTANT: The title and prompt MUST be written in ${languageName} language
- The title should be catchy, specific, and under 80 characters
- The prompt should describe the topic in detail (what to cover, key points, angle)
- Make it feel fresh, trending, and high-potential for engagement
- Niche: ${niche}
- Tone: ${tone}
${channelName ? `- Channel: ${channelName}` : ''}
- Content type: ${isReel ? 'Short-form reel (15-60 seconds)' : 'Long-form video (5-30 minutes)'}
${isReel ? '- Focus on hook-worthy, snackable content that stops the scroll' : '- Focus on in-depth, valuable content that keeps viewers watching'}
`

    // Try Gemini first
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }],
              generationConfig: { temperature: 1.0, maxOutputTokens: 300 },
            }),
          }
        )
        const data = await res.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (text) {
          const idea = parseIdeaJSON(text)
          if (idea) return NextResponse.json(idea)
        }
      } catch (err: any) {
        console.error('[generate-idea] Gemini failed:', err.message)
      }
    }

    // Fallback: Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: anthropicKey })
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 300,
          temperature: 1.0,
          messages: [{ role: 'user', content: systemPrompt }],
        })
        const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
        if (text) {
          const idea = parseIdeaJSON(text)
          if (idea) return NextResponse.json(idea)
        }
      } catch (err: any) {
        console.error('[generate-idea] Anthropic failed:', err.message)
      }
    }

    // Final fallback: mock ideas
    const mockIdea = getMockIdea(niche, isReel)
    return NextResponse.json(mockIdea)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('[generate-idea] Error:', error)
    return NextResponse.json({ error: 'Failed to generate idea' }, { status: 500 })
  }
}

function parseIdeaJSON(text: string): { title: string; prompt: string } | null {
  try {
    // Strip markdown fences if present
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (parsed.title && parsed.prompt) {
      return { title: String(parsed.title), prompt: String(parsed.prompt) }
    }
  } catch {
    // Try to extract from malformed response
    const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/)
    const promptMatch = text.match(/"prompt"\s*:\s*"([^"]+)"/)
    if (titleMatch && promptMatch) {
      return { title: titleMatch[1], prompt: promptMatch[1] }
    }
  }
  return null
}

function getMockIdea(niche: string, isReel: boolean): { title: string; prompt: string } {
  const reelIdeas: Record<string, { title: string; prompt: string }[]> = {
    tech: [
      { title: '5 AI Tools Replacing Entire Teams', prompt: 'Showcase 5 AI tools that are automating work traditionally done by full teams — cover writing, design, coding, customer support, and video editing. Include tool names and quick demos.' },
      { title: 'This Free App Changes Everything', prompt: 'Reveal a lesser-known free app that solves a common tech frustration. Show the before/after workflow and why it deserves more attention.' },
    ],
    finance: [
      { title: 'The 50/30/20 Rule is Outdated', prompt: 'Explain why the classic budgeting rule no longer works in 2025 and present a modern alternative that accounts for inflation, subscriptions, and side hustles.' },
      { title: '3 Money Habits of the Top 1%', prompt: 'Break down 3 specific money habits that wealthy people practice daily, with actionable steps anyone can start implementing immediately.' },
    ],
    fitness: [
      { title: '10 Min Morning Routine That Changed My Life', prompt: 'Walk through a science-backed 10-minute morning routine covering stretching, cold exposure, and mobility that anyone can do without equipment.' },
    ],
    general: [
      { title: 'You Won\'t Believe What Happens Next', prompt: 'Create an engaging reel about a surprising life hack or lesser-known fact that will make viewers stop scrolling and share with friends.' },
      { title: '3 Things I Wish I Knew Sooner', prompt: 'Share 3 practical life lessons or productivity tips that most people learn too late, presented in a relatable and actionable way.' },
    ],
  }

  const longFormIdeas: Record<string, { title: string; prompt: string }[]> = {
    tech: [
      { title: 'Complete Guide to Building with AI in 2025', prompt: 'A comprehensive tutorial covering the best AI tools and frameworks for building software products in 2025. Cover code generation, design tools, deployment, and monetization strategies.' },
    ],
    finance: [
      { title: 'How to Build Multiple Income Streams from Scratch', prompt: 'A step-by-step guide to creating 5 different income streams starting from zero. Cover freelancing, digital products, investments, content creation, and passive income with realistic timelines.' },
    ],
    general: [
      { title: 'The Ultimate Productivity System for 2025', prompt: 'Build a complete productivity system from scratch covering task management, time blocking, digital minimalism, and focus techniques. Include tool recommendations and templates.' },
      { title: 'How I Grew from 0 to 100K Followers', prompt: 'A detailed breakdown of the exact strategies, content frameworks, and tools used to grow a social media following from zero, with analytics and lessons learned along the way.' },
    ],
  }

  const ideas = isReel ? reelIdeas : longFormIdeas
  const nicheIdeas = ideas[niche] || ideas.general
  return nicheIdeas[Math.floor(Math.random() * nicheIdeas.length)]
}
