import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { redisPing } from "@/lib/server/redis";

const TABLES = [
  "FEISHU_STUDENTS_TABLE_ID", "FEISHU_TEACHERS_TABLE_ID", "FEISHU_ADMINS_TABLE_ID",
  "FEISHU_CHALLENGES_TABLE_ID", "FEISHU_SUBMISSIONS_TABLE_ID",
  "FEISHU_EVALUATIONS_TABLE_ID", "FEISHU_PORTFOLIO_TABLE_ID", "FEISHU_AUDITLOGS_TABLE_ID",
  "FEISHU_SYSTEM_CONFIG_TABLE_ID",
];

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const redis = await redisPing();
  return NextResponse.json({
    ok: true,
    runtime: { node: process.version, environment: process.env.NODE_ENV, build: process.env.VERCEL_GIT_COMMIT_SHA || "local" },
    redis,
    feishu: { app_configured: Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET), tables: TABLES.map((name) => ({ name, configured: Boolean(process.env[name]) })) },
    integrations: {
      github: Boolean(process.env.GITHUB_TOKEN),
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      notifications: Boolean(process.env.FEISHU_CLASS_CHAT_ID),
      oauth_redirect: process.env.FEISHU_OAUTH_REDIRECT_URI || "automatic",
      encryption: Boolean(process.env.ADMIN_CONFIG_MASTER_KEY),
    },
  });
}
