// GET /api/tasks/[id] — Task status query (T20).
// Checks Redis cache first; Feishu is the source of truth (决策一).
import { NextResponse } from "next/server";
import { getTask } from "@/lib/server/tasks";
import { getPrincipal } from "@/lib/server/principal";
import { getBoundStudentId, isLeader, isMentor, isStaff } from "@/lib/server/rbac";
import { getPersonalTaskByRecordId, updatePersonalTask } from "@/lib/server/feishu";
import { getVisibleTasks, invalidateTaskPlatformCache } from "@/lib/server/task-platform";

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
    const personalTask = (await getVisibleTasks(principal)).find((item) => item.task_id === id);
    if (personalTask) {
      // 列表读取用于筛选权限；详情再按 recordId 实时读取一次，确保刚发布或
      // 刚更新的截止日期、保密等级和 AI 结果不会被飞书列表缓存延迟影响。
      const fresh = personalTask.recordId ? await getPersonalTaskByRecordId(personalTask.recordId) : null;
      const nonEmptyFresh = fresh ? Object.fromEntries(Object.entries(fresh).filter(([, value]) => value !== "" && value != null)) : {};
      return NextResponse.json({ ok: true, task: { ...personalTask, ...nonEmptyFresh }, source: "personal_task" });
    }
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!isLeader(principal) && !isMentor(principal)) {
    return NextResponse.json({ ok: false, error: "无权修改个人任务" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const task = (await getVisibleTasks(principal)).find((item) => item.task_id === id);
    if (!task) return NextResponse.json({ ok: false, error: "任务不存在或不在你的负责范围内" }, { status: 404 });
    if (!task.recordId) {
      return NextResponse.json({ ok: false, error: "历史培训任务只读，不能按个人任务修改" }, { status: 409 });
    }
    const body = await request.json();
    const allowed = ["title", "business_context", "objective", "instructions_md", "acceptance_criteria", "start_date", "due_date", "priority", "confidentiality", "status", "risk_status", "mentor_id", "task_config_json"];
    const fields = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
    if (["due_date", "priority", "confidentiality", "status"].some((key) => key in body)) {
      let previousConfig: Record<string, unknown> = {};
      try { previousConfig = JSON.parse(task.task_config_json || "{}"); } catch { /* ignore old malformed snapshots */ }
      fields.task_config_json = JSON.stringify({
        ...previousConfig,
        due_date: body.due_date ?? task.due_date,
        priority: body.priority ?? task.priority,
        confidentiality: body.confidentiality ?? task.confidentiality,
        status: body.status ?? task.status,
      });
    }
    await updatePersonalTask(task.recordId, fields);
    invalidateTaskPlatformCache();
    return NextResponse.json({ ok: true, task_id: id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "任务更新失败" }, { status: 500 });
  }
}
