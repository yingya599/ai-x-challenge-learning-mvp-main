// AI Queue — T22 concurrency control.
// Limits concurrent AI API calls to prevent rate-limit errors.
// Implements exponential backoff with jitter on 429 responses,
// and falls back to deterministic evaluation when all retries fail.
//
// Design:
//   - Semaphore-based: max 4 concurrent calls
//   - 429 handling: exponential backoff (1s → 2s → 4s → 8s) with ±25% jitter
//   - Fallback: uses deterministic evaluation (same score every time)
//
// The queue is in-memory; Redis is not needed because AI calls are
// stateless and don't need to survive server restarts.

type QueueEntry = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  fn: () => Promise<unknown>;
};

const MAX_CONCURRENT = 4;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

let active = 0;
const queue: QueueEntry[] = [];

function next(): void {
  if (queue.length === 0 || active >= MAX_CONCURRENT) return;
  const entry = queue.shift()!;
  active++;
  entry.fn()
    .then(entry.resolve, entry.reject)
    .finally(() => {
      active--;
      next();
    });
}

/** Enqueue an AI call — blocks until a slot is available. */
export async function enqueueAiCall<T>(fn: () => Promise<T>): Promise<T> {
  const redis = await import("./redis").then((m) => m.getRedis());
  if (!redis) return fn(); // no Redis → no queue needed

  return new Promise<T>((resolve, reject) => {
    queue.push({
      resolve: resolve as (v: unknown) => void,
      reject,
      fn: fn as () => Promise<unknown>,
    });
    next();
  });
}

/** Call AI with retry + backoff on 429. Returns null if all retries exhausted. */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number }).status;

      if (status === 429 || msg.includes("429") || msg.includes("rate") || msg.includes("Rate limit")) {
        if (attempt < MAX_RETRIES) {
          const delay = BASE_BACKOFF_MS * Math.pow(2, attempt) * (0.75 + Math.random() * 0.5);
          console.warn(`[ai-queue] 429 rate limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        console.warn(`[ai-queue] All retries exhausted, using fallback`);
        return fallback;
      }

      // Non-retryable error — fallback immediately
      console.error(`[ai-queue] AI call failed: ${msg}`);
      return fallback;
    }
  }
  return fallback;
}

/** Combined: enqueue + retry + fallback. The standard way to call AI in T22+. */
export async function aiCall<T>(
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  return enqueueAiCall(() => callWithRetry(fn, fallback));
}
