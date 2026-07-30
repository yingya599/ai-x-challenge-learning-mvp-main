// Agent Registry — P3 T2: dynamic registration (replaces hardcoded AGENT_TO_SP).
// Agents register at startup, deregister at shutdown. Redis primary, Students table fallback.
// API: POST /api/agents/register, GET /api/agents, DELETE /api/agents/:id
import { getRedis } from "./redis";
import type { ServicePrincipal } from "../schemas/envelope-v2.schema";

/** True if Redis is connected and ready for commands.
 *  With enableOfflineQueue:false + lazyConnect:true, commands
 *  sent before connection will reject — callers must check this first. */
function redisReady(): ReturnType<typeof getRedis> {
  const r = getRedis();
  if (!r || r.status !== "ready") return null;
  return r;
}

const REGISTRY_PREFIX = "agent:registry:";

/** System agent IDs protected from hijack/unregistration by non-admin callers. */
export const RESERVED_AGENT_IDS = new Set([
  "submission-task-agent-001",
  "review-task-agent-001",
  "student-companion-webapp-fallback",
  "teacher-companion-webapp-fallback",
]);
const REGISTRY_TTL = 3600; // agents must heartbeat within 1 hour

export interface AgentRegistration {
  agent_id: string;
  person: string;
  org: string;
  role: string;
  capabilities: string[];
  status: "online" | "offline";
  registered_at: string;
  last_seen_at: string;
}

function registryKey(agentId: string): string {
  return `${REGISTRY_PREFIX}${agentId}`;
}

// ---- Register ----

export async function registerAgent(
  agentId: string,
  sp: ServicePrincipal,
  capabilities: string[],
): Promise<void> {
  const redis = redisReady();
  const now = new Date().toISOString();

  const entry: AgentRegistration = {
    agent_id: agentId,
    person: sp.person,
    org: sp.org,
    role: sp.role,
    capabilities,
    status: "online",
    registered_at: now,
    last_seen_at: now,
  };

  if (redis) {
    await redis.setex(registryKey(agentId), REGISTRY_TTL, JSON.stringify(entry));
  }
  console.log(`[registry] Agent registered: ${agentId} (${sp.role})`);
}

// ---- Unregister ----

export async function unregisterAgent(agentId: string): Promise<void> {
  const redis = redisReady();
  if (redis) {
    await redis.del(registryKey(agentId));
  }
  console.log(`[registry] Agent unregistered: ${agentId}`);
}

// ---- Heartbeat ----

export async function agentHeartbeat(agentId: string): Promise<void> {
  const redis = redisReady();
  if (!redis) return;

  const raw = await redis.get(registryKey(agentId));
  if (!raw) return;

  const entry: AgentRegistration = JSON.parse(raw);
  entry.last_seen_at = new Date().toISOString();
  entry.status = "online";
  await redis.setex(registryKey(agentId), REGISTRY_TTL, JSON.stringify(entry));
}

// ---- Lookup ----

export async function lookupAgent(agentId: string): Promise<AgentRegistration | null> {
  const redis = redisReady();
  if (redis) {
    const raw = await redis.get(registryKey(agentId));
    if (raw) return JSON.parse(raw) as AgentRegistration;
  }
  return null;
}

// ---- List ----

export async function listAgents(): Promise<AgentRegistration[]> {
  const redis = redisReady();
  if (!redis) return [];

  const keys = await redis.keys(`${REGISTRY_PREFIX}*`);
  const agents: AgentRegistration[] = [];
  for (const key of keys) {
    const raw = await redis.get(key);
    if (raw) agents.push(JSON.parse(raw) as AgentRegistration);
  }
  return agents.sort((a, b) => a.agent_id.localeCompare(b.agent_id));
}

// ---- Auto-register known agents on startup ----

export async function bootstrapRegistry(): Promise<void> {
  // Register hardcoded system agents
  const systemAgents: Array<{ id: string; sp: ServicePrincipal; caps: string[] }> = [
    {
      id: "submission-task-agent-001",
      sp: { person: "submission-task-agent-001", org: "elite20", role: "system" },
      caps: ["submission_request", "review_request"],
    },
    {
      id: "review-task-agent-001",
      sp: { person: "review-task-agent-001", org: "elite20", role: "system" },
      caps: ["review_request", "peer_review_request"],
    },
    {
      id: "student-companion-webapp-fallback",
      sp: { person: "student-companion-webapp-fallback", org: "elite20", role: "agent" },
      caps: ["submission_request"],
    },
    {
      id: "teacher-companion-webapp-fallback",
      sp: { person: "teacher-companion-webapp-fallback", org: "elite20", role: "agent" },
      caps: ["challenge_publish", "manual_review_adjustment"],
    },
  ];

  for (const agent of systemAgents) {
    const existing = await lookupAgent(agent.id);
    if (!existing) {
      await registerAgent(agent.id, agent.sp, agent.caps);
    }
  }

  console.log(`[registry] Bootstrap complete: ${systemAgents.length} system agents`);
}
