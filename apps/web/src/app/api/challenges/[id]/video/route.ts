import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { id } = await params

    const challenge = await prisma.challengeJob.findUnique({
      where: { id },
      select: { id: true, userId: true, outputUrl: true, status: true },
    })

    const isAdmin = (session.user as Record<string, unknown>).role === 'ADMIN'
    if (!challenge || (!isAdmin && challenge.userId !== session.user.id)) {
      return new NextResponse('Not Found', { status: 404 })
    }

    if (!challenge.outputUrl) {
      return new NextResponse('Video not yet generated', { status: 404 })
    }

    // Cloud URL — redirect
    if (!challenge.outputUrl.startsWith('file://')) {
      return NextResponse.redirect(challenge.outputUrl)
    }

    // Local file — serve it
    const filePath = challenge.outputUrl.replace('file://', '')

    if (!existsSync(filePath)) {
      return new NextResponse('Video file not found', { status: 404 })
    }

    const fileStats = await stat(filePath)
    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': fileStats.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving challenge video:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
