import { NextResponse } from "next/server";
import { requireAdmin, sanitizeError } from "@/lib/server/admin-auth";
import { getSecretStatus, setEncryptedSecret } from "@/lib/server/secret-config";
import { writeAdminAudit } from "@/lib/server/admin-audit";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ ok: true, items: await getSecretStatus(), encryption_ready: Boolean(process.env.ADMIN_CONFIG_MASTER_KEY) });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin({ recentAuth: true });
  if (!auth.ok) return auth.response;
  const { key, value, reason, request_id } = await request.json();
  if (!key || !value || !reason) return NextResponse.json({ ok: false, error: "配置、值和原因均为必填" }, { status: 400 });
  try {
    const status = await setEncryptedSecret(key, value, auth.principal.person);
    await writeAdminAudit(auth.principal, { action: "secret.rotate", target: key, reason, result: "success", request_id });
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: sanitizeError(error) }, { status: 400 });
  }
}
