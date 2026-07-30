// POST /api/evaluations — Teacher final review + Peer review (T11 + P2)
import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { teacherFinalizeReview } from "@/lib/server/review-workflow";
import * as feishu from "@/lib/server/feishu";
import { notifyStudent } from "@/lib/server/notify";
import { isStaff, can } from "@/lib/server/rbac";

// GET /api/evaluations — list evaluations
//   student: peer-review assignments where I am the evaluator (pending + done)
//   staff: all evaluations, optional ?submissionId= filter
export async function GET(request: Request) {
  try {
    const principal = await getPrincipal();
    if (!principal) {
      return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
    }
    const url = new URL(request.url);
    const submissionId = url.searchParams.get("submissionId") || undefined;

    let evaluations = submissionId
      ? await feishu.getEvaluationsBySubmission(submissionId)
      : await feishu.getEvaluations();

    if (!isStaff(principal)) {
      // Student: only peer-review assignments where I am the evaluator
      evaluations = evaluations.filter(
        (e) => e.evaluator_type === "peer" && e.evaluator_id === principal.person,
      );
    }
    // Staff: see all (no filter)

    // T05: N+1 fix — fetch all submissions once, build Map for lookup
    const subIds = Array.from(new Set(evaluations.map((e) => e.submission_id).filter(Boolean)));
    const submissions = await feishu.getSubmissions();
    const subMap = new Map(submissions.map((s) => [s.submission_id, s]));

    const titles: Record<string, { project_title: string; student_name: string }> = {};
    for (const sid of subIds) {
      const sub = subMap.get(sid);
      if (sub) titles[sid] = { project_title: sub.project_title, student_name: sub.student_name };
    }

    const items = evaluations.map((e) => ({
      evaluation_id: e.evaluation_id,
      submission_id: e.submission_id,
      student_id: e.student_id,
      challenge_id: e.challenge_id,
      evaluator_type: e.evaluator_type,
      evaluator_id: e.evaluator_id,
      score_total: e.score_total,
      feedback: e.feedback,
      created_at: e.created_at,
      pending: !e.feedback,
      project_title: titles[e.submission_id]?.project_title || "",
      submitter_name: titles[e.submission_id]?.student_name || "",
    }));

    return NextResponse.json({ ok: true, evaluations: items });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "加载失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await getPrincipal();
    if (!principal) {
      return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const evaluatorType = body.evaluator_type || "teacher";

    // ---- Peer review (P2) ----
    if (evaluatorType === "peer") {
      const { submissionId, score, feedback } = body;

      if (!submissionId || score === undefined || !feedback) {
        return NextResponse.json(
          { ok: false, error: "缺少必填项：submissionId, score, feedback" },
          { status: 400 },
        );
      }

      // T05: score validation — must be a finite number in [0, 100]
      const scoreNum = Number(score);
      if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        return NextResponse.json(
          { ok: false, error: "分数必须在 0-100 之间" },
          { status: 400 },
        );
      }

      const submission = await feishu.getSubmissionById(submissionId);
      if (!submission) {
        return NextResponse.json({ ok: false, error: "提交记录不存在" }, { status: 404 });
      }

      // Verify this user is the assigned peer
      if (submission.student_id === principal.person) {
        return NextResponse.json(
          { ok: false, error: "不能评审自己的提交" },
          { status: 403 },
        );
      }

      // Find my assignment placeholder (created at allocation time).
      const existingEvaluations = await feishu.getEvaluationsBySubmission(submissionId);
      const mine = existingEvaluations.filter(
        (e) => e.evaluator_type === "peer" && e.evaluator_id === principal.person,
      );
      if (mine.some((e) => !!e.feedback)) {
        return NextResponse.json(
          { ok: false, error: "你已提交过同伴评审，请勿重复提交" },
          { status: 409 },
        );
      }

      const placeholder = mine.find((e) => !e.feedback);
      let evaluationId: string;
      if (placeholder) {
        // Fill the assignment record in place (no duplicate rows)
        await feishu.updateEvaluation(placeholder.recordId, {
          score_total: scoreNum,
          feedback: String(feedback),
        });
        evaluationId = placeholder.evaluation_id;
      } else {
        // T05: No unsolicited peer review — must have an assignment
        return NextResponse.json(
          { ok: false, error: "你未被分配评审此提交" },
          { status: 403 },
        );
      }

      // Notify the submitter (best-effort)
      notifyStudent(
        submission.student_id,
        `🤝 收到同伴评审\n\n你的项目「${submission.project_title}」收到一份同伴评审：${scoreNum} 分。\n反馈：${String(feedback)}`,
      ).catch(() => {});

      return NextResponse.json({
        ok: true,
        evaluationId,
        message: "同伴评审已提交",
      });
    }

    // ---- Teacher review ----
    // T05: Use isStaff() instead of role-specific checks
    // T05: admin can also perform teacher final review
    const isAgentChannel = principal.role === "agent";
    if (isAgentChannel) {
      return NextResponse.json(
        { ok: false, error: "Agent 通道请通过消息总线提交评审" },
        { status: 400 },
      );
    }

    if (!can(principal, "finalize_review")) {
      return NextResponse.json(
        { ok: false, error: "无权提交评审" },
        { status: 403 },
      );
    }

    const { submissionId, action, score, feedback } = body;

    if (!submissionId || !action || score === undefined || !feedback) {
      return NextResponse.json(
        { ok: false, error: "缺少必填项：submissionId, action, score, feedback" },
        { status: 400 },
      );
    }

    if (!["accept", "return"].includes(action)) {
      return NextResponse.json(
        { ok: false, error: "action 必须为 accept 或 return" },
        { status: 400 },
      );
    }

    // T05: score validation
    const scoreNum = Number(score);
    if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      return NextResponse.json(
        { ok: false, error: "分数必须在 0-100 之间" },
        { status: 400 },
      );
    }

    const submission = await feishu.getSubmissionById(submissionId);
    if (!submission || !submission.recordId) {
      return NextResponse.json({ ok: false, error: "提交记录不存在" }, { status: 404 });
    }

    const result = await teacherFinalizeReview({
      submissionId,
      submissionRecordId: submission.recordId,
      studentId: submission.student_id,
      challengeId: submission.challenge_id,
      action,
      score: scoreNum,
      feedback: String(feedback),
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "评审失败" },
      { status: 500 },
    );
  }
}
