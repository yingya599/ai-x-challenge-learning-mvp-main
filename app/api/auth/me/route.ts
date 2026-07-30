// GET /api/auth/me — Read current Principal + user info from session (T07)
import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { getStudentById, getTeacherById, getAdminById } from "@/lib/server/feishu";

export async function GET() {
  const principal = await getPrincipal();
  if (!principal) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  // Use name from session token first (works for TEACHER_IDS env-var users too)
  let name: string | undefined;
  let class_id: string | undefined;

  // Try Feishu table lookup for richer data
  try {
    if (principal.role === "student" || principal.role === "agent") {
      const student = await getStudentById(principal.person);
      name = student.name;
      class_id = student.class_id;
    } else if (principal.role === "teacher") {
      const teacher = await getTeacherById(principal.person);
      if (teacher) name = teacher.name;
    } else if (principal.role === "admin") {
      const admin = await getAdminById(principal.person);
      if (admin) name = admin.name;
    }
  } catch {
    // Not found or table unavailable — fall back to session name
  }

  return NextResponse.json({
    ok: true,
    person: principal.person,
    role: principal.role,
    org: principal.org,
    name: name || principal.name,
    class_id,
  });
}
