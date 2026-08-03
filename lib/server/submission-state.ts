// Submission 业务状态机（P0-2）
// status 是业务真相；task_state 只用于展示异步处理进度，不能单独决定业务结果。

export const SUBMISSION_STATUSES = [
  "draft",
  "submitted",
  "validating",
  "needs_revision",
  "checked",
  "pending_review",
  "under_review",
  "reviewed",
  "pending_teacher_review",
  "accepted",
  "needs_teacher_revision",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export type TeacherReviewAction = "accept" | "return";

const STATUS_SET = new Set<string>(SUBMISSION_STATUSES);

const TASK_STATE_TO_STATUS: Record<string, SubmissionStatus> = {
  RECEIVED: "submitted",
  VALIDATING: "validating",
  CHECK_FAILED: "needs_revision",
  CHECKED: "checked",
  PENDING_REVIEW: "pending_review",
  UNDER_REVIEW: "under_review",
  REVIEWED: "reviewed",
  PENDING_TEACHER_REVIEW: "pending_teacher_review",
  COMPLETED: "accepted",
  RETURNED_FOR_REVISION: "needs_teacher_revision",
};

const TASK_STATE_BY_STATUS: Record<SubmissionStatus, string> = {
  draft: "DRAFT",
  submitted: "RECEIVED",
  validating: "VALIDATING",
  needs_revision: "CHECK_FAILED",
  checked: "CHECKED",
  pending_review: "PENDING_REVIEW",
  under_review: "UNDER_REVIEW",
  reviewed: "REVIEWED",
  pending_teacher_review: "PENDING_TEACHER_REVIEW",
  accepted: "COMPLETED",
  needs_teacher_revision: "RETURNED_FOR_REVISION",
};

const ALLOWED_TRANSITIONS: Record<SubmissionStatus, ReadonlySet<SubmissionStatus>> = {
  draft: new Set(["submitted"]),
  submitted: new Set(["validating"]),
  validating: new Set(["checked", "needs_revision"]),
  checked: new Set(["pending_review", "pending_teacher_review"]),
  pending_review: new Set(["under_review"]),
  under_review: new Set(["reviewed", "needs_revision"]),
  reviewed: new Set(["pending_teacher_review", "accepted", "needs_revision"]),
  pending_teacher_review: new Set(["accepted", "needs_teacher_revision"]),
  // 终态 Submission 不允许原位重开；学生重提必须创建新的 Submission。
  needs_revision: new Set(),
  accepted: new Set(),
  needs_teacher_revision: new Set(),
};

export function normalizeSubmissionStatus(
  status?: string,
  taskState?: string,
): SubmissionStatus | null {
  const normalizedStatus = status?.trim();
  if (normalizedStatus && STATUS_SET.has(normalizedStatus)) {
    return normalizedStatus as SubmissionStatus;
  }

  const normalizedTaskState = taskState?.trim().toUpperCase();
  return normalizedTaskState ? TASK_STATE_TO_STATUS[normalizedTaskState] || null : null;
}

export function taskStateFor(status: SubmissionStatus): string {
  return TASK_STATE_BY_STATUS[status];
}

export function canTransition(
  current: SubmissionStatus,
  next: SubmissionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[current].has(next);
}

export function assertTransition(
  current: SubmissionStatus,
  next: SubmissionStatus,
): void {
  if (!canTransition(current, next)) {
    throw new Error(`非法 Submission 状态转换：${current} → ${next}`);
  }
}

export function isTerminalSubmissionStatus(status: SubmissionStatus): boolean {
  return ALLOWED_TRANSITIONS[status].size === 0;
}

export function teacherReviewTarget(
  action: TeacherReviewAction,
): "accepted" | "needs_teacher_revision" {
  return action === "accept" ? "accepted" : "needs_teacher_revision";
}

export function canTeacherFinalize(status: SubmissionStatus): boolean {
  // checked/reviewed 是历史数据兼容入口；新记录统一使用 pending_teacher_review。
  return (
    status === "checked" ||
    status === "reviewed" ||
    status === "pending_teacher_review"
  );
}

export function assertTeacherFinalization(
  current: SubmissionStatus,
  action: TeacherReviewAction,
): "accepted" | "needs_teacher_revision" {
  if (!canTeacherFinalize(current)) {
    throw new Error(`当前 Submission 状态不允许教师终审：${current}`);
  }

  const target = teacherReviewTarget(action);
  if (current === "checked" || current === "reviewed") {
    // 历史记录在迁移前可能没有 pending_teacher_review 中间态。
    return target;
  }
  assertTransition(current, target);
  return target;
}
