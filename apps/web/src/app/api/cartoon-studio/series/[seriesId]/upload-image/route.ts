import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

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
  })
  if (!series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    const imageType = formData.get('type') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    if (!imageType || !['banner', 'logo'].includes(imageType)) {
      return NextResponse.json({ error: 'Type must be "banner" or "logo"' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Supported: PNG, JPEG, WebP` },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const timestamp = Date.now()
    const key = `cartoon-studio/${session.user.id}/${seriesId}/${imageType}_${timestamp}.${ext}`

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
        Body: buffer,
        ContentType: file.type,
      }))

      const cdnDomain = process.env.R2_PUBLIC_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.dev`
      url = `${cdnDomain}/${key}`
    } else {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'cartoon-studio', seriesId)
      await mkdir(uploadsDir, { recursive: true })
      const filename = `${imageType}_${timestamp}.${ext}`
      await writeFile(path.join(uploadsDir, filename), buffer)
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
    console.error('Cartoon studio image upload error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
