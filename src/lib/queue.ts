import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: IORedis | undefined
}

export function getRedisConnection(): IORedis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    })
  }
  return globalForRedis.redis
}

const globalForQueue = globalThis as unknown as {
  ocrQueue: Queue | undefined
}

export const ocrQueue: Queue =
  globalForQueue.ocrQueue ??
  new Queue('ocr-processing', {
    connection: getRedisConnection() as never,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.ocrQueue = ocrQueue
}
