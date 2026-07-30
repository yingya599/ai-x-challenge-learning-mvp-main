// Submission Task Agent workflow — the "architecture red line" (AGENT_CN.md §2.4):
// the WebApp acts as Student Companion fallback and only *requests* submission;
// this module, acting as submission-task-agent-001, is the only writer of the
// final Submission Record. Every state change carries an audit entry.
import * as ai from "./ai";
import * as feishu from "./feishu";
import * as github from "./github";
import type { SubmissionInput, WorkflowResult } from "./types";
import { ReviewMode } from "../schemas/zod-from-schemas";
import {
  AuditTrail,
  buildEnvelope,
  isTrusted,
  ADMIN_IDENTITY_MODE,
  REVIEW_TASK_AGENT,
  SUBMISSION_TASK_AGENT,
  WEBAPP_FALLBACK_STUDENT_AGENT,
} from "./agents";
import { enqueue, flush } from "./audit-outbox";
import { notifyStudent, notifyGroup } from "./notify";
import { getRedis } from "./redis";
import { updateStudentMemory } from "./ontology-memory";

// T22: Redis-backed deduplication for submission idempotency.
// Key: `${studentId}:${challengeId}:${githubRepoUrl}`, TTL: 60s.
// Falls back to in-memory Map when Redis is unavailable.
const DEDUPE_TTL = 60;
const DEDUPE_PREFIX = "dedup:";

const dedupeCache = new Map<string, number>();
const DEDUPE_WINDOW_MS = 60_000;

const PEER_COUNT = 3; // Number of peers to assign

/** P2: Allocate peer reviewers and notify them via Feishu Bot. */
async function allocatePeers(
  submitter: { student_id: string; name: string; cohort?: string },
  submissionId: string,
  challengeId: string,
  projectTitle: string,
  audit: AuditTrail,
): Promise<void> {
  try {
    // Get students in the same cohort, excluding the submitter
    const allStudents = await feishu.getStudents();
    const cohort = submitter.cohort || "";
    const candidates = allStudents.filter(
      (s) => s.student_id !== submitter.student_id && s.status !== "inactive"
    );

    // Prefer same cohort, fall back to all candidates
    const sameCohort = candidates.filter((s) => s.cohort === cohort);
    const pool = sameCohort.length >= PEER_COUNT ? sameCohort : candidates;

    // Randomly select up to PEER_COUNT peers using Fisher-Yates shuffle
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selected = shuffled.slice(0, PEER_COUNT);

    if (selected.length === 0) {
      audit.log(SUBMISSION_TASK_AGENT, "peer_allocation_failed", submissionId, {
        error_trace: "No eligible peers found",
      });
      return;
    }

    audit.log(SUBMISSION_TASK_AGENT, "peer_allocated", submissionId, {
      after_state: {
        peer_count: selected.length,
        peers: selected.map((p) => p.student_id),
      },
    });

    // Create peer evaluation records + notify each peer
    for (const peer of selected) {
      await feishu.createEvaluation({
        submission_id: submissionId,
        student_id: submitter.student_id,
        challenge_id: challengeId,
        evaluator_type: "peer",
        evaluator_id: peer.student_id,
        score_total: 0,
        feedback: "",
        created_at: new Date().toISOString(),
      }).catch((err) => {
        audit.log(SUBMISSION_TASK_AGENT, "peer_evaluation_create_failed", peer.student_id, {
          error_trace: err instanceof Error ? err.message : String(err),
        });
      });

      // Notify peer via Feishu Bot (await to ensure audit is captured before flush)
      const result = await notifyStudent(peer.student_id,
        `👀 同学互评邀请\n\n${submitter.name} 提交了项目「${projectTitle}」，邀请你进行同伴评审。\n\n请登录学习平台，在「仪表盘 → 待我评审」中查看详情并提交你的评分和反馈。`
      );
      if (!result.ok) {
        audit.log(SUBMISSION_TASK_AGENT, "peer_notify_failed", peer.student_id, {
          error_trace: result.error,
        });
      }
    }
  } catch (err) {
    audit.log(SUBMISSION_TASK_AGENT, "peer_allocation_error", submissionId, {
      error_trace: err instanceof Error ? err.message : String(err),
    });
  }
}

