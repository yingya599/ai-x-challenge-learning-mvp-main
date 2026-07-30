// POST /api/auth/bind-bot — Bind student's own Feishu Bot
import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { getStudentById, updateStudent } from "@/lib/server/feishu";

export async function POST(request: Request) {
  const principal = await getPrincipal();
  if (!principal) {
    return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const appId = String(body.feishuAppId || "").trim();
    const appSecret = String(body.feishuAppSecret || "").trim();

    if (!appId || !appSecret) {
      return NextResponse.json({ ok: false, error: "请填写 App ID 和 App Secret" }, { status: 400 });
    }

    const student = await getStudentById(principal.person);
    if (!student.recordId) {
      return NextResponse.json({ ok: false, error: "学生记录不存在" }, { status: 404 });
    }

    await updateStudent(student.recordId, {
      feishu_app_id: appId,
      feishu_app_secret: appSecret,
    });

    return NextResponse.json({ ok: true, message: "飞书 Bot 绑定成功" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found")) {
      return NextResponse.json({ ok: false, error: "学生记录不存在" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "绑定失败" },
      { status: 500 },
    );
  }
}
