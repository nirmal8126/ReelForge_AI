import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { sendSequenceEmail } from '../services/email-sender';
import { logger } from '../utils/logger';

/**
 * Hourly job: find all ACTIVE enrollments whose nextSendAt <= now,
 * send the current step email, advance to next step or complete.
 */
export async function processSequenceEmails(_job: Job) {
  const now = new Date();

  const dueEnrollments = await prisma.sequenceEnrollment.findMany({
    where: {
      status: 'ACTIVE',
      nextSendAt: { lte: now },
    },
    include: {
      sequence: {
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
        },
      },
    },
    take: 100,
  });

  if (dueEnrollments.length === 0) {
    logger.debug('No due sequence enrollments found');
    return { processed: 0 };
  }

  let processed = 0;
  let errors = 0;

  for (const enrollment of dueEnrollments) {
    try {
      const { sequence } = enrollment;
      if (!sequence.isActive) {
        // Sequence was deactivated — skip
        continue;
      }

      const steps = sequence.steps;
      const currentStep = steps[enrollment.currentStep];

      if (!currentStep) {
        // No more steps — mark complete
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'COMPLETED', completedAt: now, nextSendAt: null },
        });
        continue;
      }

      // Get user email
      const user = await prisma.user.findUnique({
        where: { id: enrollment.userId },
        select: { email: true, name: true },
      });

      if (!user?.email) {
        logger.warn({ userId: enrollment.userId }, 'Enrollment user not found or no email');
        continue;
      }

      // Send email
      const sent = await sendSequenceEmail(user.email, currentStep.subject, currentStep.body);

      if (sent) {
        const nextStepIndex = enrollment.currentStep + 1;
        const nextStep = steps[nextStepIndex];

        if (nextStep) {
          // Advance to next step
          const nextSendAt = new Date(now.getTime() + nextStep.delayDays * 24 * 60 * 60 * 1000);
          await prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: { currentStep: nextStepIndex, nextSendAt },
          });
        } else {
          // Last step — mark completed
          await prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: { status: 'COMPLETED', completedAt: now, nextSendAt: null },
          });
        }

        processed++;
      } else {
        errors++;
      }
    } catch (err) {
      logger.error({ err, enrollmentId: enrollment.id }, 'Error processing enrollment');
      errors++;
    }
  }

  logger.info({ processed, errors, total: dueEnrollments.length }, 'Sequence processor completed');
  return { processed, errors };
}
