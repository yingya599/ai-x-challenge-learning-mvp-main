import { NextResponse } from "next/server";
import { requireAdmin, sanitizeError } from "@/lib/server/admin-auth";
import {
  getAllStudents, getTeachers, getAdmins, getAllChallenges,
  adminCreateEntity, adminUpdateEntity, type AdminEntity,
} from "@/lib/server/feishu";
import { writeAdminAudit } from "@/lib/server/admin-audit";

const ENTITIES = new Set<AdminEntity>(["students", "teachers", "admins", "challenges"]);
const SAFE_FIELDS: Record<AdminEntity, Set<string>> = {
  students: new Set(["student_id", "name", "email", "feishu_open_id", "class_id", "github_username", "school", "major", "grade", "cohort", "ai_x_direction", "status"]),
  teachers: new Set(["teacher_id", "name", "email", "feishu_open_id", "teacher_agent_id", "class_id", "role", "status"]),
  admins: new Set(["admin_id", "name", "email", "feishu_open_id", "role", "status"]),
  challenges: new Set(["challenge_id", "title", "brief", "objective", "deliverables", "required_deliverables", "rubric", "rubric_dimensions", "red_flags", "deadline", "status", "review_mode", "github_repo"]),
};

function clean(entity: AdminEntity, input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => SAFE_FIELDS[entity].has(key)));
}

export async function GET(_request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { entity } = await params;
  if (!ENTITIES.has(entity as AdminEntity)) return NextResponse.json({ ok: false, error: "未知资源" }, { status: 404 });
  try {
    const loaders = { students: getAllStudents, teachers: getTeachers, admins: getAdmins, challenges: getAllChallenges };
    const items = await loaders[entity as AdminEntity]();
    const sanitized = items.map((source) => {
      const item = { ...source } as Record<string, unknown>;
      delete item.api_key;
      delete item.api_key_hash;
      delete item.feishu_app_secret;
      return item;
    });
    return NextResponse.json({ ok: true, items: sanitized });
  } catch (error) {
    return NextResponse.json({ ok: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const auth = await requireAdmin({ recentAuth: true });
  if (!auth.ok) return auth.response;
  const { entity } = await params;
  if (!ENTITIES.has(entity as AdminEntity)) return NextResponse.json({ ok: false, error: "未知资源" }, { status: 404 });
  const body = await request.json();
  const fields = clean(entity as AdminEntity, body.fields || {});
  if (!body.reason || Object.keys(fields).length === 0) return NextResponse.json({ ok: false, error: "必须填写原因和有效字段" }, { status: 400 });
  try {
    const record = await adminCreateEntity(entity as AdminEntity, fields);
    await writeAdminAudit(auth.principal, { action: "create", target: `${entity}:${record?.record_id || "new"}`, reason: body.reason, result: "success", request_id: body.request_id });
    return NextResponse.json({ ok: true, record_id: record?.record_id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const auth = await requireAdmin({ recentAuth: true });
  if (!auth.ok) return auth.response;
  const { entity } = await params;
  if (!ENTITIES.has(entity as AdminEntity)) return NextResponse.json({ ok: false, error: "未知资源" }, { status: 404 });
  const body = await request.json();
  if (!body.record_id || !body.reason) return NextResponse.json({ ok: false, error: "必须提供记录和操作原因" }, { status: 400 });
  const fields = clean(entity as AdminEntity, body.fields || {});
  if (entity === "admins" && fields.status === "inactive") {
    const active = (await getAdmins()).filter((x) => x.status !== "inactive");
    if (active.length <= 1) return NextResponse.json({ ok: false, error: "不能停用最后一个有效管理员" }, { status: 409 });
  }
  try {
    await adminUpdateEntity(entity as AdminEntity, body.record_id, fields);
    await writeAdminAudit(auth.principal, { action: "update", target: `${entity}:${body.record_id}`, reason: body.reason, result: "success", request_id: body.request_id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: sanitizeError(error) }, { status: 500 });
  }
}
