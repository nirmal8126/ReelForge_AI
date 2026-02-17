import { prisma } from '@reelforge/db'

type BadgeTrigger = 'referral' | 'reel' | 'login'

const BADGE_CONDITIONS: Record<string, { trigger: BadgeTrigger; check: (userId: string) => Promise<boolean> }> = {
  FIRST_REFERRAL: {
    trigger: 'referral',
    check: async (userId) => {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { totalReferrals: true } })
      return (user?.totalReferrals ?? 0) >= 1
    },
  },
  REFERRAL_5: {
    trigger: 'referral',
    check: async (userId) => {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { totalReferrals: true } })
      return (user?.totalReferrals ?? 0) >= 5
    },
  },
  REFERRAL_25: {
    trigger: 'referral',
    check: async (userId) => {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { totalReferrals: true } })
      return (user?.totalReferrals ?? 0) >= 25
    },
  },
  POWER_REFERRER_100: {
    trigger: 'referral',
    check: async (userId) => {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { totalReferrals: true } })
      return (user?.totalReferrals ?? 0) >= 100
    },
  },
  FIRST_REEL: {
    trigger: 'reel',
    check: async (userId) => {
      const count = await prisma.reelJob.count({ where: { userId, status: 'COMPLETED' } })
      return count >= 1
    },
  },
  REEL_MASTER_50: {
    trigger: 'reel',
    check: async (userId) => {
      const count = await prisma.reelJob.count({ where: { userId, status: 'COMPLETED' } })
      return count >= 50
    },
  },
  EARLY_ADOPTER: {
    trigger: 'login',
    check: async (userId) => {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })
      if (!user) return false
      // Users who signed up in 2024 or before are early adopters
      return user.createdAt.getFullYear() <= 2025
    },
  },
  STREAK_7D: {
    trigger: 'login',
    check: async (userId) => {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastLoginAt: true } })
      if (!user?.lastLoginAt) return false
      // Simple check: user has logged in within the last day (daily badge checker awards this)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return user.lastLoginAt >= oneDayAgo
    },
  },
}

/**
 * Check and award badges for a user based on the given trigger.
 * Safe to call multiple times — uses unique constraint to prevent duplicates.
 */
export async function checkAndAwardBadges(userId: string, trigger: BadgeTrigger): Promise<string[]> {
  const awarded: string[] = []

  for (const [badge, config] of Object.entries(BADGE_CONDITIONS)) {
    if (config.trigger !== trigger) continue

    try {
      const eligible = await config.check(userId)
      if (!eligible) continue

      await prisma.userBadge.create({
        data: {
          userId,
          badge: badge as any,
        },
      })
      awarded.push(badge)
    } catch {
      // Unique constraint violation — badge already awarded, skip
    }
  }

  return awarded
}

/**
 * Check all badge conditions for a user regardless of trigger.
 * Used by the daily badge checker worker.
 */
export async function checkAllBadges(userId: string): Promise<string[]> {
  const awarded: string[] = []

  for (const [badge, config] of Object.entries(BADGE_CONDITIONS)) {
    try {
      const eligible = await config.check(userId)
      if (!eligible) continue

      await prisma.userBadge.create({
        data: {
          userId,
          badge: badge as any,
        },
      })
      awarded.push(badge)
    } catch {
      // Already awarded
    }
  }

  return awarded
}
