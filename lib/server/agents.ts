// Agent identity layer — implements AGENT_CN.md §2 (agents must have identity)
// and Agent-inbox Trusted Relationship model, backed by Team3 zod schemas.
import {
  MessageEnvelopeSchema,
  AuditLogSchema,
  TrustedRelationshipSchema,
  StudentCompanionManifestSchema,
  TeacherCompanionManifestSchema,
  SubmissionTaskAgentManifestSchema,
  ReviewTaskAgentManifestSchema,
  type MessageEnvelope,
  type AuditLog,
  type TrustedRelationship,
} from "../schemas/zod-from-schemas";
import { isTrustedV2 } from "./service-principal";
import { ManifestOwnerSchema, type ManifestOwner } from "../schemas/envelope-v2.schema";

// ---- Agent identities (WebApp fallback mode, whitepaper §7.4 phase 1) ----
export const WEBAPP_FALLBACK_STUDENT_AGENT = "student-companion-webapp-fallback";
export const SUBMISSION_TASK_AGENT = "submission-task-agent-001";
export const REVIEW_TASK_AGENT = "review-task-agent-001";
export const WEBAPP_FALLBACK_TEACHER_AGENT = "teacher-companion-webapp-fallback";
export const ADMIN_IDENTITY_MODE = "teacher_delegated" as const;

// ---- Agent Manifests (T4: loaded and validated at import time) ----
// AGENT_CN.md §2.1: owner + memory_binding are required on every manifest.
// Team3 schemas are .strict() and reject unknown fields, so we strip owner
// before passing to Team3 parse, then validate it separately.
import studentManifestRaw from "../../agents/manifests/student-companion-webapp-fallback.json";
import submissionManifestRaw from "../../agents/manifests/submission-task-agent-001.json";
import reviewManifestRaw from "../../agents/manifests/review-task-agent-001.json";
import teacherManifestRaw from "../../agents/manifests/teacher-companion-webapp-fallback.json";
import nseapManifestRaw from "../../agents/manifests/nseap-student-companion.json";
import workbuddyManifestRaw from "../../agents/manifests/workbuddy-teacher-companion.json";
import zhanghaoManifestRaw from "../../agents/manifests/student-companion-zhanghao-001.json";

/** Parse a manifest with owner field support (AGENT_CN.md §2.1).
 *  Team3 schemas are .strict() — owner is unknown to them, so we strip it,
 *  pass the rest to Team3 parse, then validate owner with our own schema.
 *  If owner is missing, we produce a readable error instead of a bare ZodError. */
