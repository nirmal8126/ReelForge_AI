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
