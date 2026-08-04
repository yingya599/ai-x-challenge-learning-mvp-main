import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { getStudents, getTeachers, updateStudent } from "@/lib/server/feishu";
import { isLeader } from "@/lib/server/rbac";
import { invalidateTaskPlatformCache } from "@/lib/server/task-platform";

function mentorRole(role?: string) {
  const value = String(role || "teacher").toLowerCase();
  return ["teacher", "mentor"].includes(value) || value.includes("教师") || value.includes("带教");
}

export async function GET() {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!isLeader(principal)) return NextResponse.json({ ok: false, error: "只有领导可以调整带教关系" }, { status: 403 });
  try {
    const [students, teachers] = await Promise.all([getStudents(), getTeachers()]);
    return NextResponse.json({
      ok: true,
      interns: students.map((student) => ({
        recordId: student.recordId,
        student_id: student.student_id,
        name: student.name,
        department: student.department,
        position: student.position,
        mentor_id: student.mentor_id || "",
      })),
      mentors: teachers.filter((teacher) => teacher.status !== "inactive" && mentorRole(teacher.role)).map((teacher) => ({
        teacher_id: teacher.teacher_id,
        name: teacher.name,
      })),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "带教关系加载失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!isLeader(principal)) return NextResponse.json({ ok: false, error: "只有领导可以调整带教关系" }, { status: 403 });
  try {
    const body = await request.json();
    const studentId = String(body.student_id || "").trim();
    const mentorId = String(body.mentor_id || "").trim();
    if (!studentId || !mentorId) return NextResponse.json({ ok: false, error: "请选择实习生和带教" }, { status: 400 });
    const [students, teachers] = await Promise.all([getStudents(), getTeachers()]);
    const student = students.find((item) => item.student_id === studentId);
    const mentor = teachers.find((item) => item.teacher_id === mentorId && item.status !== "inactive" && mentorRole(item.role));
    if (!student?.recordId) return NextResponse.json({ ok: false, error: "实习生不存在" }, { status: 404 });
    if (!mentor) return NextResponse.json({ ok: false, error: "所选账号不是有效带教" }, { status: 400 });
    await updateStudent(student.recordId, { mentor_id: mentorId });
    invalidateTaskPlatformCache();
    return NextResponse.json({ ok: true, student_id: studentId, mentor_id: mentorId, mentor_name: mentor.name });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "带教分配失败" }, { status: 500 });
  }
}
