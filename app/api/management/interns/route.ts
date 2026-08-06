import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { canAccessManagement } from "@/lib/server/rbac";
import { getInternRows } from "@/lib/server/task-platform";

export async function GET() {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!canAccessManagement(principal)) return NextResponse.json({ ok: false, error: "无权查看实习生列表" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, interns: await getInternRows(principal) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "实习生列表加载失败" }, { status: 500 });
  }
}
