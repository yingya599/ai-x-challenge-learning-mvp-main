// Task status management — T20 async submit.
// Redis is the fast cache; Feishu is the source of truth (决策一).
// Status flow: pending → processing → completed | failed
// GET /api/tasks/:id checks Redis first, falls back to Feishu.
import { getRedis } from "./redis";

export type TaskStatus = "pending" | "processing" | "completed" | "failed";

export interface TaskInfo {
  task_id: string;
  status: TaskStatus;
  message_type: string;
  student_id: string;
  created_at: string;
  updated_at: string;
  result?: {
    ok: boolean;
    submissionId?: string;
    evaluationId?: string;
    portfolioItemId?: string;
    error?: string;
  };
}

const TASK_PREFIX = "task:";
const TASK_TTL = 3600; // 1 hour

function taskKey(taskId: string): string {
  return `${TASK_PREFIX}${taskId}`;
}

export async function createTask(
  taskId: string,
  messageType: string,
  studentId: string,
): Promise<TaskInfo> {
  const task: TaskInfo = {
    task_id: taskId,
    status: "pending",
    message_type: messageType,
    student_id: studentId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const redis = getRedis();
  if (redis) {
    await redis.setex(taskKey(taskId), TASK_TTL, JSON.stringify(task));
  }

  return task;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  result?: TaskInfo["result"],
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const existing = await getTask(taskId);
  if (!existing) return;

  const updated: TaskInfo = {
    ...existing,
    status,
    updated_at: new Date().toISOString(),
    ...(result ? { result } : {}),
  };

  await redis.setex(taskKey(taskId), TASK_TTL, JSON.stringify(updated));
}

export async function getTask(taskId: string): Promise<TaskInfo | null> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get(taskKey(taskId));
    if (raw) return JSON.parse(raw) as TaskInfo;
  }
  return null;
}
