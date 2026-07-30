/**
 * Zod Schemas - 从 JSON Schema 派生，用于 Next.js / TypeScript 运行时校验
 *
 * 这个文件不是从 OWL 生成的（OWL 是设计期），而是 JSON Schema 的 TypeScript 表示
 * 可以直接用 zod 替代，或在 Zod 不可用时直接用类型断言
 *
 * 对应源: ontology/schemas/ 下的 *.schema.json
 */

import { z } from 'zod';

// ====================================================================
// 枚举定义
// ====================================================================

export const AdminIdentityMode = z.enum(['independent_admin', 'teacher_delegated']);
export type AdminIdentityModeType = z.infer<typeof AdminIdentityMode>;

export const ReviewMode = z.enum(['teacher_only', 'peer_only', 'teacher_and_peer']);
export type ReviewModeType = z.infer<typeof ReviewMode>;

export const RoutingStatus = z.enum(['not_routed', 'routed_to_teacher', 'routed_to_peer', 'routed_to_both']);
export type RoutingStatusType = z.infer<typeof RoutingStatus>;

export const SubmissionStatus = z.enum([
  'draft', 'submitted', 'validating', 'needs_revision',
  'checked', 'pending_review', 'under_review', 'reviewed',
  'pending_teacher_review', 'accepted', 'needs_teacher_revision'
]);
export type SubmissionStatusType = z.infer<typeof SubmissionStatus>;

export const ReviewStatus = z.enum([
  'submitted', 'peer-reviewed', 'agent-reviewed',
  'needs-revision', 'accepted', 'knowledge-candidate'
]);
export type ReviewStatusType = z.infer<typeof ReviewStatus>;

export const ChallengeStatus = z.enum(['draft', 'published', 'active', 'closed', 'archived']);
export type ChallengeStatusType = z.infer<typeof ChallengeStatus>;

export const MessageType = z.enum([
  'challenge_publish', 'challenge_available', 'submission_request',
  'review_request', 'review_result', 'feedback', 'status_update',
  'final_adjustment', 'peer_review_request'
]);
export type MessageTypeType = z.infer<typeof MessageType>;

export const AgentType = z.enum([
  'student-companion', 'teacher-companion', 'submission-task',
  'review-task', 'peer-review'
]);
export type AgentTypeType = z.infer<typeof AgentType>;

export const ChannelType = z.enum(['web', 'github', 'feishu']);
export type ChannelTypeType = z.infer<typeof ChannelType>;

export const TrustLevel = z.enum(['auto', 'require-approval', 'denied']);
export type TrustLevelType = z.infer<typeof TrustLevel>;

export const ArtifactType = z.enum([
  'GitHubRepo', 'README', 'Demo', 'DesignDoc',
  'PromptLog', 'ContextPack', 'AAR', 'SelfEvaluation', 'PortfolioPage'
]);
export type ArtifactTypeType = z.infer<typeof ArtifactType>;

// ====================================================================
// Submission Record (PRD §8.2, 25 字段)
// ====================================================================

