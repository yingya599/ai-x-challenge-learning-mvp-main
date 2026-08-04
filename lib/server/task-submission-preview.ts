import { createHash } from "crypto";
import { signToken, verifyToken } from "./principal";
import type {
  AiEvaluation,
  EvidenceItem,
  EvidenceRequirement,
  PersonalTask,
  UploadedTaskFile,
} from "./types";

export type TaskSubmissionDraft = {
  result_summary: string;
  aar_text: string;
  self_evaluation_text: string;
  evidence_items: EvidenceItem[];
  uploaded_files: UploadedTaskFile[];
};

const PREVIEW_KIND = "task-ai-review-preview-v1";
const PREVIEW_MAX_AGE_MS = 30 * 60 * 1000;

function validUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseRequirements(value?: string): EvidenceRequirement[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeTaskSubmissionDraft(body: Record<string, unknown>): TaskSubmissionDraft {
  return {
    result_summary: String(body.result_summary || "").trim(),
    aar_text: String(body.aar_text || "").trim(),
    self_evaluation_text: String(body.self_evaluation_text || "").trim(),
    evidence_items: Array.isArray(body.evidence_items) ? body.evidence_items as EvidenceItem[] : [],
    uploaded_files: Array.isArray(body.uploaded_files) ? body.uploaded_files as UploadedTaskFile[] : [],
  };
}

export function validateTaskSubmissionDraft(task: PersonalTask, draft: TaskSubmissionDraft): string | null {
  if (!draft.result_summary) return "请填写成果摘要";
  if (draft.evidence_items.some((item) => !item.type || !item.label?.trim() || !validUrl(item.url))) {
    return "每项交付证据都需要类型、名称和有效的 http/https 链接";
  }
  if (draft.uploaded_files.some((item) => !item.file_token || !item.name?.trim() || !item.evidence_type)) {
    return "上传文件信息不完整，请重新选择文件";
  }
  const missing = parseRequirements(task.evidence_requirements_json).filter((requirement) => requirement.required
    && !draft.evidence_items.some((item) => item.type === requirement.type)
    && !draft.uploaded_files.some((item) => item.evidence_type === requirement.type));
  return missing.length ? `缺少必交成果：${missing.map((item) => item.label).join("、")}` : null;
}

function draftHash(draft: TaskSubmissionDraft) {
  return createHash("sha256").update(JSON.stringify(draft)).digest("hex");
}

export function createAiReviewPreviewToken(input: {
  studentId: string;
  taskId: string;
  draft: TaskSubmissionDraft;
  evaluation: AiEvaluation;
}) {
  return signToken({
    kind: PREVIEW_KIND,
    person: input.studentId,
    task_id: input.taskId,
    draft_hash: draftHash(input.draft),
    evaluation_json: JSON.stringify(input.evaluation),
    issued_at: String(Date.now()),
  });
}

export function verifyAiReviewPreviewToken(input: {
  token: string;
  studentId: string;
  taskId: string;
  draft: TaskSubmissionDraft;
}): AiEvaluation | null {
  const payload = verifyToken(input.token);
  if (!payload || payload.kind !== PREVIEW_KIND || payload.person !== input.studentId || payload.task_id !== input.taskId) return null;
  if (payload.draft_hash !== draftHash(input.draft)) return null;
  const issuedAt = Number(payload.issued_at || 0);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > PREVIEW_MAX_AGE_MS) return null;
  try {
    return JSON.parse(payload.evaluation_json) as AiEvaluation;
  } catch {
    return null;
  }
}
