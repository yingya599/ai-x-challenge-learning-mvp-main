// Redis read cache — T22 (§5.3 of whitepaper).
// Wraps Feishu read operations with Redis caching. Cache is ephemeral;
// Feishu Bitable is always the source of truth (决策一). On cache miss,
// reads from Feishu and populates Redis.
import { getRedis } from "./redis";

const CACHE_PREFIX = "cache:";
const DEFAULT_TTL = 300; // 5 minutes

function cacheKey(namespace: string, key: string): string {
  return `${CACHE_PREFIX}${namespace}:${key}`;
}

/**
 * Get from cache or compute + store. If Redis is unavailable, computes
 * directly (no caching).
 */
export async function cacheGet<T>(
  namespace: string,
  key: string,
  compute: () => Promise<T>,
  ttl = DEFAULT_TTL,
): Promise<T> {
  const redis = getRedis();
  if (!redis) return compute();

  const ck = cacheKey(namespace, key);
  try {
    const cached = await redis.get(ck);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Cache read failed — fall through to compute
  }

  const value = await compute();

  try {
    await redis.setex(ck, ttl, JSON.stringify(value));
  } catch {
    // Cache write failed — non-fatal
  }

  return value;
}

/**
 * Invalidate cache entries for a namespace. Use after writes to Feishu
 * to ensure read-your-writes consistency.
 */
export async function cacheInvalidate(namespace: string, key?: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    if (key) {
      await redis.del(cacheKey(namespace, key));
    } else {
      // Delete all keys in namespace
      const keys = await redis.keys(`${CACHE_PREFIX}${namespace}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch {
    // Non-fatal
  }
}

// ---- Pre-built cache wrappers for common entities ----

export const studentCache = {
  get: (studentId: string, compute: () => Promise<unknown>) =>
    cacheGet("student", studentId, compute, 600), // 10 min — students rarely change
  invalidate: (studentId: string) =>
    cacheInvalidate("student", studentId),
};

export const challengeCache = {
  get: (challengeId: string, compute: () => Promise<unknown>) =>
    cacheGet("challenge", challengeId, compute, 300),
  invalidate: (challengeId: string) =>
    cacheInvalidate("challenge", challengeId),
};

export const submissionCache = {
  get: (submissionId: string, compute: () => Promise<unknown>) =>
    cacheGet("submission", submissionId, compute, 120), // 2 min — submissions change
  invalidate: (submissionId: string) =>
    cacheInvalidate("submission", submissionId),
};
