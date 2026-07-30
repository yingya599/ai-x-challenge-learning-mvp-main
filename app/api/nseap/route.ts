// POST /api/nseap — NSEAP Agent CLI channel adapter (P3 T4)
// Accepts requests from NSEAP-compatible agent CLIs, validates API key, publishes to bus.
import { NextResponse } from "next/server";
import { getAgentPrincipal } from "@/lib/server/principal";
import { nseapAdapter } from "@/lib/server/channel-adapters";

export async function POST(request: Request) {
  try {
    const principal = await getAgentPrincipal();
    if (!principal) {
      return NextResponse.json(
        { ok: false, error: "请提供有效的 API Key (x-api-key)" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { message_type, to_agent, payload } = body;

    if (!message_type || !payload) {
      return NextResponse.json(
        { ok: false, error: "缺少 message_type 或 payload" },
        { status: 400 },
      );
    }

    const result = await nseapAdapter({
      agent_id: principal.person,
      message_type,
      to_agent: to_agent || "submission-task-agent-001",
      payload,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "请求失败" },
      { status: 500 },
    );
  }
}
