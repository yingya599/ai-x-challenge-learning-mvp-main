// review-workflow.ts — Teacher final review (§4.3 manual_review_adjustment + dual-column status)
// The teacher confirms or returns a submission. Writes Evaluations (teacher type),
// updates Submission status + task_state, audits, and notifies the student.
import * as feishu from "./feishu";
import { after } from "next/server";
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
import { getRedis } from "./redis";
import {
  assertTeacherFinalization,
  normalizeSubmissionStatus,
  taskStateFor,
} from "./submission-state";
import { makeId } from "./ids";
import { selectEffectiveTeacherEvaluation } from "./evaluation-policy";

const localLockScope = globalThis as typeof globalThis & {
  __nseapTeacherReviewLocks?: Map<string, string>;
};

function localTeacherReviewLocks() {
  if (!localLockScope.__nseapTeacherReviewLocks) {
    localLockScope.__nseapTeacherReviewLocks = new Map<string, string>();
  }
  return localLockScope.__nseapTeacherReviewLocks;
}

export interface TeacherReviewInput {
  submissionId: string;
  action: "accept" | "return";
  score: number;
  feedback: string;
  // 由服务端 Principal 或可信消息信封提供，客户端不能指定。
  reviewerId: string;
  reviewerAgentId?: string;
}

export type TeacherReviewErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SERVICE_UNAVAILABLE"
  | "INVALID_TRANSITION"
  | "INTERNAL_ERROR";

export interface TeacherReviewResult {
  ok: boolean;
  evaluationId?: string;
  error?: string;
  errorCode?: TeacherReviewErrorCode;
  auditTrail?: unknown[];
}

