import { NextResponse } from "next/server";
import { generateTaskPlan } from "@/lib/server/ai";
import { updatePersonalTask } from "@/lib/server/feishu";
import { getPrincipal } from "@/lib/server/principal";
import { getVisibleTasks, invalidateTaskPlatformCache } from "@/lib/server/task-platform";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  try {
    const { id } = await params;
    const task = (await getVisibleTasks(principal)).find((item) => item.task_id === id);
    if (!task) return NextResponse.json({ ok: false, error: "任务不存在或不在你的可见范围内" }, { status: 404 });
    if (!task.recordId) return NextResponse.json({ ok: false, error: "历史培训任务暂不生成个人拆解" }, { status: 409 });
    const body = await request.json().catch(() => ({}));
    const plan = await generateTaskPlan(task, body.allow_external_ai === true);
    await updatePersonalTask(task.recordId, {
      ai_plan_json: JSON.stringify(plan),
      ai_generation_mode: plan.mode,
      ai_updated_at: plan.generated_at,
    });
    invalidateTaskPlatformCache();
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "任务拆解失败" }, { status: 500 });
  }
}
