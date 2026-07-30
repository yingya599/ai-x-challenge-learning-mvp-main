import { NextResponse } from "next/server";
import { submitChallengeProject } from "@/lib/server/workflow";
import type { SubmissionInput } from "@/lib/server/types";
import { getPrincipal } from "@/lib/server/principal";
import { AuditTrail, SUBMISSION_TASK_AGENT } from "@/lib/server/agents";
import { enqueue, flush } from "@/lib/server/audit-outbox";
import { busAdapter } from "@/lib/server/bus-adapter";
import { buildEnvelope } from "@/lib/server/agents";
import { createTask } from "@/lib/server/tasks";
import { makeId } from "@/lib/server/ids";
import { getBoundStudentId, isStaff } from "@/lib/server/rbac";

export async function POST(request: Request) {
  try {
    const principal = await getPrincipal();
    if (!principal) {
      return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
    }

    const input = (await request.json()) as SubmissionInput;

    // T03: Row-level permission — use bound student identity (works for both student and agent roles)
    const boundStudentId = getBoundStudentId(principal);
    if (boundStudentId !== null) {
      // Auto-fill studentId from session if not provided
      if (!input.studentId) {
        input.studentId = boundStudentId;
      }
      // Student or student-companion agent: can only submit as themselves
      if (input.studentId !== boundStudentId) {
        const audit = new AuditTrail();
        audit.log(SUBMISSION_TASK_AGENT, "identity_mismatch", input.studentId, {
          error_trace: `Principal ${principal.person} (role=${principal.role}) tried to submit as ${input.studentId}`,
        });
        enqueue(audit.entries);
        await flush();
        return NextResponse.json(
          { ok: false, error: "无权代他人提交", auditTrail: audit.entries },
          { status: 403 },
        );
      }
    } else if (!isStaff(principal)) {
      // Not bound to a student and not staff → reject
      return NextResponse.json(
        { ok: false, error: "无权提交" },
        { status: 403 },
      );
    }

    // Determine fromAgent based on principal
    const isAgentChannel = principal.role === "agent";
    const fromAgent = isAgentChannel
      ? principal.person // "student-companion-zhanghao-001" etc.
      : "student-companion-webapp-fallback";

    // AGENT_CN.md §8.2: Agent channels MUST go through Redis Stream (no sync fallback)
    // Check REAL availability — client object existing ≠ connection healthy
    const busAvailable = busAdapter.isAvailable();

    if (isAgentChannel && !busAvailable) {
      return NextResponse.json(
        { ok: false, error: "消息总线不可用，请稍后重试" },
        { status: 503 },
      );
    }

    // Publish to Stream if bus is available
    if (busAvailable) {
      const taskId = makeId("task");
      await createTask(taskId, "submission_request", input.studentId);

      const auditTraceId = makeId("audit");
      const payloadWithTask = { ...input as unknown as Record<string, unknown>, _taskId: taskId };
      const envelope = buildEnvelope({
        messageType: "submission_request",
        fromAgent,
        toAgent: SUBMISSION_TASK_AGENT,
        payload: payloadWithTask,
        auditId: auditTraceId,
      });

      // P3 T1: Publish via bus adapter (Redis | Hermes)
      const streamId = await busAdapter.publish(envelope);

      if (!streamId) {
        if (isAgentChannel) {
          return NextResponse.json(
            { ok: false, error: "消息发布失败，请稍后重试" },
            { status: 503 },
          );
        }
        // Webapp: Stream publish failed, fall back to sync
        console.warn("[submit] Stream publish failed, falling back to sync");
      } else {
        return NextResponse.json({
          ok: true,
          task_id: taskId,
          status: "pending",
          message: "提交已受理，正在处理中...",
        });
      }
    }

    // Sync fallback: webapp only (agent channels blocked above)
    const result = await submitChallengeProject(
      input,
      isAgentChannel ? principal.person : undefined,
      boundStudentId ?? undefined,
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Submit failed" },
      { status: 500 },
    );
  }
}
