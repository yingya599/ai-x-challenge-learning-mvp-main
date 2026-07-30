// Redis Stream message bus — T19 (§3.4 of whitepaper)
// Replaces in-memory envelope passing with Redis Stream consumer groups.
import { getRedis } from "./redis";
import type { MessageEnvelope } from "../schemas/zod-from-schemas";

const STREAM = "nseap:messages";
const MAX_STREAM_LEN = 10_000;

// ---- Publish ----

export async function publishEnvelope(envelope: MessageEnvelope): Promise<string | null> {
  const redis = getRedis();
  if (!redis) {
    console.warn("[stream] Redis unavailable — envelope not published");
    return null;
  }
  const id = await redis.xadd(
    STREAM, "MAXLEN", "~", MAX_STREAM_LEN, "*",
    "envelope", JSON.stringify(envelope),
  );
  console.log(`[stream] Published ${envelope.message_type} → ${id}`);
  return id;
}

// ---- Consumer group ----

async function ensureGroup(redis: ReturnType<typeof getRedis>, group: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.xgroup("CREATE", STREAM, group, "0", "MKSTREAM");
    console.log(`[stream] Created consumer group: ${group}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("BUSYGROUP")) throw err;
  }
}

// ---- Consumer ----

export type MessageHandler = (envelope: MessageEnvelope, streamId: string) => Promise<void>;

const DEAD_LETTER = "nseap:dead-letter";
const MAX_RETRIES = 3;

/** Move a failing message to the dead letter queue and ACK it. */
async function moveToDeadLetter(
  redis: ReturnType<typeof getRedis>,
  group: string,
  messageId: string,
  envelope: MessageEnvelope,
  error: string,
): Promise<void> {
  if (!redis) return;
  await redis.xadd(DEAD_LETTER, "*",
    "envelope", JSON.stringify(envelope),
    "error", error,
    "original_id", messageId,
    "moved_at", new Date().toISOString(),
  );
  await redis.xack(STREAM, group, messageId);
  console.error(`[stream] DEAD LETTER: ${messageId} (${envelope.message_type}): ${error}`);
}

export async function startConsumer(
  group: string,
  consumerName: string,
  handler: MessageHandler,
  signal?: AbortSignal,
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    console.warn("[stream] Redis unavailable — consumer not started");
    return;
  }
  await ensureGroup(redis, group);
  console.log(`[stream] Consumer started: ${consumerName} (group=${group})`);
  await claimPending(redis, group, consumerName, handler);

  while (!signal?.aborted) {
    try {
      const results = await redis.xreadgroup(
        "GROUP", group, consumerName,
        "COUNT", 5, "BLOCK", 5000,
        "STREAMS", STREAM, ">",
      ) as [string, Array<[string, string[]]>][] | null;

      if (!results) continue;
      for (const [, messages] of results) {
        for (const [id, fields] of messages) {
          const idx = fields.indexOf("envelope");
          if (idx < 0) continue;
          const envelopeStr = fields[idx + 1];
          try {
            const envelope = JSON.parse(envelopeStr) as MessageEnvelope;
            await handler(envelope, id);
            await redis.xack(STREAM, group, id);
            console.log(`[stream] ACK ${id}`);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[stream] Handler error for ${id}:`, errMsg);

            // P2: Check retry count — move to dead letter after MAX_RETRIES
            const pendingInfo = await redis.xpending(STREAM, group, id, id, 1) as Array<[string, string, number, number]> | null;
            const timesDelivered = pendingInfo?.[0]?.[3] ?? 0;
            if (timesDelivered >= MAX_RETRIES) {
              const envelope = JSON.parse(envelopeStr) as MessageEnvelope;
              await moveToDeadLetter(redis, group, id, envelope, errMsg);
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Connection") || msg.includes("ECONNREFUSED")) {
        console.error("[stream] Redis connection lost, retrying in 5s...");
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        console.error("[stream] Consumer error:", msg);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}

// ---- Pending recovery ----

const PENDING_IDLE_MS = 30_000;

export async function claimPending(
  redis: ReturnType<typeof getRedis>,
  group: string,
  consumerName: string,
  handler: MessageHandler,
): Promise<number> {
  if (!redis) return 0;
  try {
    const pending = await redis.xpending(STREAM, group, "-", "+", 100) as Array<{ id: string; milliseconds_elapsed: number }> | null;
    if (!pending) return 0;

    let claimed = 0;
    for (const entry of pending) {
      if (entry.milliseconds_elapsed < PENDING_IDLE_MS) continue;
      const claimedIds = await redis.xclaim(
        STREAM, group, consumerName,
        PENDING_IDLE_MS, entry.id, "JUSTID",
      ) as string[] | null;

      if (claimedIds && claimedIds.length > 0) {
        const msgs = await redis.xrange(STREAM, entry.id, entry.id) as [string, string[]][];
        for (const [, fields] of msgs) {
          const idx = fields.indexOf("envelope");
          if (idx < 0) continue;
          const envelopeStr = fields[idx + 1];
          try {
            const envelope = JSON.parse(envelopeStr) as MessageEnvelope;
            await handler(envelope, entry.id);
            await redis.xack(STREAM, group, entry.id);
            claimed++;
            console.log(`[stream] Claimed + ACK ${entry.id}`);
          } catch (err) {
            console.error(`[stream] Claim handler error:`, err);
          }
        }
      }
    }
    return claimed;
  } catch (err) {
    console.error("[stream] Claim error:", err);
    return 0;
  }
}
