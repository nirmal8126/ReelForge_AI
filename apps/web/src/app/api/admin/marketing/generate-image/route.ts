import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

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

// POST /api/admin/marketing/generate-image — AI-generate a banner image
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const body = await req.json()
    const { title, message, bannerType, targetModule } = body

    if (!title && !message) {
      return NextResponse.json(
        { error: 'Provide at least a title or message for image generation' },
        { status: 400 }
      )
    }

    // Build a descriptive prompt for the image
    const moduleLabels: Record<string, string> = {
      reels: 'AI Reels short video creation',
      long_form: 'Long-form video production',
      quotes: 'AI quote images and videos',
      challenges: 'Interactive quiz and challenge reels',
      cartoon_studio: 'Animated cartoon series creation',
    }

    const typeStyles: Record<string, string> = {
      INFO: 'clean, informative, blue-toned',
      SUCCESS: 'celebratory, green-toned, positive',
      WARNING: 'attention-grabbing, amber/yellow-toned',
      PROMOTION: 'exciting, vibrant, promotional deal',
      ANNOUNCEMENT: 'bold, purple-toned, newsworthy',
      NEW_FEATURE: 'modern, cyan/teal-toned, innovative',
    }

    const moduleCtx = targetModule && moduleLabels[targetModule]
      ? ` about ${moduleLabels[targetModule]}`
      : ' for an AI video creation platform'

    const styleHint = typeStyles[bannerType] || 'modern, professional'

    const imagePrompt = `Create a professional marketing banner image${moduleCtx}. Title: "${title || 'Marketing Banner'}". ${message ? `Message: "${message}". ` : ''}Style: ${styleHint}. The image should be a wide horizontal banner, visually appealing with modern gradients, subtle tech/AI elements, and professional feel. Do NOT include any text or letters in the image — only visual elements, patterns, and abstract shapes. Dark theme preferred with vibrant accent colors.`

    let imageUrl: string | null = null

    // Try Gemini first (primary — uses gemini-2.5-flash-image for native image generation)
    if (!imageUrl && process.env.GEMINI_API_KEY) {
      try {
        const geminiKey = process.env.GEMINI_API_KEY
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [{ text: imagePrompt }],
              }],
              generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: {
                  aspectRatio: '16:9',
                },
              },
            }),
          }
        )

        if (geminiRes.ok) {
          const data = await geminiRes.json()
          const parts = data?.candidates?.[0]?.content?.parts || []
          for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith('image/')) {
              const buffer = Buffer.from(part.inlineData.data, 'base64')
              const ext = part.inlineData.mimeType.includes('png') ? 'png' : 'jpg'
              const filename = `banner-ai-${Date.now()}.${ext}`
              const uploadDir = path.join(process.cwd(), 'public', 'uploads')
              await mkdir(uploadDir, { recursive: true })
              await writeFile(path.join(uploadDir, filename), buffer)
              imageUrl = `/uploads/${filename}`
              break
            }
          }
        } else {
          const errData = await geminiRes.json().catch(() => ({}))
          console.error('Gemini image gen response error:', geminiRes.status, errData)
        }
      } catch (e) {
        console.error('Gemini image gen error:', e)
      }
    }

    // Fallback: OpenAI DALL-E
    if (!imageUrl && process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = (await import('openai')).default
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: imagePrompt,
          n: 1,
          size: '1792x1024',
          quality: 'standard',
        })

        const generatedUrl = response.data?.[0]?.url
        if (generatedUrl) {
          const imgRes = await fetch(generatedUrl)
          if (imgRes.ok) {
            const buffer = Buffer.from(await imgRes.arrayBuffer())
            const filename = `banner-ai-${Date.now()}.png`
            const uploadDir = path.join(process.cwd(), 'public', 'uploads')
            await mkdir(uploadDir, { recursive: true })
            await writeFile(path.join(uploadDir, filename), buffer)
            imageUrl = `/uploads/${filename}`
          }
        }
      } catch (e) {
        console.error('OpenAI image gen error:', e)
      }
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image generation failed. Ensure GEMINI_API_KEY or OPENAI_API_KEY is configured.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ imageUrl })
  } catch (err) {
    console.error('Banner image generate error:', err)
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
  }
}
