import { Job } from 'bullmq'
import { prisma } from '@reelforge/db'
import { logger } from '../utils/logger'

/**
 * Daily badge checker job.
 * Scans users and awards badges they've become eligible for.
 */
export async function processBadgeChecker(job: Job) {
  const startTime = Date.now()
  let totalAwarded = 0

  // Process in batches to avoid memory issues
  const batchSize = 100
  let skip = 0
  let hasMore = true

  while (hasMore) {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        totalReferrals: true,
        lastLoginAt: true,
        createdAt: true,
      },
      skip,
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    })

    if (users.length < batchSize) hasMore = false
    skip += batchSize

    for (const user of users) {
      try {
        // Check referral badges
        const referralBadges: Array<{ threshold: number; badge: string }> = [
          { threshold: 1, badge: 'FIRST_REFERRAL' },
          { threshold: 5, badge: 'REFERRAL_5' },
          { threshold: 25, badge: 'REFERRAL_25' },
          { threshold: 100, badge: 'POWER_REFERRER_100' },
        ]

        for (const { threshold, badge } of referralBadges) {
          if (user.totalReferrals >= threshold) {
            try {
              await prisma.userBadge.create({
                data: { userId: user.id, badge: badge as any },
              })
              totalAwarded++
              logger.debug({ userId: user.id, badge }, 'Badge awarded')
            } catch {
              // Already has badge
            }
          }
        }

        // Check EARLY_ADOPTER (users who signed up in 2025 or before)
        if (user.createdAt.getFullYear() <= 2025) {
          try {
            await prisma.userBadge.create({
              data: { userId: user.id, badge: 'EARLY_ADOPTER' },
            })
            totalAwarded++
          } catch {}
        }

        // Check reel-based badges
        const completedReels = await prisma.reelJob.count({
          where: { userId: user.id, status: 'COMPLETED' },
        })

        if (completedReels >= 1) {
          try {
            await prisma.userBadge.create({
              data: { userId: user.id, badge: 'FIRST_REEL' },
            })
            totalAwarded++
          } catch {}
        }

        if (completedReels >= 50) {
          try {
            await prisma.userBadge.create({
              data: { userId: user.id, badge: 'REEL_MASTER_50' },
            })
            totalAwarded++
          } catch {}
        }

        // Check STREAK_7D — user has logged in within the last day
        // (This is a simplified check — full streak tracking would need a login history table)
        if (user.lastLoginAt) {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          if (user.lastLoginAt >= oneDayAgo) {
            try {
              await prisma.userBadge.create({
                data: { userId: user.id, badge: 'STREAK_7D' },
              })
              totalAwarded++
            } catch {}
          }
        }
      } catch (err) {
        logger.error({ userId: user.id, err }, 'Error checking badges for user')
      }
    }
  }

  const duration = Date.now() - startTime
  logger.info({ totalAwarded, duration: `${duration}ms` }, 'Badge checker completed')

  return { totalAwarded, duration }
}
