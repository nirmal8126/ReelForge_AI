import { prisma } from '@reelforge/db'

// ---------------------------------------------------------------------------
// Module IDs — must match what's stored in module_configs table
// ---------------------------------------------------------------------------

export const MODULE_IDS = {
  REELS: 'reels',
  QUOTES: 'quotes',
  CHALLENGES: 'challenges',
  LONG_FORM: 'long_form',
  CARTOON_STUDIO: 'cartoon_studio',
  GAMEPLAY: 'gameplay',
  IMAGE_STUDIO: 'image_studio',
} as const

export type ModuleId = (typeof MODULE_IDS)[keyof typeof MODULE_IDS]

// ---------------------------------------------------------------------------
// Default configs (used to seed DB if row doesn't exist)
// ---------------------------------------------------------------------------

const MODULE_DEFAULTS: Record<string, { name: string; isFree: boolean; creditCost: number }> = {
  reels:          { name: 'My Reels',        isFree: false, creditCost: 1 },
  quotes:         { name: 'Quotes',          isFree: false, creditCost: 1 },
  challenges:     { name: 'Challenges',      isFree: false, creditCost: 1 },
  long_form:      { name: 'My Videos',       isFree: false, creditCost: 3 },
  cartoon_studio: { name: 'Cartoon Studio',  isFree: false, creditCost: 2 },
  gameplay:       { name: '3D Gameplay',     isFree: false, creditCost: 2 },
  image_studio:   { name: 'Image Studio',   isFree: false, creditCost: 2 },
}

// ---------------------------------------------------------------------------
// Get module config (auto-seeds if not in DB yet)
// ---------------------------------------------------------------------------

export interface ModulePricing {
  isFree: boolean
  creditCost: number
  isEnabled: boolean
  moduleName: string
}

export async function getModulePricing(moduleId: string): Promise<ModulePricing> {
  let config = await prisma.moduleConfig.findUnique({
    where: { moduleId },
  })

  // Auto-seed if not found
  if (!config) {
    const defaults = MODULE_DEFAULTS[moduleId]
    if (!defaults) {
      return { isFree: false, creditCost: 1, isEnabled: true, moduleName: moduleId }
    }
    config = await prisma.moduleConfig.create({
      data: {
        moduleId,
        moduleName: defaults.name,
        isFree: defaults.isFree,
        creditCost: defaults.creditCost,
        isEnabled: true,
      },
    })
  }

  return {
    isFree: config.isFree,
    creditCost: config.creditCost,
    isEnabled: config.isEnabled,
    moduleName: config.moduleName,
  }
}

// ---------------------------------------------------------------------------
// Get all enabled module IDs (for sidebar / page guards)
// ---------------------------------------------------------------------------

export async function getEnabledModules(): Promise<string[]> {
  const configs = await prisma.moduleConfig.findMany({
    where: { isEnabled: true },
    select: { moduleId: true },
  })
  return configs.map((c) => c.moduleId)
}

export async function isModuleEnabled(moduleId: string): Promise<boolean> {
  const pricing = await getModulePricing(moduleId)
  return pricing.isEnabled
}

// ---------------------------------------------------------------------------
// Credit check helper — shared across all job creation API routes
// ---------------------------------------------------------------------------

type CreditCheckResult = {
  ok: true
  creditsCost: number
  subscription: { plan: string }
} | {
  ok: false
  error: string
  status: number
}

export async function checkModuleCredits(
  userId: string,
  moduleId: string,
  overrideCost?: number,
): Promise<CreditCheckResult> {
  const pricing = await getModulePricing(moduleId)

  if (!pricing.isEnabled) {
    return { ok: false, error: 'This module is currently disabled.', status: 403 }
  }

  const creditCost = overrideCost ?? pricing.creditCost

  // Free module — skip all credit/quota checks
  if (pricing.isFree) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    })
    return { ok: true, creditsCost: 0, subscription: { plan: subscription?.plan || 'FREE' } }
  }

  // Paid module — check subscription + credits
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  })

  if (!subscription) {
    return { ok: false, error: 'No active subscription found.', status: 403 }
  }

  const hasUnlimitedJobs = subscription.jobsLimit === -1
  const hasQuota = hasUnlimitedJobs || subscription.jobsUsed < subscription.jobsLimit

  if (hasQuota) {
    // Use quota — increment jobs used
    await prisma.subscription.update({
      where: { userId },
      data: { jobsUsed: { increment: 1 } },
    })
    return { ok: true, creditsCost: 0, subscription: { plan: subscription.plan } }
  }

  // Over quota — check credits
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  })

  if (!user || user.creditsBalance < creditCost) {
    return {
      ok: false,
      error: `Monthly quota exceeded. Need ${creditCost} credit${creditCost > 1 ? 's' : ''}, have ${user?.creditsBalance || 0}.`,
      status: 403,
    }
  }

  // Deduct credits
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { creditsBalance: { decrement: creditCost } },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount: -creditCost,
        type: 'JOB_DEBIT',
        description: `${pricing.moduleName} generation (over quota)`,
        balanceAfter: user.creditsBalance - creditCost,
      },
    }),
  ])

  return { ok: true, creditsCost: creditCost, subscription: { plan: subscription.plan } }
}
