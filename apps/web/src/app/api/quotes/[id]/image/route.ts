import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const quoteJob = await prisma.quoteJob.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, imageUrl: true, status: true },
    })

    if (!quoteJob || quoteJob.userId !== session.user.id) {
      return new NextResponse('Not Found', { status: 404 })
    }

    if (!quoteJob.imageUrl) {
      return new NextResponse('Image not yet generated', { status: 404 })
    }

    // Check if it's a local file:// URL
    if (!quoteJob.imageUrl.startsWith('file://')) {
      // Cloud storage URL - redirect to it
      return NextResponse.redirect(quoteJob.imageUrl)
    }

    // Local file - serve it
    const filePath = quoteJob.imageUrl.replace('file://', '')

    if (!existsSync(filePath)) {
      return new NextResponse('Image file not found', { status: 404 })
    }

    const fileStats = await stat(filePath)
    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': fileStats.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving quote image:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
