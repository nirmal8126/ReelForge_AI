import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'
import { hashIp, buildUtmUrl } from '@/lib/utm-builder'
import { detectCountry } from '@/lib/geo'

// GET /api/r/[shortCode] — public redirect + click tracking
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params

  const link = await prisma.utmLink.findUnique({ where: { shortCode } })
  if (!link || !link.isActive) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Record click asynchronously (fire-and-forget)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') || ''
  const userAgent = req.headers.get('user-agent') || ''
  const referer = req.headers.get('referer') || ''

  // Detect country (non-blocking)
  const countryPromise = detectCountry(req).catch(() => null)

  const country = await countryPromise

  // Record click + increment total (fire-and-forget)
  prisma.utmClick.create({
    data: {
      utmLinkId: link.id,
      ipHash: ip ? hashIp(ip) : null,
      userAgent: userAgent.substring(0, 500),
      referer: referer.substring(0, 500) || null,
      country,
    },
  }).then(() =>
    prisma.utmLink.update({
      where: { id: link.id },
      data: { totalClicks: { increment: 1 } },
    })
  ).catch(() => {})

  // Build destination URL with UTM params
  const destinationUrl = buildUtmUrl(link.destinationUrl, {
    utmSource: link.utmSource,
    utmMedium: link.utmMedium,
    utmCampaign: link.utmCampaign,
    utmTerm: link.utmTerm || undefined,
    utmContent: link.utmContent || undefined,
  })

  return NextResponse.redirect(destinationUrl, 302)
}
