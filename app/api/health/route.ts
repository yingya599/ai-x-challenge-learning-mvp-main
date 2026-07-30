import { NextResponse } from "next/server";
import { redisPing } from "@/lib/server/redis";
import { requireAdmin } from "@/lib/server/admin-auth";

const required = [
  "FEISHU_APP_ID",
  "FEISHU_APP_SECRET",
  "FEISHU_APP_TOKEN",
  "FEISHU_STUDENTS_TABLE_ID",
  "FEISHU_CHALLENGES_TABLE_ID",
  "FEISHU_SUBMISSIONS_TABLE_ID",
  "FEISHU_EVALUATIONS_TABLE_ID",
  "FEISHU_PORTFOLIO_TABLE_ID",
];

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const missing = required.filter((name) => !process.env[name]);
  const redis = await redisPing();

  return NextResponse.json({
    ok: missing.length === 0,
    missing,
    redis,
    optional: {
      GITHUB_TOKEN: Boolean(process.env.GITHUB_TOKEN),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      DEEPSEEK_API_KEY: Boolean(process.env.DEEPSEEK_API_KEY),
      AI_PROVIDER: process.env.AI_PROVIDER || "deepseek",
    },
  });
}
