import { NextResponse } from "next/server";
import { getPortfolioItems } from "@/lib/server/feishu";
import { getPrincipal } from "@/lib/server/principal";
import { isStaff } from "@/lib/server/rbac";

export async function GET() {
  const principal = await getPrincipal();
  if (!principal) {
    return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  }

  try {
    const items = await getPortfolioItems();

    // Public items: visible to all logged-in users
    // Non-public items: only visible to staff
    // NOTE: PortfolioItem uses `is_public` field (boolean, from Feishu)
    const visible = items.filter(
      (item) => item.is_public === true || isStaff(principal),
    );

    return NextResponse.json({ ok: true, items: visible });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load portfolio" },
      { status: 500 },
    );
  }
}
