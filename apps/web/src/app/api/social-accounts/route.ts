import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

// ---------------------------------------------------------------------------
// GET /api/social-accounts — list user's connected accounts
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { userId: session.user.id, isActive: true },
    select: {
      id: true,
      platform: true,
      accountId: true,
      accountName: true,
      accountAvatar: true,
      tokenExpiry: true,
      scopes: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Get platform configs to show availability
  const platformConfigs = await prisma.socialPlatformConfig.findMany()

  return NextResponse.json({ accounts, platformConfigs })
}

// ---------------------------------------------------------------------------
// DELETE /api/social-accounts — disconnect an account
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('id')

  if (!accountId) {
    return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
  }

  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  })

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Soft delete — mark inactive
  await prisma.socialAccount.update({
    where: { id: accountId },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
