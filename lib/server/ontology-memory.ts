// Agent Ontology Memory — AGENT_CN.md §3.3 implementation.
// Redis Hash per student, read-through from Feishu on miss.
//
// Key naming convention (locked in — matches manifest memory_binding.ontology_path):
//   nseap:memory:student:{student_id}
//   nseap:memory:teacher:{teacher_id}
//   nseap:memory:agent:{agent_id}
//
//   Rebuild lock:   nseap:memory:lock:{student_id}  (SET NX EX 10, prevents rebuild storm)
//
// Memory is a "disposable snapshot" — Feishu is source of truth.
// TTL: 7 days, refreshed on every write.
// Redis unavailable → read returns null, write skips silently (does NOT block main flow).

import { getRedis } from "./redis";
import * as feishu from "./feishu";

const MEMORY_PREFIX = "nseap:memory:";
const LOCK_PREFIX = "nseap:memory:lock:";
const TTL_SECONDS = 7 * 24 * 3600; // 7 days

// ---- Types ----

export type LearningState = "idle" | "working" | "submitted" | "reviewed";

export interface StudentMemory {
  active_challenge_id: string;
  learning_state: LearningState;
  last_submission: {
    submission_id: string;
    challenge_id: string;
    status: string;
    ts: string;
  } | null;
  skills_used: string[];
  review_relations: {
    as_reviewee: string[]; // submission_ids I was reviewed on
    as_reviewer: string[]; // submission_ids I reviewed
  };
  last_feedback: {
    from: string;
    summary_pointer: string;
    ts: string;
  } | null;
  updated_at: string;
  rebuilt_from_feishu_at: string | null;
}

function studentKey(studentId: string): string {
  return `${MEMORY_PREFIX}student:${studentId}`;
}
function lockKey(studentId: string): string {
  return `${LOCK_PREFIX}${studentId}`;
}

// ---- Read ----

export async function getStudentMemory(studentId: string): Promise<StudentMemory | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.hgetall(studentKey(studentId));
    if (raw && Object.keys(raw).length > 0) {
      return deserialize(raw);
    }
  } catch {
    // fall through to rebuild
  }

  // Cache miss — rebuild from Feishu with lock
  return await rebuildFromFeishu(studentId);
}

async function rebuildFromFeishu(studentId: string): Promise<StudentMemory | null> {
  const redis = getRedis();
  if (!redis) return null;

  // Acquire rebuild lock
  const acquired = await redis.set(lockKey(studentId), "1", "EX", 10, "NX");
  if (!acquired) {
    // Another rebuild in progress — wait and retry once
    await new Promise((r) => setTimeout(r, 200));
    const raw = await redis.hgetall(studentKey(studentId));
    if (raw && Object.keys(raw).length > 0) {
      return deserialize(raw);
    }
    return null; // give up, return empty snapshot
  }

  try {
    // Read from Feishu
    const submissions = await feishu.getSubmissions({ studentId });
    const allEvals = await feishu.getEvaluations().catch(() => []);

    const activeChallenge = submissions.find(
      (s) => s.status !== "accepted" && s.status !== "needs_teacher_revision"
    );

    const skills = new Set<string>();
    for (const s of submissions) {
      if (s.skills_used) {
        s.skills_used.split(",").forEach((sk) => skills.add(sk.trim()));
      }
    }

    const asReviewee = allEvals
      .filter((e) => e.student_id === studentId && e.evaluator_type === "peer")
      .map((e) => e.submission_id);
    const asReviewer = allEvals
      .filter((e) => e.evaluator_id === studentId && e.evaluator_type === "peer")
      .map((e) => e.submission_id);

    const memory: StudentMemory = {
      active_challenge_id: activeChallenge?.challenge_id || "",
      learning_state: activeChallenge ? "submitted" : "idle",
      last_submission: submissions[0]
        ? {
            submission_id: submissions[0].submission_id,
            challenge_id: submissions[0].challenge_id,
            status: submissions[0].status || "unknown",
            ts: submissions[0].submitted_at || new Date().toISOString(),
          }
        : null,
      skills_used: Array.from(skills),
      review_relations: { as_reviewee: asReviewee, as_reviewer: asReviewer },
      last_feedback: null,
      updated_at: new Date().toISOString(),
      rebuilt_from_feishu_at: new Date().toISOString(),
    };

    // Write back to Redis
    await redis.hset(studentKey(studentId), serialize(memory));
    await redis.expire(studentKey(studentId), TTL_SECONDS);

    return memory;
  } catch (err) {
    console.warn(`[memory] Rebuild failed for ${studentId}:`, err instanceof Error ? err.message : String(err));
    return null;
  } finally {
    await redis.del(lockKey(studentId)).catch(() => {});
  }
}

// ---- Write ----

export async function updateStudentMemory(
  studentId: string,
  patch: Partial<StudentMemory>,
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    console.warn("[memory] Redis unavailable — memory update skipped");
    return;
  }

  try {
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === null) continue;
      flat[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
    flat["updated_at"] = new Date().toISOString();

    await redis.hset(studentKey(studentId), flat);
    await redis.expire(studentKey(studentId), TTL_SECONDS);
  } catch (err) {
    console.warn("[memory] Write failed:", err instanceof Error ? err.message : String(err));
  }
}

// ---- Serialization helpers ----

function serialize(m: StudentMemory): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(m)) {
    if (value === null || value === undefined) continue;
    flat[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return flat;
}

function deserialize(raw: Record<string, string>): StudentMemory {
  const parse = (k: string, fallback: unknown) => {
    const v = raw[k];
    if (v === undefined || v === "") return fallback;
    try { return JSON.parse(v); } catch { return v; }
  };

  return {
    active_challenge_id: raw.active_challenge_id || "",
    learning_state: (raw.learning_state as LearningState) || "idle",
    last_submission: parse("last_submission", null),
    skills_used: parse("skills_used", []),
    review_relations: parse("review_relations", { as_reviewee: [], as_reviewer: [] }),
    last_feedback: parse("last_feedback", null),
    updated_at: raw.updated_at || "",
    rebuilt_from_feishu_at: raw.rebuilt_from_feishu_at || null,
  };
}
