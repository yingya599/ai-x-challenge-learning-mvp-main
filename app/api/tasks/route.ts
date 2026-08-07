import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { canAccessManagement, getBoundStudentId, isLeader, isMentor } from "@/lib/server/rbac";
import { createPersonalTask, getTeacherById } from "@/lib/server/feishu";
import { getInternDetail, getInternRows, getVisibleTasks, invalidateTaskPlatformCache } from "@/lib/server/task-platform";

export async function GET() {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  try {
    const studentId = getBoundStudentId(principal);
    const detail = studentId ? await getInternDetail(principal, studentId) : null;
    return NextResponse.json({
      ok: true,
      tasks: await getVisibleTasks(principal),
      storage_ready: Boolean(process.env.FEISHU_TASKS_TABLE_ID),
      growth: detail ? {
        job_direction: detail.job_direction,
        summary: detail.summary,
        capability: detail.capability,
      } : undefined,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "任务加载失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!canAccessManagement(principal) || (!isLeader(principal) && !isMentor(principal))) {
    return NextResponse.json({ ok: false, error: "无权创建个人任务" }, { status: 403 });
  }
  if (!process.env.FEISHU_TASKS_TABLE_ID) {
    return NextResponse.json({
      ok: false,
      code: "TASK_STORAGE_NOT_CONFIGURED",
      error: "个人任务表尚未连接飞书，请先创建 Tasks 表并配置 FEISHU_TASKS_TABLE_ID",
    }, { status: 503 });
  }
  try {
    const body = await request.json();
    const required = ["job_direction", "student_id", "title", "due_date"];
    if (required.some((key) => !body[key])) {
      return NextResponse.json({ ok: false, error: `缺少必填项：${required.join(", ")}` }, { status: 400 });
    }
    const interns = await getInternRows(principal);
    if (!interns.some((student) => student.student_id === body.student_id)) {
      return NextResponse.json({ ok: false, error: "不能向负责范围外的实习生分配任务" }, { status: 403 });
    }
    const mentorId = isMentor(principal) ? principal.person : body.mentor_id;
    if (!mentorId) return NextResponse.json({ ok: false, error: "必须指定带教人" }, { status: 400 });
    if (isLeader(principal)) {
      const mentor = await getTeacherById(String(mentorId));
      const mentorRole = String(mentor?.role || "teacher").toLowerCase();
      const isAssignableMentor = !!mentor && (["teacher", "mentor"].includes(mentorRole) || mentorRole.includes("带教") || mentorRole.includes("教师"));
      if (!isAssignableMentor) {
        return NextResponse.json({ ok: false, error: "所选带教人不存在或不是带教角色" }, { status: 400 });
      }
    }
    const {
      evidence_requirements: evidenceRequirements = [],
      competency_ids_json: competencyIdsJson,
      ...taskFields
    } = body;
    const result = await createPersonalTask({
      ...taskFields,
      category_id: taskFields.category_id || `custom-${taskFields.job_direction}`,
      mentor_id: mentorId,
      is_public: false,
      evidence_requirements_json: JSON.stringify(evidenceRequirements),
      task_config_json: JSON.stringify({
        due_date: taskFields.due_date,
        priority: taskFields.priority || "medium",
        confidentiality: taskFields.confidentiality || "internal",
        status: taskFields.status || "assigned",
        competency_ids_json: competencyIdsJson || "[]",
      }),
    });
    invalidateTaskPlatformCache();
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "个人任务创建失败";
    return NextResponse.json({
      ok: false,
      error: message.includes("FEISHU_TASKS_TABLE_ID")
        ? "个人任务表尚未连接飞书，请先完成任务表配置"
        : message,
    }, { status: 500 });
  }
}
