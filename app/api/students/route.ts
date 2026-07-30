import { NextResponse } from "next/server";
import { getStudents } from "@/lib/server/feishu";
import { getPrincipal } from "@/lib/server/principal";
import { can, getBoundStudentId } from "@/lib/server/rbac";

export async function GET() {
  const principal = await getPrincipal();
  if (!principal) {
    return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  }

  try {
    const students = await getStudents();

    // Strip sensitive fields (api_key, feishu_open_id) for ALL roles
    const sanitized = students.map(({ api_key, feishu_open_id, ...rest }) => rest);

    if (can(principal, "view_roster")) {
      // Staff: see all students (sanitized)
      return NextResponse.json({ ok: true, students: sanitized });
    }

    // Students/agents: only see their own bound student
    const boundId = getBoundStudentId(principal);
    if (boundId) {
      const self = sanitized.filter((s) => s.student_id === boundId);
      return NextResponse.json({ ok: true, students: self });
    }

    // Fallback: no bound student and not staff → empty list
    return NextResponse.json({ ok: true, students: [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load students" },
      { status: 500 },
    );
  }
}