export const SubmissionRecordSchema = z.object({
  submission_id: z.string().regex(/^sub-[a-zA-Z0-9-]+$/),
  submission_request_id: z.string().regex(/^req-[a-zA-Z0-9-]+$/),
  challenge_id: z.string(),
  student_id: z.string(),
  submitted_by_agent_id: z.string(),
  student_feishu_bot_id: z.string(),
  processed_by_agent_id: z.string().regex(/^submission-task-.*$/, {
    message: '🔴 RED-001: processedByAgentId MUST start with submission-task-'
  }),
  submission_task_agent_id: z.string(),
  admin_identity_mode: AdminIdentityMode,
  admin_user_id: z.string(),
  github_repo: z.string().regex(/^https:\/\/github\.com\/[\w-]+\/[\w-]+\/?$/),
  github_branch: z.string(),
  github_commit: z.string().regex(/^[a-f0-9]{7,40}$/).optional(),
  submitted_files: z.array(z.string()).min(1),
  self_reflection_pointer: z.string(),
  skills_used: z.array(z.string().regex(/^SK-\d{2}$/)),
  ontology_nodes_used: z.array(z.string()).optional(),
  system_validation_status: SubmissionStatus.exclude(['draft']),
  review_mode: ReviewMode,
  routed_to_teacher_agent_id: z.string().optional(),
  routed_to_peer_agent_ids: z.array(z.string()).optional(),
  routing_status: RoutingStatus,
  review_status: ReviewStatus,
  feedback_pointer: z.string(),
  audit_log_pointer: z.string().regex(/^audit-[a-zA-Z0-9-]+$/, {
    message: '🔴 RED-008: audit_log_pointer is required'
  }),
  submitted_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).strict();

export type SubmissionRecord = z.infer<typeof SubmissionRecordSchema>;


// ====================================================================
// Challenge Record (PRD §8.1, 16 字段)
// ====================================================================

export const ChallengeRecordSchema = z.object({
  challenge_id: z.string().regex(/^C\d{2,}-[a-zA-Z0-9-]+$/),
  title: z.string().min(1),
  description: z.string().min(1),
  teacher_id: z.string(),
  teacher_agent_id: z.string().regex(/^teacher-companion-.*$/),
  feishu_group_id: z.string().optional(),
  github_pointer: z.string().optional(),
  airtable_record_id: z.string().optional(),
  ontology_nodes: z.array(z.string()).min(1),
  skills: z.array(z.string().regex(/^SK-\d{2}$/)).min(1),
  learning_objectives: z.array(z.string()).min(1),
  required_deliverables: z.array(ArtifactType).min(1),
  rubric_pointer: z.string(),
  due_date: z.string().datetime(),
  status: ChallengeStatus,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).strict();

export type ChallengeRecord = z.infer<typeof ChallengeRecordSchema>;

// ====================================================================
// MessageEnvelope
// ====================================================================

export const MessageEnvelopeSchema = z.object({
  message_id: z.string().regex(/^msg-[a-zA-Z0-9]{8,}$/),
  request_id: z.string().regex(/^req-[a-zA-Z0-9-]+$/),
  from_agent: z.string(),
  to_agent: z.string(),
  message_type: MessageType,
  timestamp: z.string().datetime(),
  payload: z.object({}).passthrough(),  // 实际 payload 由 message-payloads 校验
  routing_metadata: z.object({
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
    ttl_seconds: z.number().int().positive().optional(),
    retry_count: z.number().int().min(0).optional(),
    requires_ack: z.boolean().optional(),
  }).optional(),
  audit_trace_pointer: z.string().regex(/^audit-[a-zA-Z0-9-]+$/, {
    message: '🔴 RED-008: audit_trace_pointer is required'
  }),
  signature: z.string().optional(),
  correlation_id: z.string().optional(),
}).strict();

export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>;

// ====================================================================
// Agent Manifest
// ====================================================================

export const AgentManifestSchema = z.object({
  agent_id: z.string().regex(/^(student-companion-|teacher-companion-|submission-task|review-task|peer-review-).*$/),
  agent_type: AgentType,
  manifest_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  display_name: z.string().optional(),
  description: z.string().optional(),
  capabilities: z.array(z.object({
    capability_id: z.string(),
    name: z.string(),
    description: z.string().optional(),
  })).min(1),
  interfaces: z.array(z.object({
    interface_name: z.string(),
    input_schema: z.object({}).passthrough().optional(),
    output_schema: z.object({}).passthrough().optional(),
  })),
  permissions: z.array(z.object({
    permission_id: z.string(),
    scope: z.string(),
  })),
  trusted_agents: z.array(z.string()),
  memory_binding: z.array(z.object({
    ontology_path: z.string(),
  })).optional(),
  channel_bindings: z.array(z.object({
    channel_type: ChannelType,
    channel_id: z.string(),
  })).min(1),
  constraints: z.object({}).passthrough().optional(),
  admin_identity_mode: AdminIdentityMode.optional(),
}).strict();

export type AgentManifest = z.infer<typeof AgentManifestSchema>;

// ====================================================================
// Student Companion Manifest（🔴 RED-002 强制）
// ====================================================================

export const StudentCompanionManifestSchema = AgentManifestSchema.refine(
  (m) => m.agent_type === 'student-companion',
  { message: 'agent_type must be student-companion' }
).refine(
  (m) => !m.permissions.some((p) => p.scope.includes('submission') && p.scope.includes('write')),
  { message: '🔴 RED-002: StudentCompanion MUST NOT have submission write permission' }
);

// ====================================================================
// Teacher Companion Manifest（🔴 RED-003 强制）
// ====================================================================

export const TeacherCompanionManifestSchema = AgentManifestSchema.refine(
  (m) => m.agent_type === 'teacher-companion',
  { message: 'agent_type must be teacher-companion' }
).refine(
  (m) => !m.permissions.some((p) => p.scope.includes('student_memory') && p.scope.includes('read')),
  { message: '🔴 RED-003: TeacherCompanion MUST NOT have student_memory read permission' }
);

// ====================================================================
// Submission Task Agent Manifest（🔴 RED-001 强制）
// ====================================================================

export const SubmissionTaskAgentManifestSchema = AgentManifestSchema.refine(
  (m) => m.agent_type === 'submission-task',
  { message: 'agent_type must be submission-task' }
).refine(
  (m) => m.admin_identity_mode !== undefined,
  { message: 'SubmissionTaskAgent MUST have admin_identity_mode' }
);

// ====================================================================
// Review Task Agent Manifest
// ====================================================================

export const ReviewTaskAgentManifestSchema = AgentManifestSchema.refine(
  (m) => m.agent_type === 'review-task',
  { message: 'agent_type must be review-task' }
);

// ====================================================================
// Audit Log
// ====================================================================

export const AuditLogSchema = z.object({
  audit_id: z.string().regex(/^audit-[a-zA-Z0-9-]+$/),
  timestamp: z.string().datetime(),
  agent_id: z.string(),
  action: z.string(),  // 18 个枚举值
  target_resource: z.string(),
  before_state: z.unknown().optional(),
  after_state: z.unknown().optional(),
  routing_path: z.array(z.string()).optional(),
  related_message_id: z.string().optional(),
  error_trace: z.unknown().optional(),
}).strict();

export type AuditLog = z.infer<typeof AuditLogSchema>;

// ====================================================================
// Trusted Relationship
// ====================================================================

export const TrustedRelationshipSchema = z.object({
  relationship_id: z.string(),
  agent_a: z.string(),
  agent_b: z.string(),
  relationship_type: z.enum(['companion', 'task-agent', 'peer']),
  trust_level: TrustLevel,
  permissions: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  expiration: z.string().datetime().nullable().optional(),
  last_verified: z.string().datetime().optional(),
}).strict();

export type TrustedRelationship = z.infer<typeof TrustedRelationshipSchema>;

// ====================================================================
// AAR (After Action Review)
// ====================================================================

export const AARSchema = z.object({
  challenge_id: z.string(),
  student_id: z.string(),
  task: z.string(),
  expected_result: z.string(),
  actual_result: z.string(),
  what_worked: z.string(),
  what_failed: z.string(),
  lesson_learned: z.string(),
  skill_update: z.string(),
  memory_update: z.string(),
  next_action: z.string(),
}).strict();

export type AAR = z.infer<typeof AARSchema>;

// ====================================================================
// Skill (10 个 MVP 首批)
// ====================================================================

export const SkillInputSchema = z.object({
  skill_id: z.string().regex(/^SK-\d{2}$/),
  skill_name: z.string(),
  description: z.string(),
  input_schema: z.object({}).passthrough(),
  output_schema: z.object({}).passthrough(),
  required_context: z.array(z.string()),
  required_permissions: z.array(z.string()),
  linked_task_agent: z.string(),
  linked_ontology: z.array(z.string()),
  evaluation_rubric: z.string().optional(),
  action_plan: z.string().optional(),
  constraints: z.object({}).passthrough().optional(),
  learning_signals: z.object({}).passthrough().optional(),
}).strict();

export type SkillInput = z.infer<typeof SkillInputSchema>;

// ====================================================================
// 10 个具体 Skill（每个有专属 I/O）
// ====================================================================

// SK-01: ExcelImportSkill
export const ExcelImportSkillInput = SkillInputSchema.extend({
  skill_id: z.literal('SK-01'),
  skill_name: z.literal('ExcelImportSkill'),
  abstract_type: z.literal('FeishuSkill'),
  file_path: z.string(),
  cohort_id: z.string(),
  admin_user_id: z.string(),
});
export const ExcelImportSkillOutput = z.object({
  imported_students: z.array(z.object({
    student_id: z.string(),
    name: z.string(),
    school: z.string(),
    major: z.string(),
    feishu_id: z.string(),
    github_username: z.string(),
  })),
  failed_rows: z.array(z.number().int()),
  feishu_record_ids: z.array(z.string()),
}).strict();

// SK-09: FeishuSubmissionSkill (RED-002 关联)
export const FeishuSubmissionSkillInput = SkillInputSchema.extend({
  skill_id: z.literal('SK-09'),
  skill_name: z.literal('FeishuSubmissionSkill'),
  abstract_type: z.literal('FeishuSkill'),
  challenge_id: z.string(),
  student_id: z.string(),
  submitted_files: z.array(z.string()).min(1),
  github_repo: z.string(),
  github_branch: z.string(),
  github_commit: z.string(),
  self_reflection: z.string(),
  skills_used: z.array(z.string()),
});

// ====================================================================
// Inbox 10 步校验（业务规则）
// ====================================================================

export const InboxStepSchema = z.enum([
  'receive',
  'identity_check',
  'signature_check',
  'trust_check',
  'permission_check',
  'deduplication',
  'ttl_check',
  'queue_routing',
  'process_execute',
  'audit_and_ack',
]);
export type InboxStep = z.infer<typeof InboxStepSchema>;

// ====================================================================
// 校验函数
// ====================================================================

export function validateSubmissionRecord(data: unknown): {
  valid: boolean;
  errors?: z.ZodError;
  data?: SubmissionRecord;
} {
  const result = SubmissionRecordSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}

export function validateChallengeRecord(data: unknown): {
  valid: boolean;
  errors?: z.ZodError;
  data?: ChallengeRecord;
} {
  const result = ChallengeRecordSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}

export function validateMessageEnvelope(data: unknown): {
  valid: boolean;
  errors?: z.ZodError;
  data?: MessageEnvelope;
} {
  const result = MessageEnvelopeSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}

export function validateAgentManifest(data: unknown): {
  valid: boolean;
  errors?: z.ZodError;
  data?: AgentManifest;
} {
  const result = AgentManifestSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}

// 🔴 RED 编译时检查：确保 4 个 Agent 都有 Manifest Schema
export const AGENT_MANIFESTS = {
  student: StudentCompanionManifestSchema,
  teacher: TeacherCompanionManifestSchema,
  submission: SubmissionTaskAgentManifestSchema,
  review: ReviewTaskAgentManifestSchema,
} as const;

export type AgentManifestSchemaType =
  | z.infer<typeof StudentCompanionManifestSchema>
  | z.infer<typeof TeacherCompanionManifestSchema>
  | z.infer<typeof SubmissionTaskAgentManifestSchema>
  | z.infer<typeof ReviewTaskAgentManifestSchema>;