export async function teacherFinalizeReview(input: TeacherReviewInput): Promise<TeacherReviewResult> {
  const audit = new AuditTrail();
  let redis = getRedis();
  const lockKey = `nseap:lock:teacher-final-review:${input.submissionId}`;
  const lockToken = makeId("review-lock");
  const auditActor = input.reviewerId || input.reviewerAgentId || WEBAPP_FALLBACK_TEACHER_AGENT;
  let lockAcquired = false;
  let localLockAcquired = false;
  const allowLocalLock = process.env.REVIEW_LOCK_MODE === "local";

  const persistAudit = async () => {
    enqueue(audit.entries);
    await flush();
  };

  const lockUnavailable = async (error?: unknown): Promise<TeacherReviewResult> => {
    audit.log(auditActor, "teacher_review_lock_unavailable", input.submissionId, {
      error_trace: error instanceof Error ? error.message : error ? String(error) : undefined,
    });
    await persistAudit();
    return {
      ok: false,
      error: "终审保护服务暂不可用，请稍后重试",
      errorCode: "SERVICE_UNAVAILABLE",
      auditTrail: audit.entries,
    };
  };

  try {
    // 0. Validate score (defense-in-depth)
    if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
      return { ok: false, error: "分数必须在 0-100 之间", errorCode: "INVALID_INPUT" };
    }
    if (input.action !== "accept" && input.action !== "return") {
      return {
        ok: false,
        error: "action 必须为 accept 或 return",
        errorCode: "INVALID_INPUT",
      };
    }
    if (!input.submissionId || !input.reviewerId || !input.feedback?.trim()) {
      return {
        ok: false,
        error: "缺少 Submission、终审人或评语",
        errorCode: "INVALID_INPUT",
      };
    }

    // 正式环境继续失败关闭；本地演示可显式启用单进程锁，无需安装 Redis。
    // 单进程锁只用于本机验收，不能替代生产环境的跨实例 Redis NX 锁。
    if (redis) {
      try {
        const pong = await redis.ping();
        if (pong !== "PONG") throw new Error("Redis ping failed");
      } catch (error) {
        if (!allowLocalLock) return lockUnavailable(error);
        redis = null;
      }
    }

    let acquired = false;
    if (redis) {
      try {
        acquired = (await redis.set(lockKey, lockToken, "EX", 120, "NX")) === "OK";
      } catch (error) {
        if (!allowLocalLock) return lockUnavailable(error);
        redis = null;
      }
    }
    if (!redis && allowLocalLock) {
      const locks = localTeacherReviewLocks();
      if (!locks.has(lockKey)) {
        locks.set(lockKey, lockToken);
        localLockAcquired = true;
        acquired = true;
        audit.log(auditActor, "teacher_review_local_lock_acquired", input.submissionId);
      }
    }
    if (!redis && !allowLocalLock) return lockUnavailable();
    if (!acquired) {
      audit.log(auditActor, "teacher_review_lock_conflict", input.submissionId);
      await persistAudit();
      return {
        ok: false,
        error: "该 Submission 正在被其他教师终审，请刷新后重试",
        errorCode: "CONFLICT",
        auditTrail: audit.entries,
      };
    }
    lockAcquired = Boolean(redis);

    // 锁内重新读取飞书，飞书记录是终审是否完成的最终依据。
    const [submission, existingEvaluations] = await Promise.all([
      feishu.getSubmissionById(input.submissionId),
      feishu.getEvaluationsBySubmission(input.submissionId),
    ]);
    if (!submission || !submission.recordId) {
      audit.log(auditActor, "teacher_review_submission_not_found", input.submissionId);
      await persistAudit();
      return {
        ok: false,
        error: "提交记录不存在",
        errorCode: "NOT_FOUND",
        auditTrail: audit.entries,
      };
    }

    const existingTeacherEvaluation =
      selectEffectiveTeacherEvaluation(existingEvaluations);
    if (existingTeacherEvaluation) {
      audit.log(auditActor, "duplicate_teacher_review_rejected", input.submissionId, {
        after_state: { evaluation_id: existingTeacherEvaluation.evaluation_id },
      });
      await persistAudit();
      return {
        ok: false,
        error: "该 Submission 已完成教师终审，不能重复评价",
        errorCode: "CONFLICT",
        auditTrail: audit.entries,
      };
    }

    const currentStatus = normalizeSubmissionStatus(submission.status, submission.task_state);
    if (!currentStatus) {
      audit.log(auditActor, "unknown_submission_state_rejected", input.submissionId, {
        before_state: { status: submission.status, task_state: submission.task_state },
      });
      await persistAudit();
      return {
        ok: false,
        error: `无法识别 Submission 当前状态：${submission.status || submission.task_state || "空"}`,
        errorCode: "INVALID_TRANSITION",
        auditTrail: audit.entries,
      };
    }

    let newStatus: "accepted" | "needs_teacher_revision";
    try {
      newStatus = assertTeacherFinalization(currentStatus, input.action);
    } catch (error) {
      audit.log(auditActor, "illegal_teacher_review_transition", input.submissionId, {
        error_trace: error instanceof Error ? error.message : String(error),
        before_state: { status: currentStatus },
      });
      await persistAudit();
      return {
        ok: false,
        error: error instanceof Error ? error.message : "当前状态不允许终审",
        errorCode: "INVALID_TRANSITION",
        auditTrail: audit.entries,
      };
    }

    const envelopeAgentId = input.reviewerAgentId || WEBAPP_FALLBACK_TEACHER_AGENT;

    // 1. Construct manual_review_adjustment envelope
    const envelope = buildEnvelope({
      messageType: "manual_review_adjustment",
      fromAgent: envelopeAgentId,
      toAgent: SUBMISSION_TASK_AGENT,
      payload: {
        submission_id: input.submissionId,
        student_id: submission.student_id,
        action: input.action,
        score: input.score,
        feedback: input.feedback,
      },
      auditId: audit.traceId,
    });
    audit.log(auditActor, "send_manual_review_adjustment", envelope.message_id);

    // 2. Trust check: teacher → submission-task agent
    if (!isTrusted(envelope.from_agent, envelope.to_agent)) {
      throw new Error("评审请求来自未受信任的 Agent，已拒绝");
    }
    audit.log(SUBMISSION_TASK_AGENT, "verify_relationship_review", envelope.from_agent);

    // 飞书读取可能较慢；真正写评价前续期并再次确认锁仍由本请求持有。
    // 若锁已经丢失则失败关闭，绝不继续写入第二条终审评价。
    try {
      if (!redis && localLockAcquired) {
        if (localTeacherReviewLocks().get(lockKey) !== lockToken) {
          localLockAcquired = false;
          throw new Error("Local review lock lost");
        }
      } else if (redis) {
      const renewed = await redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end",
        1,
        lockKey,
        lockToken,
        120,
      );
      if (Number(renewed) !== 1) {
        lockAcquired = false;
        audit.log(auditActor, "teacher_review_lock_lost", input.submissionId);
        await persistAudit();
        return {
          ok: false,
          error: "终审锁已失效，请刷新后重试",
          errorCode: "CONFLICT",
          auditTrail: audit.entries,
        };
      }
      }
    } catch (error) {
      if (redis) {
        lockAcquired = false;
        return lockUnavailable(error);
      }
      return {
        ok: false,
        error: "本地终审锁已失效，请刷新后重试",
        errorCode: "CONFLICT",
        auditTrail: audit.entries,
      };
    }

    // 3. Write teacher evaluation to Evaluations table
    const evaluation = await feishu.createEvaluation({
      submission_id: input.submissionId,
      student_id: submission.student_id,
      challenge_id: submission.challenge_id,
      evaluator_type: "teacher",
      evaluator_id: input.reviewerId,
      score_total: input.score,
      feedback: input.feedback,
      created_at: new Date().toISOString(),
    });
    audit.log(SUBMISSION_TASK_AGENT, "create_teacher_evaluation", String(evaluation.evaluation_id), {
      after_state: { evaluator_type: "teacher", score: input.score, action: input.action },
    });

    // 4. Update Submission record: status + task_state (dual column, §4.3)
    const newTaskState = taskStateFor(newStatus);

    try {
      await feishu.updateSubmission(submission.recordId, {
        status: newStatus,
        task_state: newTaskState,
        review_status: newStatus,
        updated_at: new Date().toISOString(),
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
        await feishu.updateSubmission(submission.recordId, { status: newStatus });
        audit.log(SUBMISSION_TASK_AGENT, "update_submission_status_fallback", input.submissionId, {
          after_state: { status: newStatus, task_state: "⚠️ column missing" },
        });
      } else {
        throw err;
      }
    }

    // 5. 评价与 Submission 状态已经是终审的权威结果，可以立即响应页面。
    // 通知、Tasks 状态投影、审计和记忆属于派生写入，使用 Next after 保证请求完成后继续执行，
    // 避免带教为四组彼此独立的飞书网络请求多等待十余秒。
    after(async () => {
      const actionText = input.action === "accept" ? "通过 ✅" : "需要修改 ⚠️";
      const notificationPromise = notifyStudent(submission.student_id,
        `📢 你的提交教师终评结果：\n${actionText}\n分数：${input.score}/100\n评语：${input.feedback}`
      );
      const taskProjectionPromise = (async () => {
        if (!submission.task_id) return;
        const personalTask = await feishu.getPersonalTaskById(submission.task_id);
        if (!personalTask?.recordId) return;
        const nextReturnCount = input.action === "return" ? (personalTask.return_count || 0) + 1 : personalTask.return_count || 0;
        await feishu.updatePersonalTask(personalTask.recordId, {
          status: input.action === "accept" ? "accepted" : "returned",
          risk_status: input.action === "accept" ? "normal" : nextReturnCount >= 2 ? "repeated_return" : "normal",
          return_count: nextReturnCount,
        });
      })();
      const [notifyResult] = await Promise.all([notificationPromise, taskProjectionPromise]);
      if (!notifyResult.ok) {
        audit.log(SUBMISSION_TASK_AGENT, "notify_failed", submission.student_id, { error_trace: notifyResult.error });
      }
      await persistAudit();
      await updateStudentMemory(submission.student_id, {
        learning_state: "reviewed",
        last_feedback: {
          from: input.reviewerAgentId || input.reviewerId,
          summary_pointer: input.submissionId,
          ts: new Date().toISOString(),
        },
      }).catch(() => {});
    });

    return {
      ok: true,
      evaluationId: evaluation.evaluation_id,
      auditTrail: audit.entries,
    };
  } catch (error) {
    audit.log(SUBMISSION_TASK_AGENT, "teacher_review_failed", input.submissionId, {
      error_trace: error instanceof Error ? error.message : String(error),
    });
    await persistAudit();
    return {
      ok: false,
      error: error instanceof Error ? error.message : "评审失败",
      errorCode: "INTERNAL_ERROR",
      auditTrail: audit.entries,
    };
  } finally {
    if (lockAcquired && redis) {
      // 只释放自己持有的锁，避免误删超时后由其他请求取得的新锁。
      await redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        lockKey,
        lockToken,
      ).catch(() => {});
    }
    if (localLockAcquired) {
      const locks = localTeacherReviewLocks();
      if (locks.get(lockKey) === lockToken) locks.delete(lockKey);
    }
  }
}
