// Bus Adapter — P3 T1: transport-agnostic message bus (ADR-001, §5.0).
// Abstracts over Redis Stream (current) and Hermes/OpenClaw (future).
// The bus constraint (§5.0) is enforced here: agent channels MUST use publish(),
// never bypass the bus to write business tables directly.
//
// AGENT_CN.md §8.1: Every message must carry routing metadata + protocol marking.
// The bus adapter stamps protocol and origin hop in publish() so business code
// never hardcodes protocol values. Forward/deliver hops are added by the consumer.
//
// ⚠️  NOTE: stamped envelopes carry extra `protocol` + `route` fields that are
// NOT in Team3's MessageEnvelopeSchema (.strict()). Never re-parse a consumed
// envelope with MessageEnvelopeSchema — it will throw. Strip protocol/route
// first, or use JSON.parse + RoutingExtensionSchema for the routing part.
//
// Usage:
//   import { busAdapter } from "./bus-adapter";
//   await busAdapter.publish(envelope);
import type { MessageEnvelope } from "../schemas/zod-from-schemas";
import { getRedis } from "./redis";

// ---- Abstract interface ----

export interface BusAdapter {
  /** Protocol identifier (e.g. 'redis-stream/v1', 'hermes-acp/v1'). */
  readonly protocolId: string;

  /** Publish an envelope to the bus. Returns the message ID. */
  publish(envelope: MessageEnvelope): Promise<string | null>;

  /** Start consuming from the bus. Calls handler for each message. */
  subscribe(
    group: string,
    consumer: string,
    handler: (envelope: MessageEnvelope, id: string) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<void>;

  /** True if the bus is available. */
  isAvailable(): boolean;
}

// ---- Route stamping helper (§8.1) ----

function stampRoute(envelope: MessageEnvelope, protocolId: string): MessageEnvelope {
  const now = new Date().toISOString();
  const existing = (envelope as Record<string, unknown>);

  const originHop = {
    agent_id: envelope.from_agent,
    action: "origin",
    protocol: protocolId,
    ts: now,
  };

  const existingRoute = existing["route"] as Array<unknown> | undefined;
  const route = existingRoute ? [...existingRoute, originHop] : [originHop];

  return {
    ...envelope,
    protocol: protocolId,
    route,
  } as MessageEnvelope;
}

// ---- Redis Stream adapter ----

class RedisBusAdapter implements BusAdapter {
  readonly protocolId = "redis-stream/v1";
  private readonly STREAM = "nseap:messages";
  private readonly MAX_LEN = 10_000;

  isAvailable(): boolean {
    return getRedis() !== null;  // getRedis() now checks status === "ready"
  }

  async publish(envelope: MessageEnvelope): Promise<string | null> {
    const redis = getRedis();
    console.log("[bus:redis] publish called, redis available:", !!redis);
    if (!redis) return null;

    // AGENT_CN.md §8.1: stamp protocol + origin hop before serializing
    const stamped = stampRoute(envelope, this.protocolId);

    return redis.xadd(
      this.STREAM, "MAXLEN", "~", this.MAX_LEN, "*",
      "envelope", JSON.stringify(stamped),
    );
  }

