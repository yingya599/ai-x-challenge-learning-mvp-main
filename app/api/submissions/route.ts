// GET /api/submissions — List submissions with row-level permissions (T10)
import { NextResponse } from "next/server";
import { getEvaluations, getStudents, getSubmissions } from "@/lib/server/feishu";
import { getPrincipal, getStudentId } from "@/lib/server/principal";
import { isLeader, isMentor } from "@/lib/server/rbac";
import { getInternRows } from "@/lib/server/task-platform";

export async function GET() {
  try {
    const principal = await getPrincipal();
    if (!principal) {
      return NextResponse.json(
        { ok: false, error: "请先登录" },
        { status: 401 },
      );
    }

    // Row-level permission: student (webapp or agent channel) sees only own submissions
    const studentId = getStudentId(principal);
    const filter = studentId ? { studentId } : undefined;

    const [loadedSubmissions, students, evaluations] = await Promise.all([
      getSubmissions(filter),
      getStudents(),
      getEvaluations(),
    ]);
    let submissions = loadedSubmissions;
    if (isMentor(principal) || principal.role === "ta") {
      const visibleIds = new Set((await getInternRows(principal)).map((student) => student.student_id));
      submissions = submissions.filter((submission) => visibleIds.has(submission.student_id));
    } else if (!studentId && !isLeader(principal) && principal.role !== "admin") {
      submissions = [];
    }
    const studentNames = new Map(students.map((student) => [student.student_id, student.name]));
    const aiScores = new Map(evaluations
      .filter((evaluation) => evaluation.evaluator_type === "ai")
      .map((evaluation) => [evaluation.submission_id, evaluation.score_total]));
    submissions = submissions.map((submission) => ({
      ...submission,
      student_name: submission.student_name || studentNames.get(submission.student_id) || submission.student_id,
      score_total: aiScores.get(submission.submission_id) ?? submission.score_total ?? 0,
    }));
    return NextResponse.json({ ok: true, submissions });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load submissions" },
      { status: 500 },
    );
  }
}
