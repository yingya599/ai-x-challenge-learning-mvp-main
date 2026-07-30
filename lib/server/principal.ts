// principal.ts — Server-side Principal resolution (§3.5)
// Supports: session cookie (webapp) + API key (Hermes/WorkBuddy agent channels)
// Principal is ONLY resolved server-side; clients never self-report role.
import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { optionalEnv } from "./env";
import { resolveStudentApiKey } from "./agent-auth";
import { agentToSP } from "./service-principal";

export interface ServicePrincipal {
  person: string;
  org: string;
  role: string;
  class_id?: string;
  name?: string;
  open_id?: string;
  auth_time?: string;
  impersonation?: { role: "student" | "teacher"; person: string };
}

const SESSION_COOKIE = "nseap_session";

function getSecret(): string {
  return optionalEnv("SESSION_SECRET");
}

export function signToken(payload: Record<string, string>): string {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET not configured");
  const data = JSON.stringify(payload);
  const exp = String(Math.floor(Date.now() / 1000) + 86400); // 24h
  const payloadWithExp = JSON.stringify({ ...payload, exp });
  const hmac = createHmac("sha256", secret).update(payloadWithExp).digest("hex");
  return Buffer.from(JSON.stringify({ data: payloadWithExp, hmac })).toString("base64url");
}

export function verifyToken(token: string): Record<string, string> | null {
  try {
    const secret = getSecret();
    if (!secret) return null;
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const { data, hmac } = JSON.parse(raw);
    // T07: timing-safe comparison
    const expectedHmac = createHmac("sha256", secret).update(data).digest("hex");
    const hmacBuf = Buffer.from(hmac, "hex");
    const expectedBuf = Buffer.from(expectedHmac, "hex");
    if (hmacBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(hmacBuf, expectedBuf)) return null;
    const payload = JSON.parse(data);
    // T07: check expiration
    if (payload.exp && Date.now() > Number(payload.exp) * 1000) return null;
    delete payload.exp;
    return payload;
  } catch {
    return null;
  }
}

/** Resolve Principal from session cookie. Returns null for anonymous. */
export async function getPrincipal(): Promise<ServicePrincipal | null> {
  try {
    // First try session cookie (webapp)
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        const principal: ServicePrincipal = {
          person: payload.person,
          org: payload.org || "elite20",
          role: payload.role || "student",
          name: payload.name,
          open_id: payload.open_id,
          auth_time: payload.auth_time,
        };
        if (principal.role === "admin") {
          const { getAdminById } = await import("./feishu");
          const admin = await getAdminById(principal.person);
          if (!admin || admin.status === "inactive") return null;
        }
        return principal;
      }
    }
  } catch {
    // cookies() throws outside of request context — fall through to agent auth
  }

  // Try API key (agent channels: Hermes/WorkBuddy)
  return await getAgentPrincipal();
}

/** Resolve Principal from API key header (for agent channels). */
export async function getAgentPrincipal(): Promise<ServicePrincipal | null> {
  try {
    const hdrs = await headers();
    const apiKey = hdrs.get("x-api-key")?.trim();
    if (!apiKey) return null;

    // Try hardcoded keys — INLINE lookup to bypass any module caching issues
    const raw = optionalEnv("AGENT_API_KEYS");
    if (raw) {
      for (const pair of raw.split(",")) {
        const p = pair.trim();
        const idx = p.indexOf(":");
        const agentId = p.substring(0, idx);
        const key = p.substring(idx + 1);
        if (key.trim() === apiKey && agentId) {
          const sp = agentToSP(agentId.trim());
          if (sp) return { person: sp.person, org: sp.org, role: sp.role };
        }
      }
    }

    // Try Students table keys (auto-generated for each student)
    const studentSp = await resolveStudentApiKey(apiKey);
    if (studentSp) {
      // Auto-register dynamic student agent in registry if not already known
      const { lookupAgent, registerAgent } = await import("./agent-registry");
      const existing = await lookupAgent(studentSp.person);
      if (!existing) {
        await registerAgent(studentSp.person, studentSp, ["submission_request"]);
      }
      return { person: studentSp.person, org: studentSp.org, role: studentSp.role };
    }
  } catch {
    // headers() throws outside of request context
  }
  return null;
}

export async function determineRole(personId: string): Promise<string> {
  // T06: Check Admins table first, then Teachers, then Students
  const { getAdminById, getTeacherById, getStudentById } = await import("./feishu");

  try {
    const admin = await getAdminById(personId);
    if (admin) return admin.role || "admin";
  } catch { /* table might not exist yet */ }

  try {
    const teacher = await getTeacherById(personId);
    if (teacher) return teacher.role || "teacher";
  } catch { /* table might not exist yet */ }

  // Fallback to TEACHER_IDS env var (deprecated, kept for backward compat)
  const teacherIds = optionalEnv("TEACHER_IDS")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (teacherIds.includes(personId.toLowerCase())) {
    console.warn("[principal] TEACHER_IDS env var is deprecated. Use Teachers Feishu table instead.");
    return "teacher";
  }

  return "student";
}

/**
 * Extract the real student_id from a Principal.
 * WebApp sessions have role="student" with person=studentId.
 * Agent channels have role="agent" with person="student-companion-{studentId}".
 * Returns null if the principal does not represent a student.
 */
export function getStudentId(principal: ServicePrincipal): string | null {
  if (principal.role === "student") return principal.person;
  if (principal.role === "agent" && principal.person.startsWith("student-companion-")) {
    return principal.person.slice("student-companion-".length);
  }
  return null;
}

export { SESSION_COOKIE };