  async subscribe(
    group: string,
    consumer: string,
    handler: (envelope: MessageEnvelope, id: string) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<void> {
    // Wait for Redis to be ready before entering the consume loop.
    // getRedis() returns null if the client is still connecting or unavailable;
    // this retries every second until Redis is ready or signal is aborted.
    let redis = getRedis();
    while (!redis && !signal?.aborted) {
      await new Promise((r) => setTimeout(r, 1000));
      redis = getRedis();
    }
    if (!redis) return; // signal aborted

    // Ensure consumer group exists
    try {
      await redis.xgroup("CREATE", this.STREAM, group, "0", "MKSTREAM");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("BUSYGROUP")) throw err;
    }

    // Claim stale pending messages
    await this.claimPending(redis, group, consumer, handler);

    // Main read loop
    while (!signal?.aborted) {
      try {
        const results = await redis.xreadgroup(
          "GROUP", group, consumer,
          "COUNT", 5, "BLOCK", 5000,
          "STREAMS", this.STREAM, ">",
        ) as [string, Array<[string, string[]]>][] | null;

        if (!results) continue;
        for (const [, messages] of results) {
          for (const [id, fields] of messages) {
            const idx = fields.indexOf("envelope");
            if (idx < 0) continue;
            const envStr = fields[idx + 1];
            try {
              const envelope = JSON.parse(envStr) as MessageEnvelope;
              await handler(envelope, id);
              await redis.xack(this.STREAM, group, id);
            } catch (err) {
              console.error(`[bus:redis] Handler error ${id}:`, err);
              // Check if should move to dead letter
              const pending = await redis.xpending(this.STREAM, group, id, id, 1) as Array<[string, string, number, number]> | null;
              if (pending?.[0]?.[3] && pending[0][3] >= 3) {
                await redis.xadd("nseap:dead-letter", "*",
                  "envelope", envStr,
                  "error", err instanceof Error ? err.message : String(err),
                  "original_id", id,
                );
                await redis.xack(this.STREAM, group, id);
                console.error(`[bus:redis] DEAD LETTER: ${id}`);
              }
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Connection") || msg.includes("ECONNREFUSED")) {
          await new Promise((r) => setTimeout(r, 5000));
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  private async claimPending(
    redis: NonNullable<ReturnType<typeof getRedis>>,
    group: string,
    consumer: string,
    handler: (envelope: MessageEnvelope, id: string) => Promise<void>,
  ): Promise<void> {
    try {
      const pending = await redis.xpending(this.STREAM, group, "-", "+", 100) as Array<{ id: string; milliseconds_elapsed: number }> | null;
      if (!pending) return;

      for (const entry of pending) {
        if (entry.milliseconds_elapsed < 30_000) continue;
        const claimed = await redis.xclaim(
          this.STREAM, group, consumer, 30_000, entry.id, "JUSTID",
        ) as string[] | null;

        if (claimed?.length) {
          const msgs = await redis.xrange(this.STREAM, entry.id, entry.id) as [string, string[]][];
          for (const [, fields] of msgs) {
            const idx = fields.indexOf("envelope");
            if (idx < 0) continue;
            const envelope = JSON.parse(fields[idx + 1]) as MessageEnvelope;
            await handler(envelope, entry.id);
            await redis.xack(this.STREAM, group, entry.id);
          }
        }
      }
    } catch (err) {
      console.error("[bus:redis] Claim error:", err);
    }
  }
}

// ---- NSEAP/OpenClaw stub adapter (P3) ----

class NseapBusAdapter implements BusAdapter {
  readonly protocolId = "nseap-acp/v1";
  private _available = false;

  isAvailable(): boolean {
    return this._available;
  }

  async publish(envelope: MessageEnvelope): Promise<string | null> {
    // TODO: NSEAP/OpenClaw SDK integration
    console.log("[bus:nseap] publish (stub):", envelope.message_type);
    return null;
  }

  async subscribe(
    _group: string,
    _consumer: string,
    _handler: (envelope: MessageEnvelope, id: string) => Promise<void>,
    _signal?: AbortSignal,
  ): Promise<void> {
    console.log("[bus:nseap] subscribe (stub)");
  }
}

// ---- Singleton adapter (selects based on config) ----

let _adapter: BusAdapter | null = null;

export function getBusAdapter(): BusAdapter {
  if (_adapter) return _adapter;

  if (process.env.NSEAP_BUS_URL || process.env.HERMES_BUS_URL) {
    console.log("[bus] Using NSEAP/OpenClaw bus (stub)");
    _adapter = new NseapBusAdapter();
  } else {
    console.log("[bus] Using Redis Stream bus");
    _adapter = new RedisBusAdapter();
  }

  return _adapter;
}

// Convenience: lazy singleton — cache the adapter
let _cachedAdapter: BusAdapter | null = null;

function getAdapter(): BusAdapter {
  if (!_cachedAdapter) _cachedAdapter = getBusAdapter();
  return _cachedAdapter;
}

export const busAdapter: BusAdapter = {
  get protocolId() { return getAdapter().protocolId; },
  publish: (envelope) => getAdapter().publish(envelope),
  subscribe: (group, consumer, handler, signal) => getAdapter().subscribe(group, consumer, handler, signal),
  isAvailable: () => getAdapter().isAvailable(),
};
