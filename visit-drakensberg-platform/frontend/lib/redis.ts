const REDIS_URL = process.env.REDIS_URL
const REDIS_TOKEN = process.env.REDIS_TOKEN

// Thin Redis wrapper using the native REST API (Upstash-compatible).
// Falls back to a no-op when REDIS_URL is not configured so the app
// runs locally without Redis.
//
// The Authorization header was missing until the September 2026 audit (finding
// L6): Upstash rejects an unauthenticated REST call, and the catch below
// swallowed the failure, so every cache call in the app silently returned null
// and the cache had never actually worked. REDIS_TOKEN has been in
// .env.example and in the backend's own client all along.

/** True when a real Redis is configured, so callers can pick a fallback. */
export function isRedisConfigured(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN)
}

export async function redisCommand(command: string, ...args: (string | number)[]) {
  if (!REDIS_URL) return null
  try {
    const res = await fetch(`${REDIS_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(REDIS_TOKEN ? { Authorization: `Bearer ${REDIS_TOKEN}` } : {}),
      },
      body: JSON.stringify([command, ...args]),
    })
    if (!res.ok) {
      // Logged rather than swallowed: a 401 here is a misconfiguration that
      // used to be invisible, and a rate limiter built on this must know.
      console.error('[redis] command failed:', command, res.status)
      return null
    }
    const json = await res.json()
    return json.result ?? null
  } catch (e) {
    console.error('[redis] unreachable:', e instanceof Error ? e.message : e)
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
