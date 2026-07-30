import { NextResponse } from "next/server";
import { getPublishedChallenges } from "@/lib/server/feishu";
import { publishChallenge } from "@/lib/server/challenge-workflow";
import { getPrincipal } from "@/lib/server/principal";

export async function GET() {
  try {
    const challenges = await getPublishedChallenges();
    return NextResponse.json({ ok: true, challenges });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load challenges" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    // T9: Only teacher can publish challenges
    const principal = await getPrincipal();
    if (!principal || !["teacher", "admin", "system"].includes(principal.role)) {
      return NextResponse.json(
        { ok: false, error: "仅教师可发布 Challenge" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const result = await publishChallenge(body);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Publish failed" },
      { status: 500 },
    );
  }
}
