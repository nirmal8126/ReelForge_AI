import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

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

// POST /api/admin/marketing/generate-promo — AI-generate promo code idea
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    const systemPrompt = `You are a marketing strategist for ReelForge AI, an AI-powered video generation platform (reels, long-form videos, quotes, cartoon series, challenge games).

Today's date is ${todayStr}.

Your task: Generate a creative promo code idea based on an upcoming or current occasion — festivals, holidays, seasons, special days, cultural events, etc. Think globally: Diwali, Christmas, Eid, Holi, Valentine's Day, Black Friday, New Year, Independence Days, Mother's/Father's Day, Halloween, Thanksgiving, Ramadan, Chinese New Year, Summer Sale, Back to School, World Environment Day, International Women's Day, etc.

Pick the NEAREST upcoming occasion (within the next 60 days) or a currently active one. If nothing specific is close, pick a creative seasonal theme.

Respond ONLY with valid JSON in this exact format:
{
  "code": "PROMO_CODE_HERE",
  "description": "Short description of the promo (max 100 chars)",
  "discountType": "PERCENTAGE" or "FIXED_AMOUNT" or "CREDIT_BONUS",
  "discountValue": number (percentage 5-50 for PERCENTAGE, cents 100-5000 for FIXED_AMOUNT, 0 for CREDIT_BONUS),
  "bonusCredits": number (1-20 for CREDIT_BONUS, 0 otherwise),
  "occasion": "Name of the occasion/festival",
  "maxUses": number or null (suggested max uses, null for unlimited),
  "validDays": number (suggested validity in days, 3-30),
  "targetPlans": [] (empty = all plans, or ["FREE","STARTER"] etc)
}

Rules for the code:
- Must be uppercase, letters/numbers/underscore only
- Should be catchy and relate to the occasion (e.g., DIWALI50, XMAS2025, NEWYEAR30)
- Max 20 characters
- Make it memorable and easy to type

Make the discount attractive but reasonable (10-30% off is the sweet spot).`

    const userMessage = `Generate a promo code idea for ReelForge AI based on the nearest upcoming occasion from today (${todayStr}). Make it creative and relevant!`

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
        console.error('Gemini promo gen error:', e)
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
        console.error('Anthropic promo gen error:', e)
      }
    }

    // Template fallback based on month
    if (!result) {
      result = generateFallbackPromo(today)
    }

    return NextResponse.json({ generated: result })
  } catch (err) {
    console.error('Promo generate error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

function generateFallbackPromo(today: Date) {
  const month = today.getMonth() // 0-indexed
  const day = today.getDate()
  const year = today.getFullYear()

  const occasions: { code: string; description: string; occasion: string; discountType: string; discountValue: number; bonusCredits: number; validDays: number }[] = [
    // Jan
    { code: `NEWYEAR${year}`, description: `New Year special! Start ${year} with amazing videos`, occasion: 'New Year', discountType: 'PERCENTAGE', discountValue: 25, bonusCredits: 0, validDays: 15 },
    // Feb
    { code: 'VALENTINE30', description: 'Spread the love with AI videos this Valentine\'s Day', occasion: 'Valentine\'s Day', discountType: 'PERCENTAGE', discountValue: 30, bonusCredits: 0, validDays: 7 },
    // Mar
    { code: 'HOLI_COLORS', description: 'Celebrate Holi with colorful AI-generated content!', occasion: 'Holi', discountType: 'CREDIT_BONUS', discountValue: 0, bonusCredits: 10, validDays: 10 },
    // Apr
    { code: 'SPRING25', description: 'Spring into content creation with 25% off', occasion: 'Spring Season', discountType: 'PERCENTAGE', discountValue: 25, bonusCredits: 0, validDays: 14 },
    // May
    { code: 'MOM_SPECIAL', description: 'Create something special for Mother\'s Day', occasion: 'Mother\'s Day', discountType: 'CREDIT_BONUS', discountValue: 0, bonusCredits: 5, validDays: 7 },
    // Jun
    { code: 'SUMMER_VIBES', description: 'Summer special — create viral content for less', occasion: 'Summer', discountType: 'PERCENTAGE', discountValue: 20, bonusCredits: 0, validDays: 30 },
    // Jul
    { code: 'MIDYEAR30', description: 'Mid-year mega sale on all AI video generation', occasion: 'Mid-Year Sale', discountType: 'PERCENTAGE', discountValue: 30, bonusCredits: 0, validDays: 14 },
    // Aug
    { code: 'INDEPENDENCE', description: 'Independence Day special — create patriotic reels!', occasion: 'Independence Day', discountType: 'PERCENTAGE', discountValue: 15, bonusCredits: 0, validDays: 7 },
    // Sep
    { code: 'BACKTOSCHOOL', description: 'Back to School! Educational content at a discount', occasion: 'Back to School', discountType: 'PERCENTAGE', discountValue: 20, bonusCredits: 0, validDays: 14 },
    // Oct
    { code: 'SPOOKY_DEAL', description: 'Halloween special — spooky savings on AI videos', occasion: 'Halloween', discountType: 'PERCENTAGE', discountValue: 25, bonusCredits: 0, validDays: 10 },
    // Nov
    { code: 'BLACKFRIDAY', description: 'Black Friday blowout — biggest discount of the year!', occasion: 'Black Friday', discountType: 'PERCENTAGE', discountValue: 40, bonusCredits: 0, validDays: 5 },
    // Dec
    { code: 'XMAS_MAGIC', description: 'Christmas magic! Gift yourself premium AI videos', occasion: 'Christmas', discountType: 'PERCENTAGE', discountValue: 30, bonusCredits: 0, validDays: 14 },
  ]

  const fallback = occasions[month]
  const expiresIn = fallback.validDays

  return {
    ...fallback,
    maxUses: null,
    targetPlans: [],
  }
}
