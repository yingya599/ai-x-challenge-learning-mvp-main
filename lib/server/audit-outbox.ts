// audit-outbox.ts — Outbox pattern for audit persistence (ADR-008)
// Batch-writes AuditTrail entries to Feishu AuditLogs table (tbl31l2XhXDMOB7K).
// Fire-and-forget: flush is non-blocking; failures retry 3x with exponential backoff.
import { requireEnv } from "./env";
import { makeId } from "./ids";
import type { AuditLog } from "../schemas/zod-from-schemas";

let AUDITLOGS_TABLE_ID: string | null = null;

function getAuditLogsTableId(): string {
  if (!AUDITLOGS_TABLE_ID) {
    AUDITLOGS_TABLE_ID = requireEnv("FEISHU_AUDITLOGS_TABLE_ID");
  }
  return AUDITLOGS_TABLE_ID;
}

// In-process outbox queue
let outbox: AuditLog[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 5_000; // batch every 5 seconds
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1_000, 2_000, 4_000];

// ---- Feishu write helpers ----

let cachedTenantToken: { token: string; expiresAt: number } | null = null;

async function getTenantToken(): Promise<string> {
  if (cachedTenantToken && cachedTenantToken.expiresAt > Date.now() + 60_000) {
    return cachedTenantToken.token;
  }

  const resp = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: requireEnv("FEISHU_APP_ID"),
        app_secret: requireEnv("FEISHU_APP_SECRET"),
      }),
    },
  );

  const payload = await resp.json();
  if (!resp.ok || payload.code !== 0) {
    throw new Error(`Feishu token failed: ${payload.msg || resp.statusText}`);
  }

  cachedTenantToken = {
    token: payload.tenant_access_token,
    expiresAt: Date.now() + Math.max(1, payload.expire - 120) * 1000,
  };
  return cachedTenantToken.token;
}

// ---- Feishu field name mapping for AuditLogs table ----
const AUDIT_FIELD_NAMES: Record<string, string> = {
  audit_id: "审计ID",
  timestamp: "操作时间",
  agent_id: "Agent ID",
  action: "操作类型",
  target_resource: "目标资源",
  related_message_id: "关联消息ID",
  before_state: "操作前状态",
  after_state: "操作后状态",
  error_trace: "附加元数据",
};

function toFeishuFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [AUDIT_FIELD_NAMES[key] ?? key, value]),
  );
}

async function writeSingleAuditRecord(
  entry: AuditLog,
  token: string,
  appToken: string,
): Promise<void> {
  const body = {
    fields: toFeishuFields({
      audit_id: entry.audit_id,
      timestamp: entry.timestamp,
      agent_id: entry.agent_id,
      action: entry.action,
      target_resource: entry.target_resource,
      related_message_id: entry.related_message_id || "",
      before_state: entry.before_state !== undefined ? JSON.stringify(entry.before_state) : "",
      after_state: entry.after_state !== undefined ? JSON.stringify(entry.after_state) : "",
      error_trace: entry.error_trace !== undefined ? JSON.stringify(entry.error_trace) : "",
    }),
  };

  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${getAuditLogsTableId()}/records`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    },
  );

  const payload = await resp.json();
  if (!resp.ok || payload.code !== 0) {
    throw new Error(`Feishu audit write failed: ${payload.msg || resp.statusText}`);
  }
}

async function batchWriteWithRetry(batch: AuditLog[]): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const token = await getTenantToken();
      const appToken = requireEnv("FEISHU_APP_TOKEN");

      for (const entry of batch) {
        await writeSingleAuditRecord(entry, token, appToken);
      }
      return; // success
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[audit-outbox] flush attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  // All retries exhausted — log and move on (fire-and-forget, does not block business)
  console.error(
    `[audit-outbox] FAILED to flush ${batch.length} audit entries after ${MAX_RETRIES + 1} attempts:`,
    lastError?.message,
  );
}

// ---- Public API ----

/** Enqueue entries from an AuditTrail for async persistence. Non-blocking. */
export function enqueue(entries: AuditLog[]): void {
  if (!entries.length) return;
  outbox.push(...entries);
  // Start flush timer if not already running (FLUSH_INTERVAL_MS was dead code before)
  if (!flushTimer) {
    flushTimer = setTimeout(() => { flushTimer = null; flush(); }, FLUSH_INTERVAL_MS);
  }
}

/** Force-flush the outbox immediately (used at workflow end). Returns a Promise for callers that want to await. */
export function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!outbox.length) return Promise.resolve();

  const batch = outbox.splice(0, outbox.length);
  // Fire-and-forget by default, but callers can await for ordering
  return batchWriteWithRetry(batch).catch((err) => {
    console.error("[audit-outbox] unexpected flush error:", err);
  });
}
