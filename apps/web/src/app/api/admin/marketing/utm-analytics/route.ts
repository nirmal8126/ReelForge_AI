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

// GET /api/admin/marketing/utm-analytics
export async function GET(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const to = dateTo ? new Date(dateTo) : new Date()
  to.setHours(23, 59, 59, 999)

  const [
    totalLinks,
    totalClicks,
    clicksBySource,
    clicksByMedium,
    clicksByCampaign,
    dailyClicks,
    topLinks,
  ] = await Promise.all([
    prisma.utmLink.count(),
    prisma.utmClick.count({ where: { createdAt: { gte: from, lte: to } } }),
    // Clicks by source
    prisma.$queryRaw`
      SELECT l.utm_source as source, COUNT(c.id) as count
      FROM utm_clicks c
      JOIN utm_links l ON c.utm_link_id = l.id
      WHERE c.created_at >= ${from} AND c.created_at <= ${to}
      GROUP BY l.utm_source
      ORDER BY count DESC
      LIMIT 10
    ` as Promise<Array<{ source: string; count: bigint }>>,
    // Clicks by medium
    prisma.$queryRaw`
      SELECT l.utm_medium as medium, COUNT(c.id) as count
      FROM utm_clicks c
      JOIN utm_links l ON c.utm_link_id = l.id
      WHERE c.created_at >= ${from} AND c.created_at <= ${to}
      GROUP BY l.utm_medium
      ORDER BY count DESC
      LIMIT 10
    ` as Promise<Array<{ medium: string; count: bigint }>>,
    // Clicks by campaign
    prisma.$queryRaw`
      SELECT l.utm_campaign as campaign, COUNT(c.id) as count
      FROM utm_clicks c
      JOIN utm_links l ON c.utm_link_id = l.id
      WHERE c.created_at >= ${from} AND c.created_at <= ${to}
      GROUP BY l.utm_campaign
      ORDER BY count DESC
      LIMIT 10
    ` as Promise<Array<{ campaign: string; count: bigint }>>,
    // Daily click trend
    prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM utm_clicks
      WHERE created_at >= ${from} AND created_at <= ${to}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    ` as Promise<Array<{ date: string; count: bigint }>>,
    // Top performing links
    prisma.utmLink.findMany({
      orderBy: { totalClicks: 'desc' },
      take: 10,
      select: {
        id: true,
        shortCode: true,
        destinationUrl: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        totalClicks: true,
      },
    }),
  ])

  return NextResponse.json({
    summary: {
      totalLinks,
      totalClicks,
    },
    clicksBySource: (clicksBySource as any[]).map((r) => ({
      source: r.source,
      count: Number(r.count),
    })),
    clicksByMedium: (clicksByMedium as any[]).map((r) => ({
      medium: r.medium,
      count: Number(r.count),
    })),
    clicksByCampaign: (clicksByCampaign as any[]).map((r) => ({
      campaign: r.campaign,
      count: Number(r.count),
    })),
    dailyClicks: (dailyClicks as any[]).map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      count: Number(r.count),
    })),
    topLinks,
  })
}
