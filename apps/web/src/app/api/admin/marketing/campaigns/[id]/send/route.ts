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

// POST /api/admin/marketing/campaigns/[id]/send — send campaign emails
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = params

  try {
    const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'Campaign has already been sent' }, { status: 400 })
    }

    // Build user query based on targeting
    const where: any = { isActive: true }
    if (campaign.targetPlans) {
      const plans = campaign.targetPlans as string[]
      if (plans.length > 0) {
        where.subscription = { plan: { in: plans } }
      }
    }
    if (campaign.targetCountries) {
      const countries = campaign.targetCountries as string[]
      if (countries.length > 0) {
        where.country = { in: countries }
      }
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true },
    })

    if (users.length === 0) {
      return NextResponse.json({ error: 'No matching users found' }, { status: 400 })
    }

    // Update campaign to SENDING
    await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: 'SENDING',
        totalRecipients: users.length,
      },
    })

    // Create recipient records
    await prisma.emailRecipient.createMany({
      data: users.map((u) => ({
        campaignId: id,
        userId: u.id,
        email: u.email,
      })),
      skipDuplicates: true,
    })

    // Send emails asynchronously (don't block the response)
    sendEmailsInBackground(id, campaign.subject, campaign.body).catch((err) => {
      console.error('Campaign send background error:', err)
    })

    return NextResponse.json({
      success: true,
      totalRecipients: users.length,
      message: 'Campaign is being sent',
    })
  } catch (err: any) {
    console.error('Campaign send error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to send campaign' }, { status: 500 })
  }
}

async function sendEmailsInBackground(campaignId: string, subject: string, body: string) {
  try {
    const { sendCampaignEmail } = await import('@/lib/email')

    const recipients = await prisma.emailRecipient.findMany({
      where: { campaignId, status: 'PENDING' },
    })

    let sentCount = 0

    // Send in batches of 10 with 200ms delays
    for (let i = 0; i < recipients.length; i += 10) {
      const batch = recipients.slice(i, i + 10)

      await Promise.allSettled(
        batch.map(async (recipient) => {
          try {
            await sendCampaignEmail(recipient.email, subject, body, recipient.id)
            await prisma.emailRecipient.update({
              where: { id: recipient.id },
              data: { status: 'SENT', sentAt: new Date() },
            })
            sentCount++
          } catch (err) {
            console.error(`Failed to send to ${recipient.email}:`, err)
            await prisma.emailRecipient.update({
              where: { id: recipient.id },
              data: { status: 'FAILED' },
            })
          }
        })
      )

      // Update sent count after each batch
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { sentCount },
      })

      // Delay between batches
      if (i + 10 < recipients.length) {
        await new Promise((r) => setTimeout(r, 200))
      }
    }

    // Mark campaign as SENT
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        sentCount,
      },
    })
  } catch (err) {
    console.error('Background send error:', err)
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' },
    }).catch(() => {})
  }
}
