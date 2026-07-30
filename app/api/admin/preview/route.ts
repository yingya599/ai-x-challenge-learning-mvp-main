import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getStudentById, getTeacherById, getSubmissions, getEvaluations } from "@/lib/server/feishu";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const role = url.searchParams.get("role");
  const person = url.searchParams.get("person");
  if (!person || !["student", "teacher"].includes(role || "")) return NextResponse.json({ ok: false, error: "无效的模拟目标" }, { status: 400 });
  if (role === "student") {
    const student = await getStudentById(person);
    const { api_key: _key, api_key_hash: _hash, feishu_app_secret: _secret, ...safe } = student;
    return NextResponse.json({ ok: true, read_only: true, role, identity: safe, submissions: await getSubmissions({ studentId: person }), evaluations: (await getEvaluations()).filter((x) => x.evaluator_id === person) });
  }
  const teacher = await getTeacherById(person);
  if (!teacher) return NextResponse.json({ ok: false, error: "教师不存在" }, { status: 404 });
  return NextResponse.json({ ok: true, read_only: true, role, identity: { ...teacher, api_key_hash: undefined }, submissions: await getSubmissions(), evaluations: await getEvaluations() });
}
