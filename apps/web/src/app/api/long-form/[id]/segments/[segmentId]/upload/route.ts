import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { writeFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import os from 'os'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; segmentId: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Verify job ownership
    const job = await prisma.longFormJob.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { id: true, status: true, userId: true },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'COMPLETED' && job.status !== 'RECOMPOSING') {
      return NextResponse.json({ error: 'Job must be completed to upload assets' }, { status: 400 })
    }

    // Verify segment
    const segment = await prisma.longFormSegment.findFirst({
      where: { id: params.segmentId, longFormJobId: params.id },
    })

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Supported: MP4, WebM, MOV, PNG, JPEG, WebP' }, { status: 400 })
    }

    // Validate size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 100MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.type.startsWith('video/') ? 'mp4' : file.type.split('/')[1]
    const key = `segments/${job.userId}/${params.id}/${params.segmentId}.${ext}`

    let url: string

    // Try R2 upload, fallback to local
    const hasR2 = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
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
      // Local fallback
      const localDir = path.join(os.tmpdir(), 'reelforge-segments', job.userId, params.id)
      await mkdir(localDir, { recursive: true })
      const localPath = path.join(localDir, `${params.segmentId}.${ext}`)
      await writeFile(localPath, buffer)
      url = `file://${localPath}`
    }

    // Determine visual type from file type
    const visualType = file.type.startsWith('video/') ? 'STOCK_VIDEO' : 'STATIC_IMAGE'

    // Update segment
    const updated = await prisma.longFormSegment.update({
      where: { id: params.segmentId },
      data: { assetUrl: url, visualType },
    })

    return NextResponse.json({ segment: updated, url })
  } catch (error) {
    console.error('Segment upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
