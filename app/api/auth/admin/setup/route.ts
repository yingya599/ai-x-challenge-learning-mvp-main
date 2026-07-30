import { NextResponse } from "next/server";
import { getAdminById } from "@/lib/server/feishu";
import { generateTotpSecret, isAdminInitialized, saveAdminCredentials } from "@/lib/server/admin-credentials";

export async function POST(request: Request) {
  const { admin_id, name, password, bootstrap_token } = await request.json();
  if (!admin_id || !name || !password || !bootstrap_token) return NextResponse.json({ ok: false, error: "请填写全部字段" }, { status: 400 });
  if (bootstrap_token !== process.env.ADMIN_BOOTSTRAP_TOKEN) return NextResponse.json({ ok: false, error: "初始化令牌无效" }, { status: 403 });
  if (password.length < 12) return NextResponse.json({ ok: false, error: "密码至少需要 12 位" }, { status: 400 });
  const admin = await getAdminById(String(admin_id));
  if (!admin || admin.name.trim().toLowerCase() !== String(name).trim().toLowerCase()) {
    return NextResponse.json({ ok: false, error: "管理员身份不匹配" }, { status: 403 });
  }
  if (await isAdminInitialized(admin.admin_id)) return NextResponse.json({ ok: false, error: "该管理员已完成初始化" }, { status: 409 });
  const secret = generateTotpSecret();
  await saveAdminCredentials(admin.admin_id, password, secret);
  const issuer = encodeURIComponent("NSEAP Admin");
  const account = encodeURIComponent(`${admin.name} (${admin.admin_id})`);
  return NextResponse.json({
    ok: true, secret,
    otpauth_uri: `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
    message: "请立即添加到验证器；此密钥只显示一次。",
  });
}
