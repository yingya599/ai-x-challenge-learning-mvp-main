import { NextResponse } from "next/server";
import { evaluateTaskSubmission } from "@/lib/server/ai";
import { getPrincipal, getStudentId } from "@/lib/server/principal";
import { getVisibleTasks } from "@/lib/server/task-platform";
import {
  createAiReviewPreviewToken,
  normalizeTaskSubmissionDraft,
  validateTaskSubmissionDraft,
} from "@/lib/server/task-submission-preview";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  const studentId = getStudentId(principal);
  if (!studentId) return NextResponse.json({ ok: false, error: "只有实习生可以申请任务初评" }, { status: 403 });

  try {
    const { id } = await params;
    const task = (await getVisibleTasks(principal)).find((item) => item.task_id === id && item.student_id === studentId);
    if (!task) return NextResponse.json({ ok: false, error: "任务不存在或不属于当前实习生" }, { status: 404 });
    if (["accepted", "cancelled"].includes(task.status || "")) {
      return NextResponse.json({ ok: false, error: "该任务已经结束，不能继续提交" }, { status: 409 });
    }

    const body = await request.json() as Record<string, unknown>;
    if (body.allow_external_ai !== true) {
      return NextResponse.json({ ok: false, error: "请先确认允许发送摘要信息给 DeepSeek" }, { status: 400 });
    }
    const draft = normalizeTaskSubmissionDraft(body);
    const validationError = validateTaskSubmissionDraft(task, draft);
    if (validationError) return NextResponse.json({ ok: false, error: validationError }, { status: 400 });

    const review = await evaluateTaskSubmission({
      task,
      submission: draft,
    });
    const previewToken = createAiReviewPreviewToken({ studentId, taskId: task.task_id, draft, evaluation: review });
    return NextResponse.json({
      ok: true,
      review,
      preview_token: previewToken,
      mode: review.fallback ? "demo" : "model",
      message: "AI 初评已生成。你可以根据建议继续修改，或确认提交给带教。",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "AI 初评失败" }, { status: 500 });
  }
}
