import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { notifyStudent } from "@/lib/server/notify";
import { writeAdminAudit } from "@/lib/server/admin-audit";

export async function POST(request: Request) {
  const auth = await requireAdmin({ recentAuth: true });
  if (!auth.ok) return auth.response;
  const { student_id, text, reason, request_id } = await request.json();
  if (!student_id || !text || !reason) return NextResponse.json({ ok: false, error: "学生、消息和原因均为必填" }, { status: 400 });
  const result = await notifyStudent(student_id, text);
  await writeAdminAudit(auth.principal, { action: "notification.test", target: student_id, reason, result: result.ok ? "success" : "failed", request_id });
  return NextResponse.json({ ok: result.ok, result }, { status: result.ok ? 200 : 502 });
}
