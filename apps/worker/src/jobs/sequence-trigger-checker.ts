import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';

/**
 * 6-hourly job: check for users matching INACTIVITY_7D, INACTIVITY_30D, PLAN_EXPIRY triggers
 * and enroll them in matching active sequences.
 */
export async function checkSequenceTriggers(_job: Job) {
  const now = new Date();
  let enrolled = 0;

  // Get all active sequences with auto-triggers
  const sequences = await prisma.emailSequence.findMany({
    where: {
      isActive: true,
      trigger: { in: ['INACTIVITY_7D', 'INACTIVITY_30D', 'PLAN_EXPIRY'] },
    },
    include: {
      steps: { orderBy: { stepOrder: 'asc' }, take: 1 },
    },
  });

  if (sequences.length === 0) {
    logger.debug('No auto-trigger sequences active');
    return { enrolled: 0 };
  }

  for (const seq of sequences) {
    try {
      if (seq.trigger === 'INACTIVITY_7D' || seq.trigger === 'INACTIVITY_30D') {
        const daysAgo = seq.trigger === 'INACTIVITY_7D' ? 7 : 30;
        const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

        // Find users inactive since cutoff
        const inactiveUsers = await prisma.user.findMany({
          where: {
            lastLoginAt: { lt: cutoff },
            email: { not: undefined },
          },
          select: { id: true },
          take: 200,
        });

        for (const user of inactiveUsers) {
          try {
            await prisma.sequenceEnrollment.create({
              data: {
                sequenceId: seq.id,
                userId: user.id,
                currentStep: 0,
                status: 'ACTIVE',
                nextSendAt: seq.steps[0]
                  ? new Date(now.getTime() + seq.steps[0].delayDays * 24 * 60 * 60 * 1000)
                  : now,
              },
            });
            enrolled++;
          } catch {
            // Unique constraint — user already enrolled in this sequence
          }
        }
      }

      if (seq.trigger === 'PLAN_EXPIRY') {
        // Find users whose subscription ends within 3 days
        const expiryWindow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const expiringUsers = await prisma.user.findMany({
          where: {
            subscription: { currentPeriodEnd: { lte: expiryWindow, gte: now } },
            email: { not: undefined },
          },
          select: { id: true },
          take: 200,
        });

        for (const user of expiringUsers) {
          try {
            await prisma.sequenceEnrollment.create({
              data: {
                sequenceId: seq.id,
                userId: user.id,
                currentStep: 0,
                status: 'ACTIVE',
                nextSendAt: seq.steps[0]
                  ? new Date(now.getTime() + seq.steps[0].delayDays * 24 * 60 * 60 * 1000)
                  : now,
              },
            });
            enrolled++;
          } catch {
            // Already enrolled
          }
        }
      }
    } catch (err) {
      logger.error({ err, sequenceId: seq.id }, 'Error checking trigger for sequence');
    }
  }

  logger.info({ enrolled, sequencesChecked: sequences.length }, 'Trigger checker completed');
  return { enrolled };
}
