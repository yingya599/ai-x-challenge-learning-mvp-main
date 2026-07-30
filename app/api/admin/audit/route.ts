import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { listAdminAudit } from "@/lib/server/admin-audit";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").toLowerCase();
  const rows = await listAdminAudit(Number(url.searchParams.get("limit") || 200));
  const items = query ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query)) : rows;
  return NextResponse.json({ ok: true, items });
}
