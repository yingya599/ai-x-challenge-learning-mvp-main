// review-workflow.ts — Teacher final review (§4.3 manual_review_adjustment + dual-column status)
// The teacher confirms or returns a submission. Writes Evaluations (teacher type),
// updates Submission status + task_state, audits, and notifies the student.
import * as feishu from "./feishu";
import {
  AuditTrail,
  buildEnvelope,
  isTrusted,
  SUBMISSION_TASK_AGENT,
  WEBAPP_FALLBACK_TEACHER_AGENT,
} from "./agents";
import { enqueue, flush } from "./audit-outbox";
import { notifyStudent } from "./notify";
import { updateStudentMemory } from "./ontology-memory";

export interface TeacherReviewInput {
  submissionId: string;
  submissionRecordId: string; // feishu record_id for update
  studentId: string;
  challengeId: string;
  action: "accept" | "return";
  score: number;
  feedback: string;
}

export interface TeacherReviewResult {
  ok: boolean;
  evaluationId?: string;
  error?: string;
  auditTrail?: unknown[];
}

export async function teacherFinalizeReview(input: TeacherReviewInput): Promise<TeacherReviewResult> {
  const audit = new AuditTrail();

  try {
    // 0. Validate score (defense-in-depth)
    if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
      return { ok: false, error: "分数必须在 0-100 之间" };
    }

    // 1. Construct manual_review_adjustment envelope
    const envelope = buildEnvelope({
      messageType: "manual_review_adjustment",
      fromAgent: WEBAPP_FALLBACK_TEACHER_AGENT,
      toAgent: SUBMISSION_TASK_AGENT,
      payload: {
        submission_id: input.submissionId,
        student_id: input.studentId,
        action: input.action,
        score: input.score,
        feedback: input.feedback,
      },
      auditId: audit.traceId,
    });
    audit.log(WEBAPP_FALLBACK_TEACHER_AGENT, "send_manual_review_adjustment", envelope.message_id);

    // 2. Trust check: teacher → submission-task agent
    if (!isTrusted(envelope.from_agent, envelope.to_agent)) {
      throw new Error("评审请求来自未受信任的 Agent，已拒绝");
    }
    audit.log(SUBMISSION_TASK_AGENT, "verify_relationship_review", envelope.from_agent);

    // 3. Write teacher evaluation to Evaluations table
    const evaluation = await feishu.createEvaluation({
      submission_id: input.submissionId,
      student_id: input.studentId,
      challenge_id: input.challengeId,
      evaluator_type: "teacher",
      evaluator_id: WEBAPP_FALLBACK_TEACHER_AGENT,
      score_total: input.score,
      feedback: input.feedback,
      created_at: new Date().toISOString(),
    });
    audit.log(SUBMISSION_TASK_AGENT, "create_teacher_evaluation", String(evaluation.evaluation_id), {
      after_state: { evaluator_type: "teacher", score: input.score, action: input.action },
    });

    // 4. Update Submission record: status + task_state (dual column, §4.3)
    const newStatus = input.action === "accept" ? "accepted" : "needs_teacher_revision";
    const newTaskState = input.action === "accept" ? "COMPLETED" : "RETURNED_FOR_REVISION";

    try {
      await feishu.updateSubmission(input.submissionRecordId, {
        status: newStatus,
        task_state: newTaskState,
      });
      audit.log(SUBMISSION_TASK_AGENT, "update_submission_status", input.submissionId, {
        before_state: {},
        after_state: { status: newStatus, task_state: newTaskState },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isFieldNotFound =
        msg.includes("1254045") ||
        msg.includes("FieldNameNotFound") ||
        msg.includes("field not found");
      if (isFieldNotFound) {
        // ADR-003 fallback: task_state column may not exist, only update status
        audit.log(SUBMISSION_TASK_AGENT, "task_state_field_missing", input.submissionId);
        await feishu.updateSubmission(input.submissionRecordId, { status: newStatus });
        audit.log(SUBMISSION_TASK_AGENT, "update_submission_status_fallback", input.submissionId, {
          after_state: { status: newStatus, task_state: "⚠️ column missing" },
        });
      } else {
        throw err;
      }
    }

    // 5. Notify student (T8)
    const actionText = input.action === "accept" ? "通过 ✅" : "需要修改 ⚠️";
    const notifyResult = await notifyStudent(input.studentId,
      `📢 你的提交教师终评结果：\n${actionText}\n分数：${input.score}/100\n评语：${input.feedback}`
    );
    if (!notifyResult.ok) {
      const entry = audit.log(SUBMISSION_TASK_AGENT, "notify_failed", input.studentId, { error_trace: notifyResult.error });
      enqueue([entry]);
      await flush();
    }

    enqueue(audit.entries);
    await flush();

    // AGENT_CN.md §3.3: update ontology memory after teacher review.
    // TODO: last_feedback.from should be the actual reviewer agent_id, not
    // hardcoded WEBAPP_FALLBACK_TEACHER_AGENT. Pass callerAgentId through
    // TeacherReviewInput when WorkBuddy/Hermes teacher agents are active.
    void updateStudentMemory(input.studentId, {
      learning_state: "reviewed",
      last_feedback: {
        from: WEBAPP_FALLBACK_TEACHER_AGENT,
        summary_pointer: input.submissionId,
        ts: new Date().toISOString(),
      },
    }).catch(() => {});

    return {
      ok: true,
      evaluationId: evaluation.evaluation_id,
      auditTrail: audit.entries,
    };
  } catch (error) {
    audit.log(SUBMISSION_TASK_AGENT, "teacher_review_failed", input.submissionId, {
      error_trace: error instanceof Error ? error.message : String(error),
    });
    enqueue(audit.entries);
    await flush();
    return {
      ok: false,
      error: error instanceof Error ? error.message : "评审失败",
      auditTrail: audit.entries,
    };
  }
}
