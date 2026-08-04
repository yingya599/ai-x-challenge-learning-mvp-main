import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { canAccessManagement } from "@/lib/server/rbac";
import { getInternDetail } from "@/lib/server/task-platform";

export async function GET(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!canAccessManagement(principal)) return NextResponse.json({ ok: false, error: "无权查看实习生详情" }, { status: 403 });
  try {
    const { studentId } = await params;
    const detail = await getInternDetail(principal, studentId);
    if (!detail) return NextResponse.json({ ok: false, error: "实习生不存在或不在你的负责范围内" }, { status: 404 });
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "实习生详情加载失败" }, { status: 500 });
  }
}
