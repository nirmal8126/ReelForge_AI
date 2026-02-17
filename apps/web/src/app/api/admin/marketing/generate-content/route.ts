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

const requestSchema = z.object({
  contentType: z.enum(['notification', 'campaign']),
})

// POST /api/admin/marketing/generate-content
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { contentType } = requestSchema.parse(body)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    const baseContext = `You are a marketing strategist for ReelForge AI, an AI-powered video generation platform.
The platform helps content creators generate professional videos using AI — including short reels, long-form videos, quote images/videos, cartoon series, and challenge/game reels.
Today's date is ${todayStr}.
Think about upcoming or current occasions — festivals, holidays, seasons, special days, cultural events, product launches, engagement campaigns, etc. Pick the NEAREST upcoming occasion (within 60 days) or a creative seasonal theme.`

    let systemPrompt: string
    let responseFormat: string

    if (contentType === 'notification') {
      systemPrompt = `${baseContext}

Generate an in-app notification idea for ReelForge AI users. Notifications appear as a bell dropdown in the sidebar.

${responseFormat = ''}Respond ONLY with valid JSON in this exact format:
{
  "title": "Short catchy title (max 60 chars)",
  "message": "Notification body text (max 200 chars, engaging and actionable)",
  "type": "One of: INFO, SUCCESS, PROMOTION, ANNOUNCEMENT, NEW_FEATURE",
  "linkUrl": "Suggested relative URL path (e.g., /reels/new, /billing, /challenges)",
  "occasion": "Name of the occasion or theme"
}

Make notifications feel personal and actionable. Users should want to click.
Examples of good notifications:
- "Holi Special: Create vibrant colorful reels!" with link to /reels/new
- "New Year Challenge: Make your first reel of 2026!" with link to /challenges
- "Valentine's Day is coming — create heartfelt video messages!" with link to /quotes/new`

    } else {
      systemPrompt = `${baseContext}

Generate an email campaign idea for ReelForge AI users. This is a marketing email sent via the admin panel.

Respond ONLY with valid JSON in this exact format:
{
  "name": "Internal campaign name (e.g., 'Holi 2026 Promotion')",
  "subject": "Email subject line (catchy, max 80 chars, emoji allowed)",
  "body": "HTML email body content. Use inline styles. Include a heading, 2-3 paragraphs, and a CTA button. Style: dark theme (bg #111827, text white/gray, brand color #6366F1 for buttons). Keep it concise and engaging.",
  "occasion": "Name of the occasion or theme"
}

The email body should be well-formatted HTML with inline styles that works inside an email template wrapper.
Use a professional but exciting tone. Include a clear call-to-action.
Example CTA: <a href="/reels/new" style="display:inline-block;background-color:#6366F1;color:white;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">Create Your Reel Now</a>`
    }

    const userMessage = `Generate a ${contentType === 'notification' ? 'notification' : 'email campaign'} idea for ReelForge AI based on the nearest upcoming occasion from today (${todayStr}). Make it creative and relevant!`

    let result: Record<string, unknown> | null = null

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
              generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
            }),
          }
        )
        if (geminiRes.ok) {
          const data = await geminiRes.json()
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0])
          }
        }
      } catch (e) {
        console.error('Gemini content gen error:', e)
      }
    }

    // Fallback to Anthropic
    if (!result && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
        const response = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })
        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.error('Anthropic content gen error:', e)
      }
    }

    // Template fallback
    if (!result) {
      result = contentType === 'notification'
        ? generateFallbackNotification(today)
        : generateFallbackCampaign(today)
    }

    return NextResponse.json({ generated: result })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Content generate error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

function getMonthOccasion(month: number): { occasion: string; theme: string; link: string; emoji: string } {
  const occasions = [
    { occasion: 'New Year', theme: 'new beginnings and fresh content', link: '/reels/new', emoji: '🎉' },
    { occasion: "Valentine's Day", theme: 'love, heartfelt messages and connections', link: '/quotes/new', emoji: '❤️' },
    { occasion: 'Holi / Spring', theme: 'colors, joy, and vibrant content', link: '/reels/new', emoji: '🌈' },
    { occasion: 'Spring Season', theme: 'fresh starts and creative energy', link: '/reels/new', emoji: '🌸' },
    { occasion: "Mother's Day", theme: 'celebrating mothers with heartfelt videos', link: '/quotes/new', emoji: '💐' },
    { occasion: 'Summer', theme: 'summer vibes and trending content', link: '/challenges', emoji: '☀️' },
    { occasion: 'Mid-Year', theme: 'leveling up your content game', link: '/long-form', emoji: '🚀' },
    { occasion: 'Independence Day', theme: 'patriotic and celebration content', link: '/reels/new', emoji: '🎆' },
    { occasion: 'Back to School', theme: 'educational and informative content', link: '/long-form', emoji: '📚' },
    { occasion: 'Halloween', theme: 'spooky, fun and creative content', link: '/cartoon-studio', emoji: '🎃' },
    { occasion: 'Black Friday', theme: 'deals, savings and premium features', link: '/billing', emoji: '🏷️' },
    { occasion: 'Christmas / Holidays', theme: 'holiday season and year-end celebrations', link: '/reels/new', emoji: '🎄' },
  ]
  return occasions[month]
}

function generateFallbackNotification(today: Date) {
  const o = getMonthOccasion(today.getMonth())
  return {
    title: `${o.emoji} ${o.occasion} Special!`,
    message: `Celebrate ${o.occasion} with ReelForge AI — create stunning videos about ${o.theme}!`,
    type: 'PROMOTION',
    linkUrl: o.link,
    occasion: o.occasion,
  }
}

function generateFallbackCampaign(today: Date) {
  const o = getMonthOccasion(today.getMonth())
  return {
    name: `${o.occasion} ${today.getFullYear()} Campaign`,
    subject: `${o.emoji} ${o.occasion} Special — Create Amazing Videos with ReelForge AI!`,
    body: `<h1 style="color:white;font-size:24px;margin:0 0 16px;">${o.emoji} ${o.occasion} is here!</h1>
<p style="color:#9CA3AF;font-size:14px;line-height:1.6;">It's the perfect time to create content about ${o.theme}. ReelForge AI makes it easy to generate professional videos in minutes.</p>
<p style="color:#9CA3AF;font-size:14px;line-height:1.6;margin-top:12px;">Whether you're making short reels, long-form videos, or animated cartoons — our AI tools have you covered.</p>
<div style="text-align:center;margin:28px 0;">
  <a href="${o.link}" style="display:inline-block;background-color:#6366F1;color:white;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">Start Creating Now</a>
</div>
<p style="color:#6B7280;font-size:13px;">Don't miss out — make the most of this ${o.occasion.toLowerCase()} season!</p>`,
    occasion: o.occasion,
  }
}
