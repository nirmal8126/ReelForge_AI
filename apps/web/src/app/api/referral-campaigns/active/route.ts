import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getActiveReferralCampaign } from '@/lib/referral-campaign'

// GET /api/referral-campaigns/active — get active campaign for current user
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ campaign: null })
  }

  const campaign = await getActiveReferralCampaign(session.user.id)

  return NextResponse.json({ campaign })
}
