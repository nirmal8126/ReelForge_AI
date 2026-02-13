// Shared configuration for the ReelForge AI platform

export const APP_NAME = 'ReelForge AI'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
export const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'

export const PLAN_CONFIG = {
  FREE: { name: 'Free', price: 0, jobsLimit: 3, profilesLimit: 0 },
  STARTER: { name: 'Starter', price: 1900, jobsLimit: 25, profilesLimit: 1 },
  PRO: { name: 'Pro', price: 4900, jobsLimit: 75, profilesLimit: 5 },
  BUSINESS: { name: 'Business', price: 9900, jobsLimit: 200, profilesLimit: -1 },
  ENTERPRISE: { name: 'Enterprise', price: 0, jobsLimit: -1, profilesLimit: -1 },
} as const

export const REFERRAL_TIERS = {
  FREE: { credits: 5, cashPercent: 0 },
  AFFILIATE: { credits: 10, cashPercent: 30 },
  PARTNER: { credits: 20, cashPercent: 40, recurringPercent: 10 },
} as const

export const AI_COSTS = {
  scriptGeneration: 0.002,    // Claude API per script
  voiceover30s: 0.020,        // ElevenLabs per 30s
  video30s1080p: 0.40,        // RunwayML per 30s
  totalPerReel: 0.42,         // Minimum cost per reel
} as const
