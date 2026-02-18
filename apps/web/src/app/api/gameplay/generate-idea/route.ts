import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const inputSchema = z.object({
  template: z.enum(['ENDLESS_RUNNER', 'BALL_MAZE', 'OBSTACLE_TOWER', 'COLOR_SWITCH']),
  theme: z.enum(['neon', 'pastel', 'retro', 'dark', 'candy']),
  difficulty: z.enum(['easy', 'medium', 'hard', 'insane']),
  duration: z.number(),
  musicStyle: z.enum(['upbeat', 'chill', 'intense', 'none']),
})

const TEMPLATE_LABELS: Record<string, string> = {
  ENDLESS_RUNNER: 'Endless Runner',
  BALL_MAZE: 'Ball Maze',
  OBSTACLE_TOWER: 'Obstacle Tower',
  COLOR_SWITCH: 'Color Switch',
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = inputSchema.parse(body)

    const templateName = TEMPLATE_LABELS[parsed.template] || parsed.template

    const systemPrompt = `You are a creative gameplay video content strategist for TikTok/Shorts/Reels viral content.

The user has selected the following settings for their gameplay video:
- Template: ${templateName}
- Color Theme: ${parsed.theme}
- Difficulty: ${parsed.difficulty}
- Duration: ${parsed.duration}s
- Music Style: ${parsed.musicStyle}

Based on these selections, generate a catchy game title and an engaging CTA (call-to-action) text.

Return ONLY a JSON object in this exact format (no markdown, no code fences):
{"gameTitle":"<catchy game name that fits the template and theme, max 50 chars>","ctaText":"<engaging call-to-action text for social media, max 80 chars>"}

Rules:
- The gameTitle should match the template type (e.g., runner games → "Neon Sprint 3D", maze → "Shadow Maze Escape", tower → "Insane Tower Climb", color switch → "Color Flow Challenge")
- Reflect the theme vibe in the title (neon → techy/glowy, pastel → soft/cute, retro → pixel/classic, dark → shadow/midnight, candy → sweet/colorful)
- The ctaText should hook viewers (e.g., "Can you beat level 99?", "Wait for the ending...", "Nobody survives past 30 seconds!", "So satisfying to watch!")
- Match the difficulty feel — easy: satisfying/relaxing, hard/insane: challenging/impossible
- Keep it fresh, trendy, and viral-worthy`

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
              generationConfig: { temperature: 1.0, maxOutputTokens: 200 },
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
        console.error('[gameplay-generate-idea] Gemini failed:', err.message)
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
          max_tokens: 200,
          temperature: 1.0,
          messages: [{ role: 'user', content: systemPrompt }],
        })
        const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
        if (text) {
          const idea = parseIdeaJSON(text)
          if (idea) return NextResponse.json(idea)
        }
      } catch (err: any) {
        console.error('[gameplay-generate-idea] Anthropic failed:', err.message)
      }
    }

    // Final fallback: mock idea based on selections
    return NextResponse.json(getMockIdea(parsed.template, parsed.theme, parsed.difficulty))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('[gameplay-generate-idea] Error:', error)
    return NextResponse.json({ error: 'Failed to generate idea' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseIdeaJSON(text: string): { gameTitle: string; ctaText: string } | null {
  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (parsed.gameTitle) {
      return {
        gameTitle: String(parsed.gameTitle).slice(0, 100),
        ctaText: parsed.ctaText ? String(parsed.ctaText).slice(0, 200) : '',
      }
    }
  } catch {
    const titleMatch = text.match(/"gameTitle"\s*:\s*"([^"]+)"/)
    const ctaMatch = text.match(/"ctaText"\s*:\s*"([^"]+)"/)
    if (titleMatch) {
      return {
        gameTitle: titleMatch[1].slice(0, 100),
        ctaText: ctaMatch ? ctaMatch[1].slice(0, 200) : '',
      }
    }
  }
  return null
}

