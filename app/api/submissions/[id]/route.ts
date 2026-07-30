// GET /api/submissions/[id] — Get single submission detail (T10)
import { NextResponse } from "next/server";
import { getSubmissionById, getEvaluationsBySubmission } from "@/lib/server/feishu";
import { getPrincipal, getStudentId } from "@/lib/server/principal";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await getPrincipal();
    if (!principal) {
      return NextResponse.json(
        { ok: false, error: "请先登录" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json(
        { ok: false, error: "提交不存在" },
        { status: 404 },
      );
    }

    // Row-level: student (webapp or agent) can see own submissions,
    // or ones they were assigned to peer-review (P2).
    const studentId = getStudentId(principal);
    let peerReview: { assigned: boolean; completed: boolean } | undefined;
    if (studentId && submission.student_id !== studentId) {
      const evaluations = await getEvaluationsBySubmission(id);
      const mine = evaluations.filter(
        (e) => e.evaluator_type === "peer" && e.evaluator_id === studentId,
      );
      if (mine.length === 0) {
        return NextResponse.json(
          { ok: false, error: "无权查看此提交" },
          { status: 403 },
        );
      }
      peerReview = { assigned: true, completed: mine.some((e) => !!e.feedback) };
    }

    // Fetch evaluations for display (AI + teacher reviews)
    const evaluations = await getEvaluationsBySubmission(id);
    const aiEval = evaluations.find(e => e.evaluator_type === "ai");
    const teacherEval = evaluations.find(e => e.evaluator_type === "teacher");

    return NextResponse.json({ 
      ok: true, 
      submission, 
      peer_review: peerReview,
      evaluation: aiEval || null,
      teacher_evaluation: teacherEval || null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load submission" },
      { status: 500 },
    );
  }
}
