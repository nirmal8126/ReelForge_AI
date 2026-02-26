import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const index = parseInt(searchParams.get('index') || '0', 10)

    const job = await prisma.imageStudioJob.findUnique({
      where: { id },
      select: { id: true, userId: true, imageUrls: true },
    })

    const isAdmin = (session.user as Record<string, unknown>).role === 'ADMIN'
    if (!job || (!isAdmin && job.userId !== session.user.id)) {
      return new NextResponse('Not Found', { status: 404 })
    }

    const imageUrls = Array.isArray(job.imageUrls) ? (job.imageUrls as string[]) : []
    if (index < 0 || index >= imageUrls.length) {
      return new NextResponse('Image index out of range', { status: 404 })
    }

    const imageUrl = imageUrls[index]

    // Cloud URL — redirect
    if (!imageUrl.startsWith('file://')) {
      return NextResponse.redirect(imageUrl)
    }

    // Local file — serve it
    const filePath = imageUrl.replace('file://', '')

    if (!existsSync(filePath)) {
      return new NextResponse('Image file not found', { status: 404 })
    }

    const fileStats = await stat(filePath)
    const fileBuffer = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStats.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving image:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