// Mock ideas grouped by template + theme
const MOCK_IDEAS: Record<string, { gameTitle: string; ctaText: string }[]> = {
  'ENDLESS_RUNNER:neon':   [{ gameTitle: 'Neon Sprint 3D', ctaText: 'Can you survive all obstacles?' }, { gameTitle: 'Cyber Ball Rush', ctaText: 'Nobody makes it past level 50!' }],
  'ENDLESS_RUNNER:pastel': [{ gameTitle: 'Pastel Dash', ctaText: 'So satisfying to watch!' }, { gameTitle: 'Soft Run 3D', ctaText: 'The most relaxing gameplay ever' }],
  'ENDLESS_RUNNER:retro':  [{ gameTitle: 'Pixel Sprint', ctaText: 'Old school vibes, impossible challenge!' }, { gameTitle: '8-Bit Runner', ctaText: 'Can you beat the high score?' }],
  'ENDLESS_RUNNER:dark':   [{ gameTitle: 'Midnight Runner', ctaText: 'Nobody can pass level 50!' }, { gameTitle: 'Shadow Sprint 3D', ctaText: 'Wait for the ending...' }],
  'ENDLESS_RUNNER:candy':  [{ gameTitle: 'Sweet Run 3D', ctaText: 'Can you beat level 99?' }, { gameTitle: 'Candy Dash', ctaText: 'The sweetest gameplay ever!' }],
  'BALL_MAZE:neon':        [{ gameTitle: 'Neon Maze Escape', ctaText: 'Can you find the exit?' }, { gameTitle: 'Glow Ball Maze', ctaText: 'This maze is impossible!' }],
  'BALL_MAZE:pastel':      [{ gameTitle: 'Dreamy Maze', ctaText: 'So calming to watch!' }, { gameTitle: 'Pastel Labyrinth', ctaText: 'Follow the ball...' }],
  'BALL_MAZE:retro':       [{ gameTitle: 'Pixel Maze Adventure', ctaText: 'So relaxing to watch!' }, { gameTitle: 'Retro Ball Maze', ctaText: 'Classic maze, new challenge!' }],
  'BALL_MAZE:dark':        [{ gameTitle: 'Shadow Labyrinth', ctaText: 'This maze is impossible!' }, { gameTitle: 'Dark Maze Escape', ctaText: 'Can you escape the darkness?' }],
  'BALL_MAZE:candy':       [{ gameTitle: 'Candy Maze Escape', ctaText: 'Wait for the ending...' }, { gameTitle: 'Sugar Ball Maze', ctaText: 'The sweetest maze you\'ve ever seen!' }],
  'OBSTACLE_TOWER:neon':   [{ gameTitle: 'Glow Tower Rush', ctaText: 'How high can you go?' }, { gameTitle: 'Neon Tower Climb', ctaText: 'Nobody reaches the top!' }],
  'OBSTACLE_TOWER:pastel': [{ gameTitle: 'Cloud Tower', ctaText: 'So satisfying to watch!' }, { gameTitle: 'Soft Tower Climb', ctaText: 'The cutest tower game ever!' }],
  'OBSTACLE_TOWER:retro':  [{ gameTitle: 'Retro Tower Climb', ctaText: 'Follow for more satisfying gameplay!' }, { gameTitle: 'Pixel Tower Rush', ctaText: 'Classic vibes, insane challenge!' }],
  'OBSTACLE_TOWER:dark':   [{ gameTitle: 'Dark Tower Ascent', ctaText: 'Will you reach the top?' }, { gameTitle: 'Shadow Tower 3D', ctaText: 'The hardest tower game ever!' }],
  'OBSTACLE_TOWER:candy':  [{ gameTitle: 'Candy Tower Climb', ctaText: 'Sweet but deadly!' }, { gameTitle: 'Sugar Rush Tower', ctaText: 'How high can you climb?' }],
  'COLOR_SWITCH:neon':     [{ gameTitle: 'Color Flow', ctaText: 'So satisfying to watch!' }, { gameTitle: 'Neon Color Switch', ctaText: 'One wrong color and it\'s over!' }],
  'COLOR_SWITCH:pastel':   [{ gameTitle: 'Pastel Color Switch', ctaText: 'The most calming game ever' }, { gameTitle: 'Soft Color Flow', ctaText: 'Can you match them all?' }],
  'COLOR_SWITCH:retro':    [{ gameTitle: 'Retro Color Gate', ctaText: 'Old school, new challenge!' }, { gameTitle: 'Pixel Color Switch', ctaText: 'Match or fail!' }],
  'COLOR_SWITCH:dark':     [{ gameTitle: 'Dark Color Switch', ctaText: 'One wrong move and it\'s over!' }, { gameTitle: 'Shadow Colors', ctaText: 'Can you see the right color?' }],
  'COLOR_SWITCH:candy':    [{ gameTitle: 'Candy Color Switch', ctaText: 'One wrong move and it\'s over!' }, { gameTitle: 'Rainbow Switch', ctaText: 'Match the candy colors!' }],
}

const DIFFICULTY_CTAS: Record<string, string[]> = {
  easy:   ['So satisfying!', 'So relaxing to watch!', 'Perfect gameplay!'],
  medium: ['Can you do better?', 'Follow for more!', 'Wait for the ending...'],
  hard:   ['Nobody beats this!', 'Can you survive?', 'This is insane!'],
  insane: ['IMPOSSIBLE challenge!', 'Nobody can beat this!', '99% fail at this point!'],
}

function getMockIdea(template: string, theme: string, difficulty: string): { gameTitle: string; ctaText: string } {
  const key = `${template}:${theme}`
  const ideas = MOCK_IDEAS[key]
  if (ideas && ideas.length > 0) {
    const idea = ideas[Math.floor(Math.random() * ideas.length)]
    // Optionally swap CTA with difficulty-matched one
    if (Math.random() > 0.5) {
      const difficultyCtas = DIFFICULTY_CTAS[difficulty] || DIFFICULTY_CTAS.medium
      return { ...idea, ctaText: difficultyCtas[Math.floor(Math.random() * difficultyCtas.length)] }
    }
    return idea
  }
  // Absolute fallback
  return { gameTitle: 'Epic Gameplay 3D', ctaText: 'Follow for more!' }
}
