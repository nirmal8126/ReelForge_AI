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
