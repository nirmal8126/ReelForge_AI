import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function getJobStatusColor(status: string): string {
  const colors: Record<string, string> = {
    COMPLETED: 'text-green-400',
    FAILED: 'text-red-400',
    PROCESSING: 'text-yellow-400',
    QUEUED: 'text-gray-400',
    // Long-form pipeline stages
    PLANNING: 'text-blue-400',
    SCRIPT_GENERATING: 'text-yellow-400',
    VOICE_GENERATING: 'text-yellow-400',
    VIDEO_GENERATING: 'text-yellow-400',
    COMPOSING: 'text-yellow-400',
    UPLOADING: 'text-yellow-400',
    PUBLISHING: 'text-purple-400',
    RECOMPOSING: 'text-brand-400',
    // Cartoon pipeline stages
    STORY_GENERATING: 'text-blue-400',
    IMAGE_GENERATING: 'text-purple-400',
  }
  return colors[status] || 'text-gray-400'
}

export function getJobStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    QUEUED: 'Queued',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    // Long-form pipeline stages
    PLANNING: 'Planning Outline',
    SCRIPT_GENERATING: 'Generating Script',
    VOICE_GENERATING: 'Generating Voiceover',
    VIDEO_GENERATING: 'Generating Video',
    COMPOSING: 'Composing Video',
    UPLOADING: 'Uploading',
    PUBLISHING: 'Publishing to YouTube',
    RECOMPOSING: 'Applying Edits',
    // Cartoon pipeline stages
    STORY_GENERATING: 'Writing Story',
    IMAGE_GENERATING: 'Generating Images',
  }
  return labels[status] || status
}

export function getPlanLimits(plan: string) {
  const limits: Record<string, { jobsLimit: number; profilesLimit: number; price: number }> = {
    FREE: { jobsLimit: 3, profilesLimit: 0, price: 0 },
    STARTER: { jobsLimit: 25, profilesLimit: 1, price: 1900 },
    PRO: { jobsLimit: 75, profilesLimit: 5, price: 4900 },
    BUSINESS: { jobsLimit: 200, profilesLimit: -1, price: 9900 },
    ENTERPRISE: { jobsLimit: -1, profilesLimit: -1, price: 0 },
  }
  return limits[plan] || limits.FREE
}
