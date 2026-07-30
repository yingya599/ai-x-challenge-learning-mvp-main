// POST /api/agents/register — Agent registration (P3 T2)
// GET  /api/agents          — List registered agents
import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { registerAgent, listAgents, lookupAgent, RESERVED_AGENT_IDS } from "@/lib/server/agent-registry";

export async function POST(request: Request) {
  try {
    const principal = await getPrincipal();
    if (!principal) {
      return NextResponse.json({ ok: false, error: "请先认证" }, { status: 401 });
    }

    const body = await request.json();
    const { agent_id, capabilities } = body;

    if (!agent_id) {
      return NextResponse.json({ ok: false, error: "缺少 agent_id" }, { status: 400 });
    }

    // P3 security fix: prevent registry hijacking.
    // 1) Reserved system agent IDs can only be (re)registered by admin/system.
    // 2) An existing registration owned by another person cannot be overwritten
    //    unless the caller is admin/teacher.
    const privileged = principal.role === "admin" || principal.role === "system" || principal.role === "teacher";
    if (RESERVED_AGENT_IDS.has(agent_id) && !(principal.role === "admin" || principal.role === "system")) {
      return NextResponse.json({ ok: false, error: "系统 Agent ID 受保护，禁止注册" }, { status: 403 });
    }
    const existing = await lookupAgent(agent_id);
    if (existing && existing.person !== principal.person && !privileged) {
      return NextResponse.json({ ok: false, error: "该 agent_id 已由其他身份注册" }, { status: 409 });
    }

    await registerAgent(
      agent_id,
      { person: principal.person, org: principal.org, role: principal.role as "student" | "teacher" | "agent" | "admin" | "system" },
      capabilities || [],
    );

    return NextResponse.json({ ok: true, agent_id, status: "registered" });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "注册失败" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    // P3 security fix: admin/teacher only (per delivery spec "管理员查看在线 Agent")
    const principal = await getPrincipal();
    if (!principal) {
      return NextResponse.json({ ok: false, error: "请先认证" }, { status: 401 });
    }
    if (!["admin", "teacher", "system"].includes(principal.role)) {
      return NextResponse.json({ ok: false, error: "仅管理员/教师可查看" }, { status: 403 });
    }
    const agents = await listAgents();
    return NextResponse.json({ ok: true, agents });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "查询失败" },
      { status: 500 },
    );
  }
}
