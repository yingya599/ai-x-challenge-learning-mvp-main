// Unified message handler — T19 handle_message (§3.4 of whitepaper)
// + P2 rate limiting + require-approval check.
import type { MessageEnvelope } from "../schemas/zod-from-schemas";
import {
  SUBMISSION_TASK_AGENT,
  REVIEW_TASK_AGENT,
  isTrusted,
} from "./agents";
import { checkTrust, agentToSP, needsApproval } from "./service-principal";
import { getRedis } from "./redis";
import { RoutingExtensionSchema } from "../schemas/envelope-v2.schema";

type HandlerFn = (envelope: MessageEnvelope) => Promise<void>;

const handlers = new Map<string, HandlerFn>();

export function registerHandler(messageType: string, handler: HandlerFn): void {
  handlers.set(messageType, handler);
  console.log(`[handler] Registered: ${messageType}`);
}

// ---- P2: Rate limiting (§3.2) ----

const ROLE_RATE_LIMITS: Record<string, number> = {
  admin: 2000,
  teacher: 1000,
  ta: 800,
  system: 1000,
  agent: 500,
  judge: 300,
  observer: 200,
  student: 100,
};

async function checkRateLimit(sp: { person: string; role: string }): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;

  const hour = new Date().toISOString().slice(0, 13);
  const key = `ratelimit:${sp.person}:${hour}`;

  // BUGFIX: Use MULTI/EXEC for atomic INCR + EXPIRE to prevent
  // key from never expiring if process crashes between the two calls.
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 3600);

  const limit = ROLE_RATE_LIMITS[sp.role] ?? 100;
  return count <= limit;
}

// ---- Main entry point ----

/** Append a route hop to the envelope (AGENT_CN.md §8.1).
 *  Called by the consumer before/after handler dispatch. */
export function appendRouteHop(
  envelope: MessageEnvelope,
  action: "forward" | "deliver",
): MessageEnvelope {
  const existing = envelope as Record<string, unknown>;
  const route = (existing["route"] as Array<Record<string, unknown>>) || [];
  const protocol = (existing["protocol"] as string) || "unknown";

  // Prevent runaway loops
  if (route.length >= 20) {
    console.warn(`[handler] Route hop limit reached for ${envelope.message_id}`);
    return envelope;
  }

  const stamped = {
    ...envelope,
    route: [
      ...route,
      {
        agent_id: envelope.to_agent,
        action,
        protocol,
        ts: new Date().toISOString(),
      },
    ],
  } as MessageEnvelope;

  // Validate route structure (non-blocking)
  const routeCheck = RoutingExtensionSchema.safeParse({
    protocol,
    route: stamped["route" as keyof typeof stamped] || (stamped as Record<string, unknown>)["route"],
  });
  if (!routeCheck.success) {
    console.warn("[handler] Route schema violation:", routeCheck.error.message);
  }

  return stamped;
}

export async function handleMessage(envelope: MessageEnvelope): Promise<void> {
  // T21: Service Principal trust check
  const fromSP = agentToSP(envelope.from_agent);
  const toSP = agentToSP(envelope.to_agent);

  if (fromSP && toSP) {
    const trust = checkTrust(fromSP, toSP, envelope.message_type);
    if (!trust.allowed) {
      console.warn(`[handler] Untrusted: ${envelope.from_agent} → ${envelope.to_agent}: ${trust.reason}`);
      return;
    }

    // P2: Rate limiting
    const withinLimit = await checkRateLimit(fromSP);
    if (!withinLimit) {
      console.warn(`[handler] Rate limited: ${fromSP.person}`);
      return;
    }

    // P2: require-approval — log and continue (full flow in P3 admin UI)
    if (needsApproval(fromSP, toSP)) {
      const { getRedis } = await import("./redis");
      const redis = getRedis();
      const approvedKey = `nseap:approval:approved:${envelope.message_id}`;
      const approved = redis?.status === "ready" ? await redis.get(approvedKey) : null;
      if (!approved) {
        if (!redis || redis.status !== "ready") {
          throw new Error("Approval storage unavailable; refusing to execute");
        }
        await redis.hset("nseap:approvals:pending", envelope.message_id, JSON.stringify({
          envelope, status: "pending_approval", created_at: new Date().toISOString(),
        }));
        return;
      }
      const approvalRedis = redis!;
      await approvalRedis.del(approvedKey);
      await approvalRedis.hdel("nseap:approvals:pending", envelope.message_id);
      console.log(`[handler] Approval required: ${fromSP.person} → ${toSP.person} (${envelope.message_type})`);
    }
  } else {
    if (!isTrusted(envelope.from_agent, envelope.to_agent)) {
      console.warn(`[handler] Untrusted (v1): ${envelope.from_agent} → ${envelope.to_agent}`);
      return;
    }
  }

  const handler = handlers.get(envelope.message_type);
  if (!handler) {
    console.warn(`[handler] No handler: ${envelope.message_type}`);
    return;
  }

  console.log(`[handler] Dispatching ${envelope.message_type} (${envelope.from_agent} → ${envelope.to_agent})`);

  try {
    await handler(envelope);
  } catch (err) {
    console.error(`[handler] Error: ${envelope.message_type}:`, err instanceof Error ? err.message : err);
    throw err; // re-throw → consumer doesn't ACK → pending redelivery
  }
}
