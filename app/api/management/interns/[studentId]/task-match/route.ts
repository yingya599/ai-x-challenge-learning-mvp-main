import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { canAccessManagement, isMentor } from "@/lib/server/rbac";
import { getInternTaskMatch } from "@/lib/server/task-platform";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!canAccessManagement(principal) || !isMentor(principal)) {
    return NextResponse.json({ ok: false, error: "任务匹配度暂只对带教开放" }, { status: 403 });
  }

  try {
    const { studentId } = await params;
    const body = await request.json();
    const categoryId = body.category_id ? String(body.category_id) : undefined;
    const title = body.title ? String(body.title).trim() : "";
    const description = body.description ? String(body.description).trim() : "";
    if (!categoryId && !title && description.length < 10) {
      return NextResponse.json({ ok: false, error: "请先选择任务模板或填写至少 10 个字的任务描述" }, { status: 400 });
    }
    if (description.length > 6000) {
      return NextResponse.json({ ok: false, error: "任务描述暂不能超过 6000 字" }, { status: 400 });
    }
    const match = await getInternTaskMatch(principal, studentId, {
      category_id: categoryId,
      title,
      description,
      job_direction: body.job_direction
        ? String(body.job_direction) as "business_analysis" | "data_analysis" | "quant"
        : undefined,
      competency_ids: Array.isArray(body.competency_ids) ? body.competency_ids.map(String) : undefined,
    });
    if (!match) return NextResponse.json({ ok: false, error: "实习生不存在或不在你的负责范围内" }, { status: 404 });
    return NextResponse.json({ ok: true, match });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "任务匹配计算失败" }, { status: 500 });
  }
}