function validateInput(input: SubmissionInput) {
  const required: Array<[keyof SubmissionInput, string]> = [
    ["studentId", "学生"],
    ["challengeId", "Challenge"],
    ["projectTitle", "项目名称"],
    ["projectSummary", "项目简介"],
    ["githubRepoUrl", "GitHub Repo"],
    ["aarText", "AAR 复盘"],
    ["selfEvaluationText", "自评"],
  ];
  for (const [key, label] of required) {
    if (!input[key]) throw new Error(`缺少必填项：${label}`);
  }
}

// Feishu rejects unknown field names; agent-extension columns may not exist yet
// on older Bitable tables. Only fall back to the base field set when the error
// is specifically a field-not-found error (Feishu code 1254045 or FieldNameNotFound).
// Any other error (network, auth, etc.) is re-thrown to prevent duplicate writes.
async function createSubmissionWithAgentFields(
  baseFields: Record<string, unknown>,
  agentFields: Record<string, unknown>,
  audit: AuditTrail,
) {
  try {
    return await feishu.createSubmission({ ...baseFields, ...agentFields });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isFieldNotFound =
      msg.includes("1254045") ||
      msg.includes("FieldNameNotFound") ||
      msg.includes("field not found") ||
      msg.includes("unknown field");
    if (isFieldNotFound) {
      audit.log(SUBMISSION_TASK_AGENT, "agent_fields_dropped", "pending_submission");
      return await feishu.createSubmission(baseFields);
    }
    throw err;
  }
}

