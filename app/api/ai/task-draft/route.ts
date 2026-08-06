import { NextResponse } from "next/server";
import { generateTaskDraft } from "@/lib/server/ai";
import { getPrincipal } from "@/lib/server/principal";
import { canAccessManagement, isLeader, isMentor } from "@/lib/server/rbac";

export async function POST(request: Request) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!canAccessManagement(principal) || (!isLeader(principal) && !isMentor(principal))) {
    return NextResponse.json({ ok: false, error: "只有领导或带教可以整理任务草稿" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const brief = String(body.brief || "").trim();
    if (brief.length < 10) return NextResponse.json({ ok: false, error: "请至少用 10 个字描述任务" }, { status: 400 });
    if (brief.length > 6000) return NextResponse.json({ ok: false, error: "任务描述暂不能超过 6000 字" }, { status: 400 });
    const draft = await generateTaskDraft({
      brief,
      categoryTitle: body.category_title ? String(body.category_title) : undefined,
      jobDirection: body.job_direction ? String(body.job_direction) : undefined,
      allowExternalAi: body.allow_external_ai === true,
    });
    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "任务整理失败" }, { status: 500 });
  }
}
