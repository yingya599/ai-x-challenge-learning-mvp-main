import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getAllStudents, getTeachers, getAdmins, getAllChallenges, getSubmissions, getEvaluations } from "@/lib/server/feishu";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const [students, teachers, admins, challenges, submissions, evaluations] = await Promise.all([
    getAllStudents(), getTeachers(), getAdmins(), getAllChallenges(), getSubmissions(), getEvaluations(),
  ]);
  const studentIds = new Set(students.map((x) => x.student_id));
  const challengeIds = new Set(challenges.map((x) => x.challenge_id));
  const submissionIds = new Set(submissions.map((x) => x.submission_id));
  const issues = [
    ...students.filter((x) => x.status !== "inactive" && !x.feishu_open_id).map((x) => ({ type: "missing_open_id", resource: x.student_id, severity: "warning" })),
    ...submissions.filter((x) => !studentIds.has(x.student_id)).map((x) => ({ type: "orphan_submission_student", resource: x.submission_id, severity: "error" })),
    ...submissions.filter((x) => !challengeIds.has(x.challenge_id)).map((x) => ({ type: "orphan_submission_challenge", resource: x.submission_id, severity: "error" })),
    ...evaluations.filter((x) => !submissionIds.has(x.submission_id)).map((x) => ({ type: "orphan_evaluation", resource: x.evaluation_id, severity: "error" })),
  ];
  return NextResponse.json({
    ok: true, scanned_at: new Date().toISOString(), issues,
    totals: { students: students.length, teachers: teachers.length, admins: admins.length, challenges: challenges.length, submissions: submissions.length, evaluations: evaluations.length },
  });
}