export async function submitChallengeProject(
  input: SubmissionInput,
  callerAgentId?: string,
  enforcedStudentId?: string,
): Promise<WorkflowResult> {
  const audit = new AuditTrail();
  const dedupeKey = `${input.studentId}:${input.challengeId}:${input.githubRepoUrl}`;
  const fromAgent = callerAgentId || WEBAPP_FALLBACK_STUDENT_AGENT;

  try {
    // T03: Defense-in-depth — if enforcedStudentId is set, reject mismatches
    if (enforcedStudentId && input.studentId !== enforcedStudentId) {
      audit.log(SUBMISSION_TASK_AGENT, "identity_mismatch_defense", input.studentId, {
        error_trace: `enforcedStudentId=${enforcedStudentId} but input.studentId=${input.studentId}`,
      });
      enqueue(audit.entries);
      await await flush();
      return { ok: false, error: "身份不匹配，提交被拒绝", auditTrail: audit.entries };
    }
    // 1. Student Companion constructs the submission request
    const envelope = buildEnvelope({
      messageType: "submission_request",
      fromAgent,  // AGENT_CN.md S2.4: actual caller identity, not hardcoded
      toAgent: SUBMISSION_TASK_AGENT,
      payload: { student_id: input.studentId, challenge_id: input.challengeId, github_repo: input.githubRepoUrl },
      auditId: audit.traceId,
    });
    audit.log(WEBAPP_FALLBACK_STUDENT_AGENT, "send_submission_request", envelope.message_id);

    // 2. Inbox: verify trusted relationship before executing any skill
    if (!isTrusted(envelope.from_agent, envelope.to_agent)) {
      throw new Error("提交请求来自未受信任的 Agent，已拒绝");
    }
    audit.log(SUBMISSION_TASK_AGENT, "verify_relationship", envelope.from_agent);

    // T22: Deduplication — Redis when available, in-memory fallback
    const redis = getRedis();
    const dedupeRedisKey = `${DEDUPE_PREFIX}${dedupeKey}`;

    if (redis) {
      const existing = await redis.get(dedupeRedisKey);
      if (existing) {
        audit.log(SUBMISSION_TASK_AGENT, "duplicate_submission_rejected", dedupeKey);
        enqueue(audit.entries);
        await flush();
        return { ok: false, error: "重复提交，请勿重试", auditTrail: audit.entries };
      }
      await redis.setex(dedupeRedisKey, DEDUPE_TTL, Date.now().toString());
    } else {
      // In-memory fallback
      const lastTs = dedupeCache.get(dedupeKey);
      if (lastTs !== undefined && Date.now() - lastTs < DEDUPE_WINDOW_MS) {
        audit.log(SUBMISSION_TASK_AGENT, "duplicate_submission_rejected", dedupeKey);
        enqueue(audit.entries);
        await flush();
        return { ok: false, error: "重复提交，请勿重试", auditTrail: audit.entries };
      }
      dedupeCache.set(dedupeKey, Date.now());
    }

    // 3. Validate payload / identity / challenge state
    validateInput(input);
    const student = await feishu.getStudentById(input.studentId);
    audit.log(SUBMISSION_TASK_AGENT, "validate_student_identity", student.student_id);
    const challenge = await feishu.getChallengeById(input.challengeId);
    // T2: validate challenge is open for submission (backward compat: empty/null status = allowed)
    if (challenge.status && !["published", "active"].includes(challenge.status)) {
      audit.log(SUBMISSION_TASK_AGENT, "challenge_not_open", challenge.challenge_id, {
        after_state: { status: challenge.status },
      });
      throw new Error(`Challenge 未开放提交：${challenge.status}`);
    }
    audit.log(SUBMISSION_TASK_AGENT, "validate_challenge", challenge.challenge_id);

    // 4. Verify GitHub evidence pointer
    const githubCheck = await github.checkRepoHealth(input.githubRepoUrl);
    audit.log(SUBMISSION_TASK_AGENT, "verify_github_pointer", input.githubRepoUrl, {
      after_state: { repoExists: githubCheck.repoExists, score: githubCheck.score },
    });

    // Phase 2: Completeness check — verify required deliverables exist in repo
    const requiredDeliverablesStr = (challenge as { required_deliverables?: string }).required_deliverables;
    if (requiredDeliverablesStr && githubCheck.fileList && githubCheck.fileList.length > 0) {
      const patterns = requiredDeliverablesStr
        .split(/[,，\n]/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      if (patterns.length > 0) {
        const missing: string[] = [];
        for (const pattern of patterns) {
          const regex = new RegExp(
            "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
            "i"
          );
          const found = githubCheck.fileList.some(f => regex.test(f));
          if (!found) missing.push(pattern);
        }
        if (missing.length > 0) {
          // Clear dedup so student can retry after fixing files
          if (redis) {
            await redis.del(dedupeRedisKey).catch(() => {});
          } else {
            dedupeCache.delete(dedupeKey);
          }
          audit.log(SUBMISSION_TASK_AGENT, "completeness_check_failed", input.githubRepoUrl, {
            error_trace: `missing=[${missing.join(",")}] required=${patterns.length} found=${githubCheck.fileList.length}`,
          });
          enqueue(audit.entries);
          await flush();
          return { ok: false, error: `缺少交付物: ${missing.join("、")}。请补充后重新提交。`, auditTrail: audit.entries };
        }
        audit.log(SUBMISSION_TASK_AGENT, "completeness_check_passed", input.githubRepoUrl, {
          after_state: { completeness: "passed" as unknown },
        });
      }
    }

    // 5. Route based on review_mode (T6)
    const reviewMode = (() => {
      const raw = input.reviewMode || "teacher_only";
      const parsed = ReviewMode.safeParse(raw);
      return parsed.success ? parsed.data : "teacher_only";
    })();

    let routingStatus: string;
    let aiEvaluation: Awaited<ReturnType<typeof ai.evaluateSubmission>> | null = null;

    if (reviewMode === "teacher_only") {
      // Existing behavior: AI initial evaluation
      const reviewEnvelope = buildEnvelope({
        messageType: "review_request",
        fromAgent: SUBMISSION_TASK_AGENT,
        toAgent: REVIEW_TASK_AGENT,
        payload: { challenge_id: challenge.challenge_id, student_id: student.student_id },
        auditId: audit.traceId,
      });
      audit.log(SUBMISSION_TASK_AGENT, "route_to_review_task_agent", reviewEnvelope.message_id);
      aiEvaluation = await ai.evaluateSubmission({ student, challenge, submission: input, githubCheck });
      audit.log(REVIEW_TASK_AGENT, "generate_ai_evaluation", challenge.challenge_id, {
        after_state: { scoreTotal: aiEvaluation.scoreTotal },
      });
      routingStatus = "routed_to_teacher";
    } else if (reviewMode === "peer_only") {
      // P2: Peer review — peers allocated after submission record creation
      const peerEnvelope = buildEnvelope({
        messageType: "peer_review_request",
        fromAgent: SUBMISSION_TASK_AGENT,
        toAgent: REVIEW_TASK_AGENT,
        payload: { challenge_id: challenge.challenge_id, student_id: student.student_id, mode: "peer_only" },
        auditId: audit.traceId,
      });
      audit.log(SUBMISSION_TASK_AGENT, "route_to_peer_review", peerEnvelope.message_id);
      routingStatus = "routed_to_peer";
    } else {
      // teacher_and_peer: AI eval + peer
      aiEvaluation = await ai.evaluateSubmission({ student, challenge, submission: input, githubCheck });
      audit.log(REVIEW_TASK_AGENT, "generate_ai_evaluation", challenge.challenge_id, {
        after_state: { scoreTotal: aiEvaluation.scoreTotal },
      });

      const bothEnvelope = buildEnvelope({
        messageType: "peer_review_request",
        fromAgent: SUBMISSION_TASK_AGENT,
        toAgent: REVIEW_TASK_AGENT,
        payload: { challenge_id: challenge.challenge_id, student_id: student.student_id, mode: "teacher_and_peer" },
        auditId: audit.traceId,
      });
      audit.log(SUBMISSION_TASK_AGENT, "route_to_peer_review", bothEnvelope.message_id);
      routingStatus = "routed_to_both";
    }

    // 6. Submission Task Agent writes the final Submission Record (red line)
    const submission = await createSubmissionWithAgentFields(
      {
        student_id: student.student_id,
        student_name: student.name,
        challenge_id: challenge.challenge_id,
        project_title: input.projectTitle,
        project_summary: input.projectSummary,
        github_repo_url: input.githubRepoUrl,
        readme_url: input.readmeUrl || "",
        demo_url: input.demoUrl || "",
        aar_text: input.aarText,
        self_evaluation_text: input.selfEvaluationText,
        github_check_result: JSON.stringify(githubCheck, null, 2),
        status: githubCheck.repoExists ? "checked" : "needs_revision",
        is_public: input.isPublic,
        submitted_at: new Date().toISOString(),
      },
      {
        submitted_by_agent_id: fromAgent,
        processed_by_agent_id: SUBMISSION_TASK_AGENT,
        submission_task_agent_id: SUBMISSION_TASK_AGENT,
        admin_identity_mode: ADMIN_IDENTITY_MODE,
        submission_request_id: envelope.request_id,
        audit_log_pointer: audit.traceId,
        review_mode: reviewMode,
        routing_status: routingStatus,
        review_status: routingStatus === "routed_to_teacher" ? "pending_teacher_review" : routingStatus,
        system_validation_status: githubCheck.repoExists ? "passed" : "failed",
        routed_to_teacher_agent_id: routingStatus === "routed_to_teacher" ? REVIEW_TASK_AGENT : "",
        github_branch: input.githubBranch || githubCheck.defaultBranch || "",
        github_commit: githubCheck.latestCommitSha || "",
        github_repo: input.githubRepoUrl,
        updated_at: new Date().toISOString(),
        skills_used: "",  // populated by AI evaluation
      },
      audit,
    );
    audit.log(SUBMISSION_TASK_AGENT, "create_submission_record", String(submission.submission_id));

    // AGENT_CN.md §3.3: update ontology memory after successful submission.
    // Fire-and-forget — memory is a disposable snapshot, failure must not block.
    // TODO: merge skills_used with existing memory instead of overwriting.
    void updateStudentMemory(input.studentId, {
      active_challenge_id: challenge.challenge_id,
      learning_state: "submitted",
      last_submission: {
        submission_id: submission.submission_id,
        challenge_id: challenge.challenge_id,
        status: "submitted",
        ts: new Date().toISOString(),
      },
    }).catch(() => {});

    // P2: Peer allocation for peer_only and teacher_and_peer modes
    if (reviewMode === "peer_only" || reviewMode === "teacher_and_peer") {
      await allocatePeers(student, submission.submission_id, challenge.challenge_id, input.projectTitle, audit);
    }

    // Only AI evaluation for teacher_only mode; peer modes skip AI eval (TODO P2)
    if (aiEvaluation) {
      const evaluation = await feishu.createEvaluation({
        submission_id: submission.submission_id,
        student_id: student.student_id,
        challenge_id: challenge.challenge_id,
        evaluator_type: "ai",
        evaluator_id: REVIEW_TASK_AGENT,
        score_total: aiEvaluation.scoreTotal,
        scores_json: JSON.stringify(aiEvaluation.scores, null, 2),
        strengths: aiEvaluation.strengths,
        weaknesses: aiEvaluation.weaknesses,
        suggestions: aiEvaluation.suggestions,
        feedback: aiEvaluation.feedback,
        created_at: new Date().toISOString(),
      });
      audit.log(REVIEW_TASK_AGENT, "create_evaluation_record", String(evaluation.evaluation_id));

      const portfolioDescription = await ai.generatePortfolioDescription({
        student, challenge, submission: input, githubCheck, aiEvaluation,
      });
      const portfolioItem = await feishu.createPortfolioItem({
        student_id: student.student_id,
        student_name: student.name,
        submission_id: submission.submission_id,
        title: input.projectTitle,
        type: "project",
        summary: input.projectSummary,
        public_description: portfolioDescription.publicDescription,
        github_url: input.githubRepoUrl,
        demo_url: input.demoUrl || "",
        cover_image_url: "",
        skills: portfolioDescription.skills.join(", "),
        ai_feedback_summary: aiEvaluation.feedback,
        is_public: input.isPublic,
        created_at: new Date().toISOString(),
      });
      audit.log(SUBMISSION_TASK_AGENT, "create_portfolio_item", String(portfolioItem.portfolio_item_id));

      enqueue(audit.entries);
      await flush();
      // T8: notify student of submission success (with AI score)
      const notifyResult = await notifyStudent(input.studentId,
        `✅ 提交成功！你的项目「${input.projectTitle}」已提交。\\nAI 初评得分：${aiEvaluation.scoreTotal}/100\\n评语：${aiEvaluation.feedback}`
      );
      console.log("[T16 debug] notifyStudent result:", JSON.stringify(notifyResult));
      if (!notifyResult.ok) {
        const entry = audit.log(SUBMISSION_TASK_AGENT, "notify_failed", input.studentId, { error_trace: notifyResult.error });
        enqueue([entry]);
        await flush();
      }
      // Notify class group about new submission
      notifyGroup(
        `📢 新提交\\n学生：${student.name}\\n挑战：${challenge.title}\\n项目：${input.projectTitle}\\nAI 初评：${aiEvaluation.scoreTotal}/100`
      ).then((r) => {
        if (!r.ok) console.warn("[notify] group notification failed:", r.error);
      });
      return {
        ok: true,
        submissionId: submission.submission_id,
        evaluationId: evaluation.evaluation_id,
        portfolioItemId: portfolioItem.portfolio_item_id,
        githubCheck,
        aiEvaluation,
        auditTrail: audit.entries,
      };
    }

    enqueue(audit.entries);
    await flush();
    return {
      ok: true,
      submissionId: submission.submission_id,
      githubCheck,
      auditTrail: audit.entries,
    };
  } catch (error) {
    // Failed submissions must not block a corrected retry within the window.
    const redis = getRedis();
    if (redis) {
      await redis.del(`${DEDUPE_PREFIX}${dedupeKey}`).catch(() => {});
    } else {
      dedupeCache.delete(dedupeKey);
    }
    audit.log(SUBMISSION_TASK_AGENT, "workflow_failed", "submission", {
      error_trace: error instanceof Error ? error.message : String(error),
    });
    // T8: notify student of submission failure
    const errMsg = error instanceof Error ? error.message : "未知错误";
    const notifyResult = await notifyStudent(input.studentId, `❌ 提交失败：${errMsg}`);
    if (!notifyResult.ok) {
      const entry = audit.log(SUBMISSION_TASK_AGENT, "notify_failed", input.studentId, { error_trace: notifyResult.error });
      enqueue([entry]);
      await flush();
    }
    enqueue(audit.entries);
    await flush();
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown workflow error",
      auditTrail: audit.entries,
    };
  }
}
