const REDIS_URL = process.env.REDIS_URL

// Thin Redis wrapper using the native REST API (Upstash-compatible).
// Falls back to a no-op when REDIS_URL is not configured so the app
// runs locally without Redis.

async function redisCommand(command: string, ...args: (string | number)[]) {
  if (!REDIS_URL) return null
  try {
    const res = await fetch(`${REDIS_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([command, ...args]),
    })
    const json = await res.json()
    return json.result ?? null
  } catch {
    return null
  }
}

export const redis = {
  async get(key: string): Promise<string | null> {
    return redisCommand('GET', key) as Promise<string | null>
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await redisCommand('SET', key, value, 'EX', ttlSeconds)
    } else {
      await redisCommand('SET', key, value)
    }
  },

  async del(key: string): Promise<void> {
    await redisCommand('DEL', key)
  },

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await redis.get(key)
    if (!raw) return null
    try { return JSON.parse(raw) as T } catch { return null }
  },

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await redis.set(key, JSON.stringify(value), ttlSeconds)
  },
}

// Cache key helpers
export const cacheKeys = {
  searchResults: (query: string, filters: string) => `search:${query}:${filters}`,
  recommendations: (userId: string, region: string) => `recs:${userId}:${region}`,
  listingDetail: (id: string) => `listing:${id}`,
  homepageContent: () => 'homepage:content',
  session: (userId: string) => `session:${userId}`,
}

// TTLs in seconds
export const TTL = {
  SEARCH: 60 * 5,         // 5 minutes
  RECOMMENDATIONS: 60 * 30, // 30 minutes
  LISTING: 60 * 10,       // 10 minutes
  HOMEPAGE: 60 * 60,      // 1 hour
  SESSION: 60 * 60 * 24,  // 24 hours
}
