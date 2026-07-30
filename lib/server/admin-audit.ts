import { getRedis } from "./redis";
import type { ServicePrincipal } from "./principal";

export interface AdminAuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  reason: string;
  result: "success" | "failed";
  request_id?: string;
}

const KEY = "nseap:admin:audit";

export async function writeAdminAudit(
  principal: ServicePrincipal,
  event: Omit<AdminAuditEvent, "id" | "at" | "actor">,
) {
  const redis = getRedis();
  const item: AdminAuditEvent = {
    ...event, id: crypto.randomUUID(), at: new Date().toISOString(), actor: principal.person,
  };
  if (redis?.status === "ready") {
    await redis.lpush(KEY, JSON.stringify(item));
    await redis.ltrim(KEY, 0, 4999);
  }
  console.info("[admin-audit]", JSON.stringify({ ...item, reason: item.reason.slice(0, 200) }));
  return item;
}

export async function listAdminAudit(limit = 200): Promise<AdminAuditEvent[]> {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return [];
  const rows = await redis.lrange(KEY, 0, Math.min(limit, 500) - 1);
  return rows.map((row) => JSON.parse(row) as AdminAuditEvent);
}
