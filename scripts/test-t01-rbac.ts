/**
 * T01 验收自测脚本
 * 验证 getBoundStudentId 对四种输入的输出
 * 用法: npx tsx scripts/test-t01-rbac.ts
 */
import { getBoundStudentId, isStaff, isAdmin, can } from "../lib/server/rbac";
import type { ServicePrincipal } from "../lib/server/principal";

let passed = 0;
let failed = 0;

function test(name: string, actual: unknown, expected: unknown) {
  const ok =
    JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     expected: ${JSON.stringify(expected)}`);
    console.log(`     actual:   ${JSON.stringify(actual)}`);
  }
}

const student: ServicePrincipal = {
  person: "S001",
  org: "elite20",
  role: "student",
};

const agent: ServicePrincipal = {
  person: "student-companion-S001",
  org: "elite20",
  role: "agent",
};

const teacher: ServicePrincipal = {
  person: "teacher-zhang",
  org: "elite20",
  role: "teacher",
};

const unknownAgent: ServicePrincipal = {
  person: "teacher-companion-workbuddy",
  org: "elite20",
  role: "agent",
};

const admin: ServicePrincipal = {
  person: "admin-001",
  org: "elite20",
  role: "admin",
};

console.log("\n--- getBoundStudentId ---");
test("student role → student_id", getBoundStudentId(student), "S001");
test("student-companion agent → student_id", getBoundStudentId(agent), "S001");
test("teacher → null", getBoundStudentId(teacher), null);
test("unrelated agent → null", getBoundStudentId(unknownAgent), null);
test("null principal → null", getBoundStudentId(null), null);

console.log("\n--- isStaff ---");
test("teacher is staff", isStaff(teacher), true);
test("admin is staff", isStaff(admin), true);
test("student is NOT staff", isStaff(student), false);
test("null is NOT staff", isStaff(null), false);

console.log("\n--- isAdmin ---");
test("admin is admin", isAdmin(admin), true);
test("teacher is NOT admin", isAdmin(teacher), false);
test("null is NOT admin", isAdmin(null), false);

console.log("\n--- can() permission matrix ---");
test("teacher can view_all_submissions", can(teacher, "view_all_submissions"), true);
test("admin can view_all_submissions", can(admin, "view_all_submissions"), true);
test("student canNOT view_all_submissions", can(student, "view_all_submissions"), false);
test("teacher can view_roster", can(teacher, "view_roster"), true);
test("student canNOT view_roster", can(student, "view_roster"), false);
test("teacher can publish_challenge", can(teacher, "publish_challenge"), true);
test("admin can publish_challenge", can(admin, "publish_challenge"), true);
test("admin can finalize_review", can(admin, "finalize_review"), true);
test("teacher can finalize_review", can(teacher, "finalize_review"), true);
test("student canNOT finalize_review", can(student, "finalize_review"), false);
test("admin can manage_agents", can(admin, "manage_agents"), true);
test("teacher canNOT manage_agents", can(teacher, "manage_agents"), false);
test("teacher can view_agents", can(teacher, "view_agents"), true);
test("student canNOT view_agents", can(student, "view_agents"), false);
test("null canNOT anything", can(null, "view_all_submissions"), false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
