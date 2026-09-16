/**
 * Rate limiter — Redis si disponible, Map en mémoire sinon.
 * Utilisé par le MCP Server et les API sensibles.
 */

const buckets = new Map<string, number[]>()

interface RedisLike {
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<unknown>
}

let redisClient: RedisLike | null = null
let redisTried = false

export function setRedisClient(client: RedisLike | null) {
  redisClient = client
  redisTried = true
}

export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number = 60_000,
): Promise<{ allowed: boolean; remaining: number }> {
  if (redisClient) {
    try {
      const redisKey = `companion:rl:${key}:${Math.floor(Date.now() / windowMs)}`
      const count = await redisClient.incr(redisKey)
      await redisClient.expire(redisKey, Math.ceil(windowMs / 1000))
      return { allowed: count <= max, remaining: Math.max(0, max - count) }
    } catch {
      // Redis indisponible → fallback mémoire
    }
  }
  return memoryRateLimit(key, max, windowMs)
}

function memoryRateLimit(key: string, max: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const bucket = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (bucket.length >= max) {
    buckets.set(key, bucket)
    return { allowed: false, remaining: 0 }
  }
  bucket.push(now)
  buckets.set(key, bucket)
  return { allowed: true, remaining: max - bucket.length }
}
