import Redis from 'ioredis'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    })
    redis.on('error', () => {}) // Suppress connection errors
  }
  return redis
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
}

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const r = getRedis()
    const now = Math.floor(Date.now() / 1000)
    const windowStart = now - windowSeconds
    const redisKey = `rl:${key}`

    const pipeline = r.pipeline()
    pipeline.zremrangebyscore(redisKey, 0, windowStart)
    pipeline.zadd(redisKey, now.toString(), `${now}:${Math.random()}`)
    pipeline.zcard(redisKey)
    pipeline.expire(redisKey, windowSeconds)

    const results = await pipeline.exec()
    const count = (results?.[2]?.[1] as number) ?? 0

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
    }
  } catch {
    // If Redis is down, allow the request (fail open)
    return { allowed: true, remaining: maxRequests }
  }
}
