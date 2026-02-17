import { prisma } from '@reelforge/db'

type SequenceTrigger = 'SIGNUP' | 'INACTIVITY_7D' | 'INACTIVITY_30D' | 'PLAN_EXPIRY' | 'FIRST_REEL' | 'UPGRADE'

/**
 * Enroll a user in all active sequences matching the given trigger.
 * Uses upsert-like behavior (catches unique constraint errors) to prevent double-enrollment.
 */
export async function enrollInSequences(trigger: SequenceTrigger, userId: string) {
  try {
    const sequences = await prisma.emailSequence.findMany({
      where: {
        trigger: trigger as any,
        isActive: true,
      },
      include: {
        steps: { orderBy: { stepOrder: 'asc' }, take: 1 },
      },
    })

    if (sequences.length === 0) return

    const now = new Date()

    for (const seq of sequences) {
      try {
        const firstStepDelay = seq.steps[0]?.delayDays ?? 0
        const nextSendAt = new Date(now.getTime() + firstStepDelay * 24 * 60 * 60 * 1000)

        await prisma.sequenceEnrollment.create({
          data: {
            sequenceId: seq.id,
            userId,
            currentStep: 0,
            status: 'ACTIVE',
            nextSendAt,
          },
        })
      } catch {
        // Unique constraint violation — user already enrolled, skip
      }
    }
  } catch (err) {
    console.error('Failed to enroll in sequences:', err)
  }
}
