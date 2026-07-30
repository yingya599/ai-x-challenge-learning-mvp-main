import { NextResponse } from "next/server";
import { checkRepoHealth } from "@/lib/server/github";
import { getPrincipal } from "@/lib/server/principal";
import { getRedis } from "@/lib/server/redis";

export async function POST(request: Request) {
  const principal = await getPrincipal();
  if (!principal) {
    return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  }

  // Rate limit: 30 requests per principal per hour
  const redis = getRedis();
  if (redis) {
    const hour = new Date().toISOString().slice(0, 13);
    const key = `ratelimit:ghcheck:${principal.person}:${hour}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);
    if (count > 30) {
      return NextResponse.json(
        { ok: false, error: "请求过于频繁，请稍后再试" },
        { status: 429 },
      );
    }
  }

  try {
    const { repoUrl } = await request.json();
    const githubCheck = await checkRepoHealth(repoUrl);
    return NextResponse.json({ ok: true, githubCheck });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "GitHub check failed" },
      { status: 500 },
    );
  }
}
