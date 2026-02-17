import { prisma } from '@reelforge/db'
import { resolveSegmentWhereForUser, SegmentRules } from './segment-resolver'

interface ActiveCampaign {
  id: string
  name: string
  creditMultiplier: number
  bonusCredits: number
  cashMultiplier: number
  startsAt: Date
  endsAt: Date
}

/**
 * Get the currently active referral campaign for a user.
 * If campaign has a targetSegmentId, checks if the user matches the segment.
 */
export async function getActiveReferralCampaign(userId?: string): Promise<ActiveCampaign | null> {
  const now = new Date()

  const campaigns = await prisma.referralCampaign.findMany({
    where: {
      status: 'ACTIVE',
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { creditMultiplier: 'desc' },
  })

  if (campaigns.length === 0) return null

  for (const campaign of campaigns) {
    // If no segment restriction, campaign applies to everyone
    if (!campaign.targetSegmentId) {
      return {
        id: campaign.id,
        name: campaign.name,
        creditMultiplier: campaign.creditMultiplier,
        bonusCredits: campaign.bonusCredits,
        cashMultiplier: campaign.cashMultiplier,
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
      }
    }

    // If segment restriction and userId provided, check membership
    if (userId) {
      const segment = await prisma.userSegment.findUnique({
        where: { id: campaign.targetSegmentId },
      })
      if (segment) {
        const where = resolveSegmentWhereForUser(segment.rules as unknown as SegmentRules, userId)
        const match = await prisma.user.count({ where })
        if (match > 0) {
          return {
            id: campaign.id,
            name: campaign.name,
            creditMultiplier: campaign.creditMultiplier,
            bonusCredits: campaign.bonusCredits,
            cashMultiplier: campaign.cashMultiplier,
            startsAt: campaign.startsAt,
            endsAt: campaign.endsAt,
          }
        }
      }
    }
  }

  return null
}

/**
 * Compute referral reward with campaign multiplier applied.
 */
export function computeReferralReward(
  baseCredits: number,
  campaign: ActiveCampaign | null
): { credits: number; bonusCredits: number; totalCredits: number } {
  if (!campaign) {
    return { credits: baseCredits, bonusCredits: 0, totalCredits: baseCredits }
  }

  const credits = Math.round(baseCredits * campaign.creditMultiplier)
  const bonusCredits = campaign.bonusCredits
  return { credits, bonusCredits, totalCredits: credits + bonusCredits }
}
