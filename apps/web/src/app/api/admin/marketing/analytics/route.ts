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

// GET /api/admin/marketing/analytics
export async function GET(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { searchParams } = new URL(req.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const format = searchParams.get('format')

  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const to = dateTo ? new Date(dateTo) : new Date()
  to.setHours(23, 59, 59, 999)

  const [
    banners,
    campaigns,
    promos,
    sequences,
    referrals,
    userGrowth,
    segments,
    experiments,
    utmLinkCount,
    utmClickCount,
    topUtmCampaigns,
  ] = await Promise.all([
    // Banner metrics
    prisma.banner.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, title: true, viewCount: true, clickCount: true, type: true, isActive: true, createdAt: true },
      orderBy: { viewCount: 'desc' },
      take: 20,
    }),
    // Campaign metrics
    prisma.emailCampaign.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, name: true, status: true, totalRecipients: true, sentCount: true, openCount: true, createdAt: true },
    }),
    // Promo metrics
    prisma.promoCode.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, code: true, discountType: true, discountValue: true, usedCount: true, maxUses: true, isActive: true },
      orderBy: { usedCount: 'desc' },
      take: 20,
    }),
    // Sequence metrics
    prisma.emailSequence.findMany({
      select: {
        id: true,
        name: true,
        trigger: true,
        isActive: true,
        _count: { select: { steps: true, enrollments: true } },
      },
    }),
    // Referral funnel
    prisma.referral.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { createdAt: { gte: from, lte: to } },
    }),
    // User growth (grouped by day)
    prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= ${from} AND created_at <= ${to}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    ` as Promise<Array<{ date: string; count: bigint }>>,
    // Segment stats
    prisma.userSegment.findMany({
      select: { id: true, name: true, cachedCount: true, isActive: true },
      orderBy: { cachedCount: 'desc' },
    }),
    // Experiment stats
    prisma.bannerExperiment.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, name: true, status: true, splitPercent: true, bannerAId: true, bannerBId: true, winnerBannerId: true },
    }),
    // UTM link count
    prisma.utmLink.count(),
    // UTM click count in range
    prisma.utmClick.count({ where: { createdAt: { gte: from, lte: to } } }),
    // Top UTM campaigns by clicks
    prisma.$queryRaw`
      SELECT l.utm_campaign as campaign, COUNT(c.id) as count
      FROM utm_clicks c
      JOIN utm_links l ON c.utm_link_id = l.id
      WHERE c.created_at >= ${from} AND c.created_at <= ${to}
      GROUP BY l.utm_campaign
      ORDER BY count DESC
      LIMIT 5
    ` as Promise<Array<{ campaign: string; count: bigint }>>,
  ])

  // Compute aggregates
  const totalBannerViews = banners.reduce((sum, b) => sum + b.viewCount, 0)
  const totalBannerClicks = banners.reduce((sum, b) => sum + b.clickCount, 0)
  const bannerCTR = totalBannerViews > 0 ? ((totalBannerClicks / totalBannerViews) * 100).toFixed(2) : '0'

  const totalCampaignsSent = campaigns.filter(c => c.status === 'SENT').length
  const totalEmailsSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0)
  const totalEmailsOpened = campaigns.reduce((sum, c) => sum + c.openCount, 0)
  const openRate = totalEmailsSent > 0 ? ((totalEmailsOpened / totalEmailsSent) * 100).toFixed(2) : '0'

  const totalPromoRedemptions = promos.reduce((sum, p) => sum + p.usedCount, 0)

  const referralCounts: Record<string, number> = {}
  for (const r of referrals) {
    referralCounts[r.status] = Number(r._count.id)
  }
  const totalReferrals = Object.values(referralCounts).reduce((a, b) => a + b, 0)

  const sequenceEnrollments = sequences.reduce((sum, s) => sum + s._count.enrollments, 0)

  const userGrowthData = (userGrowth as any[]).map((row: any) => ({
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
    count: Number(row.count),
  }))

  // Campaign status distribution
  const campaignsByStatus: Record<string, number> = {}
  for (const c of campaigns) {
    campaignsByStatus[c.status] = (campaignsByStatus[c.status] || 0) + 1
  }

  const data = {
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      totalBannerViews,
      totalBannerClicks,
      bannerCTR: Number(bannerCTR),
      totalCampaignsSent,
      totalEmailsSent,
      totalEmailsOpened,
      openRate: Number(openRate),
      totalPromoRedemptions,
      totalReferrals,
      referralCounts,
      sequenceEnrollments,
      totalSegments: segments.length,
      totalExperiments: experiments.length,
      totalUtmLinks: utmLinkCount,
      totalUtmClicks: utmClickCount,
    },
    banners: banners.map((b) => ({
      ...b,
      ctr: b.viewCount > 0 ? Number(((b.clickCount / b.viewCount) * 100).toFixed(2)) : 0,
    })),
    campaigns,
    campaignsByStatus,
    promos,
    sequences: sequences.map((s) => ({
      id: s.id,
      name: s.name,
      trigger: s.trigger,
      isActive: s.isActive,
      stepCount: s._count.steps,
      enrollmentCount: s._count.enrollments,
    })),
    referralFunnel: referralCounts,
    userGrowth: userGrowthData,
    segments,
    experiments,
    topUtmCampaigns: (topUtmCampaigns as any[]).map((r) => ({
      campaign: r.campaign,
      count: Number(r.count),
    })),
  }

  // CSV export
  if (format === 'csv') {
    const csvRows: string[] = []
    csvRows.push('Marketing Analytics Report')
    csvRows.push(`Date Range: ${from.toISOString().split('T')[0]} to ${to.toISOString().split('T')[0]}`)
    csvRows.push('')

    csvRows.push('Summary Metrics')
    csvRows.push(`Total Banner Views,${data.summary.totalBannerViews}`)
    csvRows.push(`Total Banner Clicks,${data.summary.totalBannerClicks}`)
    csvRows.push(`Banner CTR,${data.summary.bannerCTR}%`)
    csvRows.push(`Total Campaigns Sent,${data.summary.totalCampaignsSent}`)
    csvRows.push(`Total Emails Sent,${data.summary.totalEmailsSent}`)
    csvRows.push(`Email Open Rate,${data.summary.openRate}%`)
    csvRows.push(`Total Promo Redemptions,${data.summary.totalPromoRedemptions}`)
    csvRows.push(`Total Referrals,${data.summary.totalReferrals}`)
    csvRows.push(`Active Sequence Enrollments,${data.summary.sequenceEnrollments}`)
    csvRows.push(`Total UTM Links,${data.summary.totalUtmLinks}`)
    csvRows.push(`Total UTM Clicks,${data.summary.totalUtmClicks}`)
    csvRows.push('')

    csvRows.push('Banner Performance')
    csvRows.push('Title,Views,Clicks,CTR%')
    for (const b of data.banners) {
      csvRows.push(`"${b.title}",${b.viewCount},${b.clickCount},${b.ctr}%`)
    }
    csvRows.push('')

    csvRows.push('Campaigns')
    csvRows.push('Name,Status,Recipients,Sent,Opened')
    for (const c of data.campaigns) {
      csvRows.push(`"${c.name}",${c.status},${c.totalRecipients},${c.sentCount},${c.openCount}`)
    }
    csvRows.push('')

    csvRows.push('Promo Codes')
    csvRows.push('Code,Type,Value,Redemptions')
    for (const p of data.promos) {
      csvRows.push(`${p.code},${p.discountType},${p.discountValue},${p.usedCount}`)
    }
    csvRows.push('')

    csvRows.push('User Growth')
    csvRows.push('Date,New Users')
    for (const u of data.userGrowth) {
      csvRows.push(`${u.date},${u.count}`)
    }

    const csv = csvRows.join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="marketing-analytics-${from.toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  return NextResponse.json(data)
}
