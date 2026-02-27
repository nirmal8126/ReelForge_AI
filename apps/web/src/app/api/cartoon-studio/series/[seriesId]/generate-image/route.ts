import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { seriesId } = await params

  const series = await prisma.cartoonSeries.findFirst({
    where: { id: seriesId, userId: session.user.id },
    include: { characters: { select: { name: true, description: true } } },
  })
  if (!series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI generation not available' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const imageType = body.type as string

    if (!imageType || !['banner', 'logo'].includes(imageType)) {
      return NextResponse.json({ error: 'Type must be "banner" or "logo"' }, { status: 400 })
    }

    // Build prompt from series metadata
    const charNames = series.characters.map((c) => c.name).join(', ')
    const prompt = imageType === 'banner'
      ? buildBannerPrompt(series.name, series.description, series.artStyle, series.targetAudience, charNames)
      : buildLogoPrompt(series.name, series.description, series.artStyle, charNames)

    const aspectRatio = imageType === 'banner' ? '16:9' : '1:1'

    // Call Gemini 2.5 Flash Image
    const model = 'gemini-2.5-flash-image'
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }],
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio },
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('Gemini image API error:', err)
      return NextResponse.json({ error: 'AI image generation failed' }, { status: 502 })
    }

    const data = await response.json()
    const parts = data.candidates?.[0]?.content?.parts
    const imagePart = parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))

    if (!imagePart?.inlineData?.data) {
      return NextResponse.json({ error: 'AI did not generate an image' }, { status: 502 })
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
    const mimeType = imagePart.inlineData.mimeType || 'image/png'
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    const timestamp = Date.now()
    const key = `cartoon-studio/${session.user.id}/${seriesId}/${imageType}_ai_${timestamp}.${ext}`

    // Upload to storage
    const hasR2 = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
    let url: string

    if (hasR2) {
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      })

      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || 'reelforge',
        Key: key,
        Body: imageBuffer,
        ContentType: mimeType,
      }))

      const cdnDomain = process.env.R2_PUBLIC_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.dev`
      url = `${cdnDomain}/${key}`
    } else {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'cartoon-studio', seriesId)
      await mkdir(uploadsDir, { recursive: true })
      const filename = `${imageType}_ai_${timestamp}.${ext}`
      await writeFile(path.join(uploadsDir, filename), imageBuffer)
      url = `/uploads/cartoon-studio/${seriesId}/${filename}`
    }

    // Update the series record
    const updateData = imageType === 'banner' ? { bannerUrl: url } : { logoUrl: url }
    await prisma.cartoonSeries.update({
      where: { id: seriesId },
      data: updateData,
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Cartoon studio AI image generation error:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}

function buildBannerPrompt(
  name: string,
  description: string | null,
  artStyle: string | null,
  audience: string | null,
  charNames: string,
): string {
  const parts = [
    `Create a wide cinematic banner illustration for an animated cartoon series called "${name}".`,
    description ? `The series is about: ${description}.` : '',
    artStyle ? `Art style: ${artStyle}.` : 'Art style: colorful cartoon.',
    audience ? `Target audience: ${audience}.` : '',
    charNames ? `Main characters: ${charNames}.` : '',
    'Create a vibrant, atmospheric scene that captures the mood and world of this series.',
    'Do NOT include any text, words, letters, or writing in the image.',
    'Make it visually appealing with rich colors and dynamic composition.',
  ]
  return parts.filter(Boolean).join(' ')
}

function buildLogoPrompt(
  name: string,
  description: string | null,
  artStyle: string | null,
  charNames: string,
): string {
  const parts = [
    `Create a square logo or emblem for an animated cartoon series called "${name}".`,
    description ? `The series is about: ${description}.` : '',
    artStyle ? `Art style: ${artStyle}.` : 'Art style: colorful cartoon.',
    charNames ? `Inspired by characters: ${charNames}.` : '',
    'Make it iconic, memorable, and visually simple.',
    'Do NOT include any text, words, letters, or writing in the image.',
    'Use a clean, bold design suitable as a series icon or avatar.',
  ]
  return parts.filter(Boolean).join(' ')
}
