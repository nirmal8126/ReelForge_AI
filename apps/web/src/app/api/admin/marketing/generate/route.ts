import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 }
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Forbidden', status: 403 }
  }
  return { userId: session.user.id }
}

const MODULE_INFO: Record<string, { name: string; description: string; link: string }> = {
  reels: {
    name: 'AI Reels',
    description: 'Create AI-powered short video reels with voiceover, captions, and background music in seconds',
    link: '/reels',
  },
  long_form: {
    name: 'Long-Form Videos',
    description: 'Generate 5-30 minute videos with chapters, stock footage, AI visuals, and narration',
    link: '/long-form',
  },
  quotes: {
    name: 'AI Quotes',
    description: 'Generate beautiful quote images and videos with AI — perfect for social media content',
    link: '/quotes',
  },
  challenges: {
    name: 'Challenge Reels',
    description: 'Create fun quiz, riddle, and game reels that boost audience engagement and comments',
    link: '/challenges',
  },
  cartoon_studio: {
    name: 'Cartoon Studio',
    description: 'Build animated cartoon series with custom characters, AI-generated visuals, and narration',
    link: '/cartoon-studio',
  },
}

const requestSchema = z.object({
  bannerType: z.enum(['INFO', 'SUCCESS', 'WARNING', 'PROMOTION', 'ANNOUNCEMENT', 'NEW_FEATURE']),
  targetModule: z.string().nullable().optional(), // null = platform-wide
  goal: z.string().optional(), // optional custom goal/context
})

// POST /api/admin/marketing/generate — AI-generate banner title + message
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { bannerType, targetModule, goal } = requestSchema.parse(body)

    const moduleInfo = targetModule ? MODULE_INFO[targetModule] : null
    const bannerTypeLabel = bannerType.replace(/_/g, ' ').toLowerCase()

    let systemPrompt = `You are a marketing copywriter for ReelForge AI, an AI-powered short video generation platform.
The platform helps content creators generate professional videos using AI — including reels, long-form videos, quote images, challenge/game reels, and cartoon series.

Generate a catchy, engaging banner for the admin dashboard. The banner is of type "${bannerTypeLabel}".`

    if (moduleInfo) {
      systemPrompt += `\n\nThis banner is specifically about the "${moduleInfo.name}" module.
Module description: ${moduleInfo.description}
Module link: ${moduleInfo.link}`
    } else {
      systemPrompt += `\n\nThis banner is about the ReelForge AI platform in general.`
    }

    if (goal) {
      systemPrompt += `\n\nAdmin's additional context/goal: ${goal}`
    }

    systemPrompt += `\n\nRespond ONLY with valid JSON in this exact format:
{
  "title": "Short catchy title (max 60 chars)",
  "message": "Compelling message text (max 200 chars)",
  "linkText": "CTA button text (max 30 chars)",
  "suggestedLink": "suggested relative URL path"
}

Keep the tone professional yet exciting. Make users want to take action. Be specific about features/benefits.`

    const userMessage = targetModule
      ? `Generate a ${bannerTypeLabel} banner about the ${moduleInfo?.name} feature.${goal ? ` Goal: ${goal}` : ''}`
      : `Generate a ${bannerTypeLabel} banner for the ReelForge AI platform.${goal ? ` Goal: ${goal}` : ''}`

    let result: { title: string; message: string; linkText: string; suggestedLink: string } | null = null

    // Try Gemini first
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
      try {
        const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: userMessage }] }],
              systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
              generationConfig: { temperature: 0.9, maxOutputTokens: 512 },
            }),
          }
        )
        if (geminiRes.ok) {
          const data = await geminiRes.json()
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          const jsonMatch = text.match(/\{[\s\S]*?\}/)
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0])
          }
        }
      } catch (e) {
        console.error('Gemini banner gen error:', e)
      }
    }

    // Fallback to Anthropic
    if (!result && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
        const response = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })
        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        const jsonMatch = text.match(/\{[\s\S]*?\}/)
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.error('Anthropic banner gen error:', e)
      }
    }

    // Final fallback — template-based
    if (!result) {
      result = generateFallback(bannerType, targetModule, moduleInfo)
    }

    return NextResponse.json({ generated: result })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Banner generate error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

function generateFallback(
  bannerType: string,
  targetModule: string | null | undefined,
  moduleInfo: { name: string; description: string; link: string } | null
) {
  if (moduleInfo && targetModule) {
    const templates: Record<string, { title: string; message: string; linkText: string }> = {
      INFO: {
        title: `Discover ${moduleInfo.name}`,
        message: `${moduleInfo.description}. Try it now and see the magic of AI-powered content creation!`,
        linkText: 'Try It Now',
      },
      SUCCESS: {
        title: `${moduleInfo.name} is Live!`,
        message: `Great news! ${moduleInfo.name} is ready for you. Start creating amazing content with AI today.`,
        linkText: 'Get Started',
      },
      WARNING: {
        title: `${moduleInfo.name} Maintenance`,
        message: `${moduleInfo.name} will undergo maintenance soon. Save your work and plan accordingly.`,
        linkText: 'Learn More',
      },
      PROMOTION: {
        title: `Special Offer on ${moduleInfo.name}!`,
        message: `Limited time: Get extra credits when you use ${moduleInfo.name}. Create more content for less!`,
        linkText: 'Claim Offer',
      },
      ANNOUNCEMENT: {
        title: `What's New in ${moduleInfo.name}`,
        message: `We've added exciting new features to ${moduleInfo.name}. Check out what's new and level up your content!`,
        linkText: 'See Updates',
      },
      NEW_FEATURE: {
        title: `New in ${moduleInfo.name}!`,
        message: `${moduleInfo.name} just got better! Explore new capabilities and create even more stunning content.`,
        linkText: 'Explore Now',
      },
    }
    const t = templates[bannerType] || templates.INFO
    return { ...t, suggestedLink: moduleInfo.link }
  }

  const platformTemplates: Record<string, { title: string; message: string; linkText: string; suggestedLink: string }> = {
    INFO: {
      title: 'Welcome to ReelForge AI',
      message: 'Create stunning AI-powered videos, reels, quotes, and more — all from a single platform!',
      linkText: 'Explore Features',
      suggestedLink: '/dashboard',
    },
    SUCCESS: {
      title: 'Platform Update Complete!',
      message: 'We\'ve shipped new improvements across all modules. Faster generation, better quality, more options!',
      linkText: 'See What\'s New',
      suggestedLink: '/dashboard',
    },
    WARNING: {
      title: 'Scheduled Maintenance',
      message: 'ReelForge AI will be briefly unavailable for maintenance. Save your work before the window.',
      linkText: 'View Schedule',
      suggestedLink: '/dashboard',
    },
    PROMOTION: {
      title: 'Upgrade & Save!',
      message: 'Get more credits and unlock premium features. Limited-time pricing available now!',
      linkText: 'View Plans',
      suggestedLink: '/billing',
    },
    ANNOUNCEMENT: {
      title: 'Big Things Coming!',
      message: 'We\'re working on exciting new features to supercharge your content creation workflow.',
      linkText: 'Stay Tuned',
      suggestedLink: '/dashboard',
    },
    NEW_FEATURE: {
      title: 'New Features Available!',
      message: 'Check out the latest additions to ReelForge AI — more AI power, more creative options!',
      linkText: 'Explore Now',
      suggestedLink: '/dashboard',
    },
  }

  return platformTemplates[bannerType] || platformTemplates.INFO
}
