import { NextResponse } from "next/server";
import { generateInternAssessment } from "@/lib/server/ai";
import { getPrincipal } from "@/lib/server/principal";
import { canAccessManagement } from "@/lib/server/rbac";
import { getInternDetail } from "@/lib/server/task-platform";

export async function POST(request: Request) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!canAccessManagement(principal)) {
    return NextResponse.json({ ok: false, error: "无权查看实习生评估" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const studentId = String(body.student_id || "").trim();
    if (!studentId) return NextResponse.json({ ok: false, error: "缺少 student_id" }, { status: 400 });
    const detail = await getInternDetail(principal, studentId);
    if (!detail) return NextResponse.json({ ok: false, error: "实习生不存在或不在你的负责范围内" }, { status: 404 });
    const assessment = await generateInternAssessment({
      ruleBased: detail.capability.ai_assessment,
      allowExternalAi: body.allow_external_ai === true,
    });
    return NextResponse.json({
      ok: true,
      assessment,
      mode: "rule_based",
      message: "当前返回确定性规则评估。后续接入 AI 时，沿用此数据结构，并在 lib/server/ai.ts 中替换评估生成器。",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "实习生评估生成失败" }, { status: 500 });
  }
}