function parseManifestWithOwner<T>(
  raw: unknown,
  team3Schema: { parse: (data: unknown) => T },
  agentId: string,
): T & { owner: ManifestOwner } {
  const obj = raw as Record<string, unknown>;
  const { owner, ...core } = obj;

  const manifest = team3Schema.parse(core);

  if (!owner) {
    throw new Error(
      `Manifest "${agentId}" is missing required "owner" field (AGENT_CN.md §2.1). ` +
      `Add: { "owner_type": "student"|"teacher"|"system", "owner_id": "<id>" }`
    );
  }

  let ownerParsed: ManifestOwner;
  try {
    ownerParsed = ManifestOwnerSchema.parse(owner);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Manifest "${agentId}" owner field is invalid: ${msg}. ` +
      `Expected: { "owner_type": "student"|"teacher"|"system", "owner_id": "<id>" }`
    );
  }

  return { ...manifest, owner: ownerParsed };
}

export const STUDENT_COMPANION_MANIFEST = parseManifestWithOwner(studentManifestRaw, StudentCompanionManifestSchema, "student-companion-webapp-fallback");
export const SUBMISSION_TASK_MANIFEST = parseManifestWithOwner(submissionManifestRaw, SubmissionTaskAgentManifestSchema, "submission-task-agent-001");
export const REVIEW_TASK_MANIFEST = parseManifestWithOwner(reviewManifestRaw, ReviewTaskAgentManifestSchema, "review-task-agent-001");
export const TEACHER_COMPANION_MANIFEST = parseManifestWithOwner(teacherManifestRaw, TeacherCompanionManifestSchema, "teacher-companion-webapp-fallback");
export const NSEAP_STUDENT_MANIFEST = parseManifestWithOwner(nseapManifestRaw, StudentCompanionManifestSchema, "student-companion-nseap");
/** @deprecated Use NSEAP_STUDENT_MANIFEST instead. */
export const HERMES_STUDENT_MANIFEST = NSEAP_STUDENT_MANIFEST;
export const WORKBUDDY_TEACHER_MANIFEST = parseManifestWithOwner(workbuddyManifestRaw, TeacherCompanionManifestSchema, "workbuddy-teacher-companion");
export const ZHANGHAO_STUDENT_MANIFEST = parseManifestWithOwner(zhanghaoManifestRaw, StudentCompanionManifestSchema, "student-companion-zhanghao-001");

// ---- Trusted Relationship graph (Agent-inbox 7.6 supplement) ----
export const TRUSTED_RELATIONSHIPS: TrustedRelationship[] = [
  {
    relationship_id: "rel-webapp-to-submission",
    agent_a: WEBAPP_FALLBACK_STUDENT_AGENT,
    agent_b: SUBMISSION_TASK_AGENT,
    relationship_type: "task-agent",
    trust_level: "auto",
    permissions: ["submission_request"],
    expiration: null,
  },
  {
    relationship_id: "rel-submission-to-review",
    agent_a: SUBMISSION_TASK_AGENT,
    agent_b: REVIEW_TASK_AGENT,
    relationship_type: "task-agent",
    trust_level: "auto",
    permissions: ["review_request"],
    expiration: null,
  },
  {
    relationship_id: "rel-teacher-to-submission",
    agent_a: WEBAPP_FALLBACK_TEACHER_AGENT,
    agent_b: SUBMISSION_TASK_AGENT,
    relationship_type: "task-agent",
    trust_level: "auto",
    permissions: ["challenge_publish"],
    expiration: null,
  },
].map((r) => TrustedRelationshipSchema.parse(r));

export function isTrusted(fromAgent: string, toAgent: string): boolean {
  // T21: Delegate to Service Principal-based trust check
  // Old hardcoded list is kept as comment for reference
  return isTrustedV2(fromAgent, toAgent);
}

// ---- Extended message types (not in Team3 enum, v3.1 additions) ----
export const EXTENDED_MESSAGE_TYPES = ["manual_review_adjustment", "peer_review_request"] as const;
export type ExtendedMessageType = (typeof EXTENDED_MESSAGE_TYPES)[number];
export type AllMessageTypes = MessageEnvelope["message_type"] | ExtendedMessageType;

// ---- Message envelope (AGENT_CN.md §8: no identity-less messages) ----
let seq = 0;
function uid(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

import { createHmac } from "crypto";
import { optionalEnv } from "./env";

function signEnvelope(messageId: string, timestamp: string): string | undefined {
  const secret = optionalEnv("SESSION_SECRET");
  if (!secret) return undefined;
  return createHmac("sha256", secret)
    .update(messageId + timestamp)
    .digest("hex");
}

export function buildEnvelope(params: {
  messageType: AllMessageTypes;
  fromAgent: string;
  toAgent: string;
  payload: Record<string, unknown>;
  auditId: string;
}): MessageEnvelope {
  const messageId = uid("msg");
  const timestamp = new Date().toISOString();
  const signature = signEnvelope(messageId, timestamp);

  // For extended types, use relaxed validation (skip strict MessageType enum check)
  const raw = {
    message_id: messageId,
    request_id: uid("req"),
    from_agent: params.fromAgent,
    to_agent: params.toAgent,
    message_type: params.messageType,
    timestamp,
    payload: params.payload,
    audit_trace_pointer: params.auditId,
    ...(signature ? { signature } : {}),
  };

  // Relaxed parse: allow extended message types
  try {
    return MessageEnvelopeSchema.parse(raw);
  } catch {
    // Extended type: strip message_type for schema check, then restore
    const { message_type, ...rest } = raw;
    const base = MessageEnvelopeSchema.omit({ message_type: true }).parse(rest);
    return { ...base, message_type } as MessageEnvelope;
  }
}

// ---- Audit trail (AGENT_CN.md §8.2: no state change without audit trace) ----
export class AuditTrail {
  readonly traceId = uid("audit");
  readonly entries: AuditLog[] = [];

  log(agentId: string, action: string, targetResource: string, extra?: Partial<AuditLog>) {
    const entry = AuditLogSchema.parse({
      audit_id: uid("audit"),
      timestamp: new Date().toISOString(),
      agent_id: agentId,
      action,
      target_resource: targetResource,
      ...extra,
    });
    this.entries.push(entry);
    console.log(`[audit] ${entry.agent_id} ${entry.action} ${entry.target_resource}`);
    return entry;
  }
}
