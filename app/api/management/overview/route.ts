import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { canAccessManagement } from "@/lib/server/rbac";
import { getManagementOverview } from "@/lib/server/task-platform";

export async function GET() {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!canAccessManagement(principal)) return NextResponse.json({ ok: false, error: "无权访问管理工作台" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, overview: await getManagementOverview(principal) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "工作台加载失败" }, { status: 500 });
  }
}
