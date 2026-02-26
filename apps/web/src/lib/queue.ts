import { Queue } from 'bullmq'
import IORedis from 'ioredis'

let connection: IORedis | null = null

function getConnection() {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    })
  }
  return connection
}

let reelQueue: Queue | null = null

export function getReelQueue() {
  if (!reelQueue) {
    reelQueue = new Queue('reel-jobs', { connection: getConnection() })
  }
  return reelQueue
}

const PLAN_PRIORITY: Record<string, number> = {
  ENTERPRISE: 1,
  BUSINESS: 2,
  PRO: 3,
  STARTER: 4,
  FREE: 5,
}

export async function enqueueReelJob(data: {
  reelJobId: string
  userId: string
  prompt: string
  script?: string
  style?: string
  language?: string
  voiceId?: string
  durationSeconds: number
  aspectRatio: string
  channelProfileId?: string
  plan: string
}) {
  const queue = getReelQueue()
  const priority = PLAN_PRIORITY[data.plan] || 5

  const job = await queue.add('generate-reel', data, {
    priority,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  })

  return job.id
}

// Long-form video queue
let longFormQueue: Queue | null = null

export function getLongFormQueue() {
  if (!longFormQueue) {
    longFormQueue = new Queue('long-form-jobs', { connection: getConnection() })
  }
  return longFormQueue
}

export async function enqueueLongFormRecompose(data: {
  longFormJobId: string
  userId: string
  aspectRatio: string
  voiceId?: string
  language?: string
  plan: string
}) {
  const queue = getLongFormQueue()
  const priority = PLAN_PRIORITY[data.plan] || 5

  const job = await queue.add('generate-long-form', {
    ...data,
    recomposeOnly: true,
    // Provide required fields with defaults (won't be used in recompose mode)
    prompt: '',
    title: '',
    durationMinutes: 0,
    aiClipRatio: 0,
    useStockFootage: false,
    useStaticVisuals: false,
    publishToYouTube: false,
  }, {
    priority,
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 250 },
  })

  return job.id
}

export async function enqueueLongFormJob(data: {
  longFormJobId: string
  userId: string
  prompt: string
  title: string
  durationMinutes: number
  style?: string
  language?: string
  voiceId?: string
  aspectRatio: string
  aiClipRatio: number
  useStockFootage: boolean
  useStaticVisuals: boolean
  publishToYouTube: boolean
  channelProfileId?: string
  plan: string
}) {
  const queue = getLongFormQueue()
  const priority = PLAN_PRIORITY[data.plan] || 5

  const job = await queue.add('generate-long-form', data, {
    priority,
    attempts: 2, // Fewer retries due to longer jobs
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 250 },
  })

  return job.id
}

// Cartoon episode queue
let cartoonQueue: Queue | null = null

export function getCartoonQueue() {
  if (!cartoonQueue) {
    cartoonQueue = new Queue('cartoon-episode-jobs', { connection: getConnection() })
  }
  return cartoonQueue
}

export async function enqueueCartoonEpisode(data: {
  episodeId: string
  seriesId: string
  userId: string
  prompt: string
  title: string
  language: string
  aspectRatio: string
  narratorVoiceId?: string
  plan: string
}) {
  const queue = getCartoonQueue()
  const priority = PLAN_PRIORITY[data.plan] || 5

  const job = await queue.add('generate-cartoon-episode', data, {
    priority,
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 250 },
  })

  return job.id
}

// Quote jobs queue
let quoteQueue: Queue | null = null

export function getQuoteQueue() {
  if (!quoteQueue) {
    quoteQueue = new Queue('quote-jobs', { connection: getConnection() })
  }
  return quoteQueue
}

export async function enqueueQuoteJob(data: {
  quoteJobId: string
  userId: string
  prompt: string
  category: string
  language: string
  plan: string
}) {
  const queue = getQuoteQueue()
  const priority = PLAN_PRIORITY[data.plan] || 5

  const job = await queue.add('generate-quote', data, {
    priority,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  })

  return job.id
}

// Challenge / Game Reels queue
let challengeQueue: Queue | null = null

export function getChallengeQueue() {
  if (!challengeQueue) {
    challengeQueue = new Queue('challenge-jobs', { connection: getConnection() })
  }
  return challengeQueue
}

export async function enqueueChallengeJob(data: {
  challengeJobId: string
  userId: string
  challengeType: string
  category: string
  difficulty: string
  numQuestions: number
  timerSeconds: number
  language: string
  prompt?: string
  templateStyle: string
  voiceEnabled: boolean
  voiceId?: string
  plan: string
}) {
  const queue = getChallengeQueue()
  const priority = PLAN_PRIORITY[data.plan] || 5

  const job = await queue.add('generate-challenge', data, {
    priority,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  })

  return job.id
}

// 3D Gameplay queue
let gameplayQueue: Queue | null = null

export function getGameplayQueue() {
  if (!gameplayQueue) {
    gameplayQueue = new Queue('gameplay-jobs', { connection: getConnection() })
  }
  return gameplayQueue
}

export async function enqueueGameplayJob(data: {
  gameplayJobId: string
  userId: string
  template: string
  theme: string
  difficulty: string
  duration: number
  aspectRatio: string
  musicStyle: string
  gameTitle?: string
  showScore: boolean
  ctaText?: string
  plan: string
}) {
  const queue = getGameplayQueue()
  const priority = PLAN_PRIORITY[data.plan] || 5

  const job = await queue.add('generate-gameplay', data, {
    priority,
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 250 },
  })

  return job.id
}

// Image Studio queue
let imageStudioQueue: Queue | null = null

export function getImageStudioQueue() {
  if (!imageStudioQueue) {
    imageStudioQueue = new Queue('image-studio-jobs', { connection: getConnection() })
  }
  return imageStudioQueue
}

export async function enqueueImageStudioJob(data: {
  imageStudioJobId: string
  userId: string
  mode: string
  imageUrls: string[]
  prompt?: string
  title?: string
  language?: string
  voiceEnabled: boolean
  voiceId?: string
  aspectRatio: string
  transitionStyle: string
  plan: string
}) {
  const queue = getImageStudioQueue()
  const priority = PLAN_PRIORITY[data.plan] || 5

  const job = await queue.add('generate-image-studio', data, {
    priority,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  })

  return job.id
}
