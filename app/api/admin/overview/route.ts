import { NextResponse } from "next/server";
import { requireAdmin, sanitizeError } from "@/lib/server/admin-auth";
import { getAllStudents, getTeachers, getAdmins, getAllChallenges, getSubmissions, getEvaluations } from "@/lib/server/feishu";
import { redisPing } from "@/lib/server/redis";
import { listAgents } from "@/lib/server/agent-registry";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const [students, teachers, admins, challenges, submissions, evaluations, redis, agents] = await Promise.all([
      getAllStudents(), getTeachers(), getAdmins(), getAllChallenges(), getSubmissions(), getEvaluations(), redisPing(), listAgents(),
    ]);
    return NextResponse.json({
      ok: true,
      counts: {
        students: students.filter((x) => x.status !== "inactive").length,
        teachers: teachers.filter((x) => x.status !== "inactive").length,
        admins: admins.filter((x) => x.status !== "inactive").length,
        challenges: challenges.length, submissions: submissions.length,
        pending_reviews: evaluations.filter((x) => !x.feedback).length,
        missing_open_id: students.filter((x) => x.status !== "inactive" && !x.feishu_open_id).length,
        agents_online: agents.filter((x) => x.status === "online").length,
      },
      services: {
        feishu: { ok: true }, redis,
        github: { configured: Boolean(process.env.GITHUB_TOKEN) },
        ai: { configured: Boolean(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY) },
        notifications: { configured: Boolean(process.env.FEISHU_CLASS_CHAT_ID) },
      },
      recent: submissions.slice(-8).reverse(),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: sanitizeError(error) }, { status: 500 });
  }
}
