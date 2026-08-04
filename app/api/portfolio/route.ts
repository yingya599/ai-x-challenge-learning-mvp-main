import { NextResponse } from "next/server";
import { getEvaluations, getPortfolioItems, type EvaluationRecord } from "@/lib/server/feishu";
import { getPrincipal } from "@/lib/server/principal";
import { isStaff } from "@/lib/server/rbac";
import { selectEffectiveTeacherEvaluation } from "@/lib/server/evaluation-policy";

export async function GET() {
  const principal = await getPrincipal();
  if (!principal) {
    return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  }

  try {
    const [items, evaluations] = await Promise.all([
      getPortfolioItems(),
      getEvaluations(),
    ]);

    // Public items: visible to all logged-in users
    // Non-public items: only visible to staff
    // NOTE: PortfolioItem uses `is_public` field (boolean, from Feishu)
    const visible = items.filter(
      (item) => item.is_public === true || isStaff(principal),
    );

    const evaluationsFor = (
      submissionId: string | undefined,
      evaluatorType: "ai" | "teacher",
    ): EvaluationRecord[] => {
      if (!submissionId) return [];
      return evaluations
        .filter(
          (evaluation) =>
            evaluation.submission_id === submissionId &&
            evaluation.evaluator_type === evaluatorType,
        );
    };

    const enriched = visible.map((item) => {
      const aiEvaluation = evaluationsFor(item.submission_id, "ai")
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
      const teacherEvaluation = selectEffectiveTeacherEvaluation(
        evaluationsFor(item.submission_id, "teacher"),
      );
      return {
        ...item,
        ai_score: aiEvaluation?.score_total,
        teacher_score: teacherEvaluation?.score_total,
      };
    });

    return NextResponse.json({ ok: true, items: enriched });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load portfolio" },
      { status: 500 },
    );
  }
}
