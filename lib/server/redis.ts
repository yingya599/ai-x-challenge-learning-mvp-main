// Redis client — used by health check (T18), cache (T22), Stream (T19).
// Falls back gracefully when REDIS_URL is not configured.
// BUGFIX: Connection failures no longer permanently disable Redis.
// A transient failure (network blip, Redis restart) will be retried on the
// next getRedis() call after the reconnection backoff window expires.
import Redis from "ioredis";

let _redis: Redis | null = null;
let _redisUnavailable = false;
let _redisFailedAt = 0;
const REDIS_RETRY_WINDOW_MS = 30_000; // retry connection after 30s

export function getRedis(): Redis | null {
  if (_redis && _redis.status === "ready") return _redis;
  if (_redis) {
    // Terminal state ("end": retryStrategy gave up, no more reconnects) —
    // dispose the dead client so the cool-down/recreate path below can run.
    // Don't rely on the error event having fired; make recovery explicit.
    if (_redis.status === "end") {
      try { _redis.disconnect(); } catch { /* already dead */ }
      _redis = null;
      // fall through to cool-down check / recreation
    } else {
      // Not connected yet (connecting/reconnecting/wait) —
      // treat as unavailable so callers gracefully fall back.
      return null;
    }
  }

  // BUGFIX: Don't permanently disable Redis. After a cool-down window,
  // allow reconnection attempts so transient failures self-heal.
  if (_redisUnavailable) {
    if (Date.now() - _redisFailedAt < REDIS_RETRY_WINDOW_MS) return null;
    // Cool-down expired — allow retry
    _redisUnavailable = false;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    _redisUnavailable = true;
    _redisFailedAt = Date.now();
    return null;
  }

  try {
    _redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      // Requests can arrive during the brief initial "connecting" state.
      // Queue them until Redis emits "ready" so the first request is reliable.
      enableOfflineQueue: true,
      connectTimeout: 3_000,       // 3s cap on connection attempts
      retryStrategy(times) {
        if (times > 10) {
          _redisUnavailable = true;
          _redisFailedAt = Date.now();
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
    });

    _redis.on("error", () => {
      // Disconnect the dead client before dropping the reference — otherwise
      // its background reconnect loop keeps running (client/fd leak, one per
      // failed request burst). disconnect() may emit one more error; the ?.
      // and try/catch make re-entry harmless (_redis is already null then).
      try { _redis?.disconnect(); } catch { /* noop */ }
      _redis = null;
      // Short cool-down (3s) so a request burst doesn't spawn a fresh client
      // per request while Redis is down. The full 30s window is reserved for
      // retryStrategy giving up (it overwrites _redisFailedAt with Date.now()).
      if (!_redisUnavailable) {
        _redisUnavailable = true;
        _redisFailedAt = Date.now() - REDIS_RETRY_WINDOW_MS + 3_000;
      }
    });

    return _redis;
  } catch {
    _redisUnavailable = true;
    _redisFailedAt = Date.now();
    return null;
  }
}

export async function redisPing(): Promise<{ ok: boolean; ms?: number; error?: string }> {
  const redis = getRedis();
  if (!redis) return { ok: false, error: "Redis not available" };
  try {
    const start = Date.now();
    const result = await redis.ping();
    return { ok: result === "PONG", ms: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
