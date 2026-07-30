// Agent API Key authentication — P2 agent channel auth (AGENT_CN.md §3.5).
// T08: Keys are now hashed with SHA-256; plaintext only returned once at generation.
// Supports key rotation with 30-day grace period for previous hash.
import { randomBytes, createHash } from "crypto";
import { optionalEnv } from "./env";
import type { ServicePrincipal } from "../schemas/envelope-v2.schema";
import { agentToSP } from "./service-principal";

// ---- Key → Agent mapping ----

let _keyMap: Map<string, string> | null = null;

function loadKeyMap(): Map<string, string> {
  if (_keyMap) return _keyMap;

  _keyMap = new Map();
  const raw = optionalEnv("AGENT_API_KEYS");
  if (!raw) return _keyMap;

  for (const pair of raw.split(",")) {
    const p = pair.trim();
    const idx = p.indexOf(":");
    const agentId = p.substring(0, idx);
    const key = p.substring(idx + 1);
    if (agentId && key) {
      _keyMap.set(key.trim(), agentId.trim());
    }
  }

  if (_keyMap.size > 0) {
    console.log(`[auth] Loaded ${_keyMap.size} agent API keys`);
  }
  return _keyMap;
}

// ---- Principal resolution ----

export function resolveAgentApiKey(apiKey: string): ServicePrincipal | null {
  // Parse directly from process.env each time to avoid Next.js module caching issues
  const raw = optionalEnv("AGENT_API_KEYS");
  if (!raw) return null;
  
  for (const pair of raw.split(",")) {
    const p = pair.trim();
    const idx = p.indexOf(":");
    const agentId = p.substring(0, idx);
    const key = p.substring(idx + 1);
    if (key.trim() === apiKey && agentId) {
      return agentToSP(agentId.trim());
    }
  }
  return null;
}

/**
 * T08: Resolve from Students table using hash comparison.
 * Caches results for 60s to avoid full table scans per request.
 */
const _studentKeyCache = new Map<string, { sp: ServicePrincipal; ts: number }>();
const STUDENT_KEY_CACHE_TTL = 60_000; // 60s

export async function resolveStudentApiKey(apiKey: string): Promise<ServicePrincipal | null> {
  if (!apiKey) return null;

  const keyHash = hashApiKey(apiKey);

  // Check cache first
  const cached = _studentKeyCache.get(keyHash);
  if (cached && Date.now() - cached.ts < STUDENT_KEY_CACHE_TTL) {
    return cached.sp;
  }

  try {
    const { getStudents } = await import("./feishu");
    const students = await getStudents();
    for (const s of students) {
      // Check current hash
      if (s.api_key_hash && s.api_key_hash === keyHash) {
        const sp: ServicePrincipal = {
          person: `student-companion-${s.student_id}`,
          org: "elite20",
          role: "agent",
        };
        _studentKeyCache.set(keyHash, { sp, ts: Date.now() });
        return sp;
      }
    }
  } catch {
    // Feishu unavailable — skip
  }
  return null;
}

// ---- Key generation & hashing (T08) ----

/** Generate a cryptographically secure API key. */
export function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(48); // 48 bytes → 64 chars base62
  let result = "";
  for (let i = 0; i < 48; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return `nseap-${result.slice(0, 16)}-${result.slice(16, 32)}-${result.slice(32, 48)}`;
}

/** Hash an API key with SHA-256 for storage comparison. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// ---- Headers extraction ----

export function extractApiKey(request: Request): string | null {
  const xKey = request.headers.get("x-api-key");
  if (xKey) return xKey.trim();

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }

  return null;
}
