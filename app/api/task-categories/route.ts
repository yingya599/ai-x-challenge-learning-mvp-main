import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { canAccessManagement, isLeader } from "@/lib/server/rbac";
import { createTaskCategory } from "@/lib/server/feishu";
import { getTaskCategoriesView } from "@/lib/server/task-platform";

export async function GET() {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  try {
    const categories = await getTaskCategoriesView(principal);
    return NextResponse.json({ ok: true, categories });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "任务类别加载失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!canAccessManagement(principal) || !isLeader(principal)) {
    return NextResponse.json({ ok: false, error: "只有领导可以管理任务类别" }, { status: 403 });
  }
  try {
    const body = await request.json();
    if (!body.title || !["business_analysis", "data_analysis", "quant"].includes(body.job_direction)) {
      return NextResponse.json({ ok: false, error: "请填写类别名称和有效岗位方向" }, { status: 400 });
    }
    const result = await createTaskCategory({ ...body, created_by: principal.person, status: body.status || "active" });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "任务类别创建失败" }, { status: 500 });
  }
}
