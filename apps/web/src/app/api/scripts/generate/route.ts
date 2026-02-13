import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

const scriptSchema = z.object({
  prompt: z.string().min(10).max(2000),
  duration: z.number().min(15).max(60),
  tone: z.string().optional(),
  niche: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { prompt, duration, tone, niche } = scriptSchema.parse(body)

    const wordsTarget = Math.round(duration * 2.5)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: `You are an expert short-form video scriptwriter. Write engaging, viral-worthy scripts.
Rules:
- Write ~${wordsTarget} words for a ${duration}-second video
- Tone: ${tone || 'professional'}
- Niche: ${niche || 'general'}
- Start with a strong hook in the first 3 seconds
- End with a call-to-action
- One sentence per line for caption timing
- Return ONLY the script text, no titles or labels`,
      messages: [{ role: 'user', content: `Write 3 different script variations about: ${prompt}\n\nSeparate each variation with ---` }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
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
