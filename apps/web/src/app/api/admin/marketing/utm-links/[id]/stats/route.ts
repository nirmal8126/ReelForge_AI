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

// GET /api/admin/marketing/utm-links/[id]/stats
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = await params

  const link = await prisma.utmLink.findUnique({ where: { id } })
  if (!link) {
    return NextResponse.json({ error: 'UTM link not found' }, { status: 404 })
  }

  // Daily click counts (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const dailyClicks = await prisma.$queryRaw`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM utm_clicks
    WHERE utm_link_id = ${id} AND created_at >= ${thirtyDaysAgo}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  ` as Array<{ date: string; count: bigint }>

  // Top referrers
  const topReferrers = await prisma.utmClick.groupBy({
    by: ['referer'],
    where: { utmLinkId: id, referer: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  // Top countries
  const topCountries = await prisma.utmClick.groupBy({
    by: ['country'],
    where: { utmLinkId: id, country: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  // Unique visitors (by IP hash)
  const uniqueVisitors = await prisma.utmClick.groupBy({
    by: ['ipHash'],
    where: { utmLinkId: id, ipHash: { not: null } },
  })

  return NextResponse.json({
    link,
    stats: {
      totalClicks: link.totalClicks,
      uniqueVisitors: uniqueVisitors.length,
      dailyClicks: (dailyClicks as any[]).map((d: any) => ({
        date: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date),
        count: Number(d.count),
      })),
      topReferrers: topReferrers.map((r) => ({
        referer: r.referer || 'Direct',
        count: r._count.id,
      })),
      topCountries: topCountries.map((c) => ({
        country: c.country || 'Unknown',
        count: c._count.id,
      })),
    },
  })
}
