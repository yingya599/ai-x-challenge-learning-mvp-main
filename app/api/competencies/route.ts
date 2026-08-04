import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { loadTaskPlatformData } from "@/lib/server/task-platform";

export async function GET() {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  try {
    const data = await loadTaskPlatformData(principal);
    return NextResponse.json({ ok: true, competencies: data.competencies });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "能力标准加载失败" }, { status: 500 });
  }
}
