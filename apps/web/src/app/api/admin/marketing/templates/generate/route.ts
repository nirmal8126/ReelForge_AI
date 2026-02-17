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

const generateSchema = z.object({
  description: z.string().min(5).max(500),
  category: z.enum(['WELCOME', 'PROMOTIONAL', 'NEWSLETTER', 'TRANSACTIONAL', 'NOTIFICATION', 'CUSTOM']).optional(),
})

const systemPrompt = `You are an expert email template designer. Generate a professional, responsive HTML email template based on the user's description.

Requirements:
- Use inline CSS only (no <style> tags)
- Dark theme: background #0a0a1a, content box #111827, text white/gray
- Primary brand color: #6366F1 (indigo)
- Max width 600px, mobile-responsive
- Include the ReelForge AI brand header (RF logo box + "ReelForge AI" text)
- Use {{variableName}} syntax for dynamic variables (e.g. {{userName}}, {{email}}, {{appUrl}})
- Include a footer with unsubscribe link using {{unsubscribeUrl}}
- Clean, modern design with adequate spacing

Return ONLY a JSON object with these fields:
{
  "subject": "Email subject line with optional {{variables}}",
  "body": "Full HTML email body",
  "variables": ["list", "of", "variable", "names"]
}`

// POST /api/admin/marketing/templates/generate
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const data = generateSchema.parse(body)

    const userMessage = `Generate an email template for: ${data.description}${data.category ? `. Category: ${data.category}` : ''}`

    let result: { subject: string; body: string; variables: string[] } | null = null

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
              generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
            }),
          }
        )
        if (geminiRes.ok) {
          const gemData = await geminiRes.json()
          const text = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0])
          }
        }
      } catch (e) {
        console.error('Gemini template gen error:', e)
      }
    }

    // Fallback to Anthropic
    if (!result && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
        const response = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })
        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.error('Anthropic template gen error:', e)
      }
    }

    // Template fallback
    if (!result) {
      result = generateFallbackTemplate(data.description, data.category)
    }

    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: err?.message || 'Failed to generate template' }, { status: 500 })
  }
}

function generateFallbackTemplate(description: string, category?: string): { subject: string; body: string; variables: string[] } {
  const cat = category || 'CUSTOM'
  const subjects: Record<string, string> = {
    WELCOME: 'Welcome to ReelForge AI, {{userName}}!',
    PROMOTIONAL: 'Special Offer Just for You, {{userName}}!',
    NEWSLETTER: 'Your Weekly ReelForge AI Update',
    TRANSACTIONAL: 'Your ReelForge AI Account Update',
    NOTIFICATION: 'Important Update from ReelForge AI',
    CUSTOM: 'A Message from ReelForge AI',
  }

  return {
    subject: subjects[cat] || subjects.CUSTOM,
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background-color:#6366F1;border-radius:12px;padding:12px 16px;">
        <span style="color:white;font-weight:bold;font-size:18px;">RF</span>
      </div>
      <p style="color:#6366F1;font-weight:600;font-size:16px;margin-top:8px;">ReelForge AI</p>
    </div>
    <div style="background-color:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;">
      <h1 style="color:white;font-size:24px;margin:0 0 16px 0;">Hello {{userName}},</h1>
      <p style="color:#D1D5DB;font-size:16px;line-height:1.6;margin:0 0 24px 0;">${description}</p>
      <a href="{{appUrl}}" style="display:inline-block;background-color:#6366F1;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Visit ReelForge AI</a>
    </div>
    <div style="text-align:center;margin-top:32px;">
      <p style="color:#6B7280;font-size:12px;">ReelForge AI &middot; AI-Powered Video Generation</p>
      <a href="{{unsubscribeUrl}}" style="color:#6B7280;font-size:12px;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`,
    variables: ['userName', 'appUrl', 'unsubscribeUrl'],
  }
}
