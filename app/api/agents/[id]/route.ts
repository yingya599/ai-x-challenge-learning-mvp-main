// DELETE /api/agents/[id] — Agent unregistration (P3 T2)
import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { unregisterAgent, RESERVED_AGENT_IDS } from "@/lib/server/agent-registry";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // P3 security fix: only admin/system, or the agent itself, may unregister.
    // Reserved system agents may only be unregistered by admin/system.
    const principal = await getPrincipal();
    if (!principal) {
      return NextResponse.json({ ok: false, error: "请先认证" }, { status: 401 });
    }
    const isPrivileged = principal.role === "admin" || principal.role === "system";
    const isSelf = principal.person === id;
    if (RESERVED_AGENT_IDS.has(id) && !isPrivileged) {
      return NextResponse.json({ ok: false, error: "系统 Agent 受保护，禁止注销" }, { status: 403 });
    }
    if (!isPrivileged && !isSelf) {
      return NextResponse.json({ ok: false, error: "仅本 Agent 或管理员可注销" }, { status: 403 });
    }

    await unregisterAgent(id);
    return NextResponse.json({ ok: true, agent_id: id, status: "unregistered" });
  } catch (error) {
    console.error("[agents/[id]]", error);
    return NextResponse.json(
      { ok: false, error: "注销 Agent 失败" },
      { status: 500 },
    );
  }
}
