// GET /api/submissions/[id] — Get single submission detail (T10)
import { NextResponse } from "next/server";
import { getSubmissionById, getEvaluationsBySubmission, getStudentById } from "@/lib/server/feishu";
import { getPrincipal, getStudentId } from "@/lib/server/principal";
import { selectEffectiveTeacherEvaluation } from "@/lib/server/evaluation-policy";
import { isMentor } from "@/lib/server/rbac";
import { getInternRows } from "@/lib/server/task-platform";

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
    // Submission 与其评价没有前后依赖，并行读取可少等待一次飞书网络往返。
    // 评价只读取已经保存的结果，不会在打开详情时重新调用 AI。
    const [submission, evaluations] = await Promise.all([
      getSubmissionById(id),
      getEvaluationsBySubmission(id),
    ]);
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
    if (!submission.student_name) {
      const student = await getStudentById(submission.student_id);
      submission.student_name = student?.name || submission.student_id;
    }
    if (!studentId && (isMentor(principal) || principal.role === "ta")) {
      const visibleIds = new Set((await getInternRows(principal)).map((student) => student.student_id));
      if (!visibleIds.has(submission.student_id)) {
        return NextResponse.json({ ok: false, error: "该提交不在你的负责范围内" }, { status: 403 });
      }
    }

    // Display the persisted AI + mentor reviews.
    const aiEval = evaluations.find(e => e.evaluator_type === "ai");
    const teacherEval = selectEffectiveTeacherEvaluation(evaluations);

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
