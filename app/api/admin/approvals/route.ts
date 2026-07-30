import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getRedis } from "@/lib/server/redis";
import { handleMessage } from "@/lib/server/message-handler";
import { writeAdminAudit } from "@/lib/server/admin-audit";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return NextResponse.json({ ok: true, items: [], degraded: true });
  const rows = await redis.hgetall("nseap:approvals:pending");
  return NextResponse.json({ ok: true, items: Object.values(rows).map((row) => JSON.parse(row)) });
}

export async function POST(request: Request) {
  const auth = await requireAdmin({ recentAuth: true });
  if (!auth.ok) return auth.response;
  const { message_id, decision, reason, request_id } = await request.json();
  if (!message_id || !["approve", "reject"].includes(decision) || !reason) {
    return NextResponse.json({ ok: false, error: "缺少消息、决定或原因" }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return NextResponse.json({ ok: false, error: "审批存储不可用" }, { status: 503 });
  const raw = await redis.hget("nseap:approvals:pending", message_id);
  if (!raw) return NextResponse.json({ ok: false, error: "审批请求不存在或已过期" }, { status: 404 });
  const dedupe = `nseap:approval:decision:${message_id}`;
  if (!(await redis.set(dedupe, decision, "EX", 86400 * 30, "NX"))) {
    return NextResponse.json({ ok: false, error: "该请求已处理" }, { status: 409 });
  }
  const item = JSON.parse(raw);
  if (decision === "approve") {
    await redis.set(`nseap:approval:approved:${message_id}`, "1", "EX", 300);
    await handleMessage(item.envelope);
  } else {
    await redis.hdel("nseap:approvals:pending", message_id);
  }
  await writeAdminAudit(auth.principal, { action: `approval.${decision}`, target: message_id, reason, result: "success", request_id });
  return NextResponse.json({ ok: true });
}
