import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getRedis } from "@/lib/server/redis";
import { publishEnvelope } from "@/lib/server/redis-stream";
import { writeAdminAudit } from "@/lib/server/admin-audit";
import type { MessageEnvelope } from "@/lib/schemas/zod-from-schemas";

function toObject(values: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < values.length; i += 2) out[values[i]] = values[i + 1];
  return out;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return NextResponse.json({ ok: true, degraded: true, dead_letters: [], stream: {} });
  const [dead, length, groups] = await Promise.all([
    redis.xrevrange("nseap:dead-letter", "+", "-", "COUNT", 100),
    redis.xlen("nseap:messages"),
    redis.xinfo("GROUPS", "nseap:messages").catch(() => []),
  ]);
  return NextResponse.json({
    ok: true, stream: { length, groups },
    dead_letters: dead.map(([id, values]) => ({ id, ...toObject(values) })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin({ recentAuth: true });
  if (!auth.ok) return auth.response;
  const { id, action, reason, request_id } = await request.json();
  if (!id || !["replay", "ignore"].includes(action) || !reason) return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return NextResponse.json({ ok: false, error: "Redis 不可用" }, { status: 503 });
  const rows = await redis.xrange("nseap:dead-letter", id, id);
  if (!rows.length) return NextResponse.json({ ok: false, error: "死信不存在" }, { status: 404 });
  const lock = `nseap:dead-letter:handled:${id}`;
  if (!(await redis.set(lock, action, "EX", 86400 * 30, "NX"))) return NextResponse.json({ ok: false, error: "该死信已处理" }, { status: 409 });
  const data = toObject(rows[0][1]);
  if (action === "replay") await publishEnvelope(JSON.parse(data.envelope) as MessageEnvelope);
  await writeAdminAudit(auth.principal, { action: `dead_letter.${action}`, target: id, reason, result: "success", request_id });
  return NextResponse.json({ ok: true });
}
