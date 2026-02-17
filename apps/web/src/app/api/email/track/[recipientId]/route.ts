import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

// GET /api/email/track/[recipientId] — tracking pixel for email opens
export async function GET(
  req: NextRequest,
  { params }: { params: { recipientId: string } }
) {
  const { recipientId } = params

  // Fire-and-forget tracking update
  try {
    const recipient = await prisma.emailRecipient.findUnique({
      where: { id: recipientId },
      select: { id: true, openedAt: true, campaignId: true },
    })

    if (recipient && !recipient.openedAt) {
      await prisma.emailRecipient.update({
        where: { id: recipientId },
        data: { openedAt: new Date(), status: 'OPENED' },
      })
      await prisma.emailCampaign.update({
        where: { id: recipient.campaignId },
        data: { openCount: { increment: 1 } },
      })
    }
  } catch {
    // silently ignore tracking errors
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
