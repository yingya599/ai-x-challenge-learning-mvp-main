import { NextResponse } from "next/server";
import { getChallengeById } from "@/lib/server/feishu";
import { getPrincipal } from "@/lib/server/principal";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const principal = await getPrincipal();
  if (!principal) {
    return NextResponse.json(
      { ok: false, error: "请先登录" },
      { status: 401 },
    );
  }

  const { id } = await params;
  const challengeId = decodeURIComponent(id);

  try {
    const challenge = await getChallengeById(challengeId);
    return NextResponse.json({ ok: true, challenge });
  } catch (error) {
    const message = error instanceof Error ? error.message : "加载 Challenge 失败";
    const status = message.startsWith("Challenge not found:") ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: status === 404 ? "Challenge 不存在" : message },
      { status },
    );
  }
}
