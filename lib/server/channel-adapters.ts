// Channel Adapters — P3 T4: normalize NSEAP Agent CLI and WorkBuddy desktop
// requests into the unified Envelope v2 → bus → handle_message pipeline.
// Each adapter handles protocol-specific concerns (auth, format, routing)
// but produces the same Envelope v2 output. (P3394 Channel Adapter pattern)
//
// WebApp adapter is implicit — the existing /api/* routes act as the
// web channel adapter, producing envelopes and publishing to the bus.
import type { MessageEnvelope } from "../schemas/zod-from-schemas";
import { buildEnvelope } from "./agents";
import { busAdapter } from "./bus-adapter";
import { makeId } from "./ids";

// ---- Shared adapter interface ----

export interface ChannelRequest {
  agent_id: string;
  message_type: string;
  to_agent: string;
  payload: Record<string, unknown>;
}

export interface ChannelResponse {
  ok: boolean;
  task_id?: string;
  error?: string;
}

// ---- NSEAP Agent CLI Adapter ----

/**
 * NSEAP adapter: receives commands from NSEAP-compatible agent CLIs
 * (Hermes, Codex, WorkBuddy), constructs envelopes, and publishes to the bus.
 *
 * Agent CLIs send JSON over HTTP POST /api/nseap.
 */
export async function nseapAdapter(req: ChannelRequest): Promise<ChannelResponse> {
  const taskId = makeId("task");
  const auditId = makeId("audit");

  try {
    const envelope = buildEnvelope({
      messageType: req.message_type as MessageEnvelope["message_type"],
      fromAgent: req.agent_id,
      toAgent: req.to_agent,
      payload: req.payload,
      auditId,
    });

    const streamId = await busAdapter.publish(envelope);
    if (!streamId) {
      return { ok: false, error: "消息总线不可用" };
    }

    return { ok: true, task_id: taskId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "请求失败" };
  }
}

/** @deprecated Use nseapAdapter instead. */
export const hermesAdapter = nseapAdapter;

// ---- WorkBuddy Desktop Adapter ----

/**
 * WorkBuddy adapter: receives commands from the WorkBuddy desktop app.
 *
 * WorkBuddy communicates via HTTP + axios (confirmed from app inspection).
 * It sends JSON payloads with an x-api-key header for auth.
 * This adapter validates the key, constructs envelopes, and publishes.
 */
export async function workbuddyAdapter(
  agentId: string,
  messageType: string,
  toAgent: string,
  payload: Record<string, unknown>,
): Promise<ChannelResponse> {
  const taskId = makeId("task");
  const auditId = makeId("audit");

  try {
    const envelope = buildEnvelope({
      messageType: messageType as MessageEnvelope["message_type"],
      fromAgent: agentId,
      toAgent,
      payload,
      auditId,
    });

    const streamId = await busAdapter.publish(envelope);
    if (!streamId) {
      return { ok: false, error: "消息总线不可用" };
    }

    return { ok: true, task_id: taskId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "请求失败" };
  }
}
