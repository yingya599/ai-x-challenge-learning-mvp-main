import { NextResponse } from "next/server";
import { getPrincipal, type ServicePrincipal } from "./principal";

export type AdminAuthResult =
  | { ok: true; principal: ServicePrincipal }
  | { ok: false; response: NextResponse };

export async function requireAdmin(options?: { recentAuth?: boolean }): Promise<AdminAuthResult> {
  const principal = await getPrincipal();
  if (!principal) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 }) };
  }
  if (!["admin", "system"].includes(principal.role)) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "仅管理员可访问" }, { status: 403 }) };
  }
  if (options?.recentAuth) {
    const authTime = Number(principal.auth_time || 0);
    if (!authTime || Date.now() - authTime > 10 * 60 * 1000) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: "该操作需要重新验证管理员身份", code: "REAUTH_REQUIRED" },
          { status: 428 },
        ),
      };
    }
  }
  return { ok: true, principal };
}

export function sanitizeError(error: unknown, fallback = "操作失败") {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/(secret|token|key)=?[^,\s]*/gi, "$1=[REDACTED]");
}
