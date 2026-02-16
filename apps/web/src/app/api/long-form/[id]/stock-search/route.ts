import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

const PEXELS_API_URL = 'https://api.pexels.com/videos/search'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Verify job ownership
    const job = await prisma.longFormJob.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { id: true },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const query = req.nextUrl.searchParams.get('query')
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1')

    if (!query) {
      return NextResponse.json({ error: 'query parameter is required' }, { status: 400 })
    }

    const pexelsKey = process.env.PEXELS_API_KEY
    if (!pexelsKey) {
      return NextResponse.json({ error: 'Stock footage not configured' }, { status: 503 })
    }

    const response = await fetch(`${PEXELS_API_URL}?query=${encodeURIComponent(query)}&per_page=12&page=${page}&orientation=landscape`, {
      headers: { Authorization: pexelsKey },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Stock API error' }, { status: 502 })
    }

    const data = await response.json() as {
      videos: Array<{
        id: number
        url: string
        image: string
        duration: number
        video_files: Array<{
          id: number
          quality: string
          width: number
          height: number
          link: string
        }>
      }>
      total_results: number
    }

    const results = data.videos.map((v) => {
      const hdFile = v.video_files.find(
        (f) => f.quality === 'hd' && f.width >= 1280
      ) || v.video_files[0]

      return {
        id: v.id,
        thumbnail: v.image,
        previewUrl: hdFile?.link || '',
        duration: v.duration,
        width: hdFile?.width || 0,
        height: hdFile?.height || 0,
      }
    })

    return NextResponse.json({ results, total: data.total_results })
  } catch (error) {
    console.error('Stock search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
