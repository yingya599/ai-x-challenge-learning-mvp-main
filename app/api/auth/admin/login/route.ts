import { NextResponse } from "next/server";
import { getAdminById } from "@/lib/server/feishu";
import { signToken, SESSION_COOKIE } from "@/lib/server/principal";
import { getRedis } from "@/lib/server/redis";

export async function POST(request: Request) {
  const { admin_id, name } = await request.json();
  const redis = getRedis();
  const rateKey = `nseap:admin:login-attempts:${admin_id || "unknown"}`;
  if (redis?.status === "ready" && Number(await redis.get(rateKey) || 0) >= 8) {
    return NextResponse.json({ ok: false, error: "失败次数过多，请 15 分钟后重试" }, { status: 429 });
  }
  try {
    const admin = await getAdminById(String(admin_id || ""));
    const nameOk = admin?.name.trim().toLowerCase() === String(name || "").trim().toLowerCase();
    if (!admin || admin.status === "inactive" || !nameOk) {
      if (redis?.status === "ready") {
        await redis.multi().incr(rateKey).expire(rateKey, 900).exec();
      }
      return NextResponse.json({ ok: false, error: "管理员 ID 或姓名错误" }, { status: 401 });
    }
    if (redis?.status === "ready") await redis.del(rateKey);
    const token = signToken({
      person: admin.admin_id, org: "elite20", role: "admin", name: admin.name,
      auth_time: String(Date.now()), auth_method: "id_name",
    });
    const response = NextResponse.json({ ok: true, redirect: "/admin" });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "strict", path: "/", maxAge: 86400,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "管理员认证服务暂不可用" }, { status: 503 });
  }
}
