// GET /api/tasks/[id] — Task status query (T20).
// Checks Redis cache first; Feishu is the source of truth (决策一).
import { NextResponse } from "next/server";
import { getTask } from "@/lib/server/tasks";
import { getPrincipal } from "@/lib/server/principal";
import { getBoundStudentId, isStaff } from "@/lib/server/rbac";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await getPrincipal();
    if (!principal) {
      return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    const task = await getTask(id);

    if (!task) {
      return NextResponse.json(
        { ok: false, error: "任务不存在或已过期" },
        { status: 404 },
      );
    }

    // Access control: student can only see own tasks; staff can see all
    const boundId = getBoundStudentId(principal);
    if (boundId && task.student_id !== boundId && !isStaff(principal)) {
      return NextResponse.json({ ok: false, error: "无权访问此任务" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, task });
  } catch (error) {
    console.error("[tasks/[id]]", error);
    return NextResponse.json(
      { ok: false, error: "查询任务失败" },
      { status: 500 },
    );
  }
}
