// Challenge publish workflow — teacher publishes a new Challenge via
// teacher-companion-webapp-fallback, through trusted relationship to
// Submission Task Agent, which writes to Feishu Challenges table.
// Every state change carries an audit entry (AGENT_CN.md §8.2).
import * as feishu from "./feishu";
import {
  AuditTrail,
  buildEnvelope,
  isTrusted,
  SUBMISSION_TASK_AGENT,
  WEBAPP_FALLBACK_TEACHER_AGENT,
} from "./agents";
import { enqueue, flush } from "./audit-outbox";
import { notifyGroup } from "./notify";

export interface PublishChallengeInput {
  title: string;
  brief?: string;
  objective?: string;
  deliverables: string;
  rubric: string;
  required_deliverables?: string;
  rubric_dimensions?: string;
  deadline: string;
}

export interface PublishChallengeResult {
  ok: boolean;
  challengeId?: string;
  error?: string;
  missingFields?: string[];
  auditTrail?: unknown[];
}

export async function publishChallenge(input: PublishChallengeInput): Promise<PublishChallengeResult> {
  const audit = new AuditTrail();

  // 1. Validate required fields (AGENT_CN §4.4)
  const missing: string[] = [];
  if (!input.title?.trim()) missing.push("title（标题）");
  if (!input.deadline?.trim()) missing.push("deadline（截止时间）");
  if (!input.deliverables?.trim()) missing.push("deliverables（交付物）");
  if (!input.rubric?.trim()) missing.push("rubric（评分标准）");

  if (missing.length > 0) {
    audit.log(WEBAPP_FALLBACK_TEACHER_AGENT, "challenge_publish_validation_failed", "challenge", {
      error_trace: `Missing fields: ${missing.join(", ")}`,
    });
    enqueue(audit.entries);
    await flush();
    return {
      ok: false,
      error: "缺少必填项",
      missingFields: missing,
      auditTrail: audit.entries,
    };
  }

  try {
    // 2. Teacher Companion constructs the challenge_publish request
    const envelope = buildEnvelope({
      messageType: "challenge_publish",
      fromAgent: WEBAPP_FALLBACK_TEACHER_AGENT,
      toAgent: SUBMISSION_TASK_AGENT,
      payload: {
        title: input.title,
        brief: input.brief || "",
        objective: input.objective || "",
        deliverables: input.deliverables,
        rubric: input.rubric,
        deadline: input.deadline,
      },
      auditId: audit.traceId,
    });
    audit.log(WEBAPP_FALLBACK_TEACHER_AGENT, "send_challenge_publish_request", envelope.message_id);

    // 3. Trust check: teacher → submission-task
    if (!isTrusted(envelope.from_agent, envelope.to_agent)) {
      throw new Error("发布请求来自未受信任的 Agent，已拒绝");
    }
    audit.log(SUBMISSION_TASK_AGENT, "verify_relationship_challenge", envelope.from_agent);

    // 4. Write to Feishu Challenges table
    const feishuFields: Record<string, unknown> = {
      title: input.title,
      brief: input.brief || "",
      objective: input.objective || "",
      deliverables: input.deliverables,
      rubric: input.rubric,
      required_deliverables: input.required_deliverables || "",
      deadline: input.deadline,
      status: "published",
      created_by: WEBAPP_FALLBACK_TEACHER_AGENT,
      teacher_agent_id: WEBAPP_FALLBACK_TEACHER_AGENT,
    };
    // Only include rubric_dimensions if provided (column may not exist yet)
    if (input.rubric_dimensions) {
      feishuFields.rubric_dimensions = input.rubric_dimensions;
    }
    const challenge = await feishu.createChallenge(feishuFields);
    audit.log(SUBMISSION_TASK_AGENT, "create_challenge_record", String(challenge.challenge_id));

    // T8: notify class group about new challenge
    notifyGroup(`📢 新 Challenge 已发布！
标题：${input.title}
简介：${input.brief || "暂无"}
截止时间：${input.deadline}
交付物：${input.deliverables}
请同学们及时查看并提交！`).then(async (result) => {
      if (!result.ok && !result.skipped) {
        const entry = audit.log(WEBAPP_FALLBACK_TEACHER_AGENT, "notify_failed", "group", { error_trace: result.error });
        enqueue([entry]);
        await flush();
      }
    });

    enqueue(audit.entries);
    await flush();
    return {
      ok: true,
      challengeId: challenge.challenge_id,
      auditTrail: audit.entries,
    };
  } catch (error) {
    audit.log(SUBMISSION_TASK_AGENT, "challenge_publish_failed", "challenge", {
      error_trace: error instanceof Error ? error.message : String(error),
    });
    enqueue(audit.entries);
    await flush();
    return {
      ok: false,
      error: error instanceof Error ? error.message : "发布失败",
      auditTrail: audit.entries,
    };
  }
}
