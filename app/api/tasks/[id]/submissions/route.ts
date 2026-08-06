import { NextResponse } from "next/server";
import { getPrincipal, getStudentId } from "@/lib/server/principal";
import { createEvaluation, createSubmission, updatePersonalTask } from "@/lib/server/feishu";
import { getVisibleTasks } from "@/lib/server/task-platform";
import {
  normalizeTaskSubmissionDraft,
  validateTaskSubmissionDraft,
  verifyAiReviewPreviewToken,
} from "@/lib/server/task-submission-preview";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  const studentId = getStudentId(principal);
  if (!studentId) return NextResponse.json({ ok: false, error: "只有实习生可以提交任务" }, { status: 403 });
  try {
    const { id } = await params;
    const task = (await getVisibleTasks(principal)).find((item) => item.task_id === id && item.student_id === studentId);
    if (!task) return NextResponse.json({ ok: false, error: "任务不存在或不属于当前实习生" }, { status: 404 });
    if (["accepted", "cancelled"].includes(task.status || "")) {
      return NextResponse.json({ ok: false, error: "该任务已经结束，不能继续提交" }, { status: 409 });
    }
    const body = await request.json() as Record<string, unknown>;
    const draft = normalizeTaskSubmissionDraft(body);
    const validationError = validateTaskSubmissionDraft(task, draft);
    if (validationError) return NextResponse.json({ ok: false, error: validationError }, { status: 400 });

    const previewToken = String(body.ai_preview_token || "");
    const aiEvaluation = previewToken ? verifyAiReviewPreviewToken({
      token: previewToken,
      studentId,
      taskId: task.task_id,
      draft,
    }) : null;
    if (body.allow_external_ai === true && !aiEvaluation) {
      return NextResponse.json({ ok: false, error: "AI 初评已过期或提交内容发生变化，请重新获取初评" }, { status: 409 });
    }

    const github = draft.evidence_items.find((item) => item.type === "github");
    const submittedAt = new Date().toISOString();
    const result = await createSubmission({
      task_id: task.task_id,
      challenge_id: task.category_id,
      student_id: studentId,
      student_name: task.student_name || studentId,
      project_title: task.title,
      project_summary: draft.result_summary,
      result_summary: draft.result_summary,
      evidence_items_json: JSON.stringify(draft.evidence_items),
      submitted_files: JSON.stringify(draft.uploaded_files),
      attachments: draft.uploaded_files.map((item) => ({ file_token: item.file_token })),
      github_repo_url: github?.url || "",
      aar_text: draft.aar_text,
      self_evaluation_text: draft.self_evaluation_text,
      status: "pending_teacher_review",
      task_state: "PENDING_TEACHER_REVIEW",
      review_status: "PENDING",
      is_public: false,
      submitted_at: submittedAt,
    });

    // DeepSeek 已在“提交前初评”阶段完成；正式提交只保存签名保护的同一份结果，
    // 不再现场重新调用模型。评价写入和任务状态投影并行，减少最终提交等待。
    const taskProjection = task.recordId
      ? updatePersonalTask(task.recordId, { status: "submitted", risk_status: "normal" }).catch((error) => {
          console.error("[tasks/submissions] task status projection failed:", error);
        })
      : Promise.resolve();
    let aiReviewStatus: "not_requested" | "completed" | "demo_fallback" | "failed" = "not_requested";
    if (aiEvaluation) {
      try {
        await createEvaluation({
          submission_id: result.submission_id,
          student_id: studentId,
          challenge_id: task.category_id,
          evaluator_type: "ai",
          evaluator_id: aiEvaluation.fallback ? "local-demo" : "deepseek",
          score_total: aiEvaluation.scoreTotal,
          scores_json: JSON.stringify(aiEvaluation.scores),
          strengths: aiEvaluation.strengths,
          weaknesses: aiEvaluation.weaknesses,
          suggestions: aiEvaluation.suggestions,
          feedback: aiEvaluation.feedback,
          created_at: submittedAt,
        });
        aiReviewStatus = aiEvaluation.fallback ? "demo_fallback" : "completed";
      } catch (error) {
        console.error("[tasks/submissions] AI initial review failed:", error);
        aiReviewStatus = "failed";
      }
    }
    await taskProjection;
    return NextResponse.json({ ok: true, ...result, ai_review_status: aiReviewStatus }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "任务提交失败" }, { status: 500 });
  }
}
