// rbac.ts — Unified RBAC helper (T01)
// Replaces ad-hoc principal.role !== "teacher" checks across all API routes.
// Single source of truth for permission logic; no route should compare role strings directly.
import type { ServicePrincipal } from "./principal";

// ---- Student identity binding ----

/**
 * Extract the bound student_id from a principal.
 * - role="student": returns principal.person (which IS the student_id from session)
 * - role="agent" with person matching `student-companion-<id>`: returns the captured id
 * - anything else: returns null
 */
export function getBoundStudentId(principal: ServicePrincipal | null): string | null {
  if (!principal) return null;

  if (principal.role === "student") {
    return principal.person;
  }

  if (principal.role === "agent") {
    const m = principal.person.match(/^student-companion-(.+)$/);
    if (m) return m[1];
  }

  return null;
}

// ---- Role checks ----

/** True if principal is a staff member (teacher, admin, or TA). */
export function isStaff(principal: ServicePrincipal | null): boolean {
  if (!principal) return false;
  return STAFF_ROLES.has(principal.role);
}

const STAFF_ROLES = new Set(["teacher", "admin", "ta"]);

/** True if principal is an admin or system-level account. */
export function isAdmin(principal: ServicePrincipal | null): boolean {
  if (!principal) return false;
  return ADMIN_ROLES.has(principal.role);
}

const ADMIN_ROLES = new Set(["admin", "system"]);

// ---- Permission matrix ----

export type Action =
  | "view_all_submissions"
  | "view_roster"
  | "publish_challenge"
  | "finalize_review"
  | "view_agents"
  | "manage_agents";

type Role = string;

/**
 * Permission matrix: which roles can perform which actions.
 * ⚠️  No route should re-implement role string comparisons — call can() instead.
 */
const PERMISSIONS: Record<Action, ReadonlySet<Role>> = {
  view_all_submissions: new Set(["teacher", "admin", "ta"]),
  view_roster: new Set(["teacher", "admin", "ta"]),
  publish_challenge: new Set(["teacher", "admin"]),
  finalize_review: new Set(["teacher", "admin"]),
  view_agents: new Set(["teacher", "admin", "ta"]),
  manage_agents: new Set(["admin"]),
};

/**
 * Check whether a principal is permitted to perform an action.
 * Returns false for null / anonymous principals.
 */
export function can(principal: ServicePrincipal | null, action: Action): boolean {
  if (!principal) return false;
  return PERMISSIONS[action]?.has(principal.role) ?? false;
}
