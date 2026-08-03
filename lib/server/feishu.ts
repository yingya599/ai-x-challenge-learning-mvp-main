import { requireEnv } from "./env";
import { makeId } from "./ids";
import type { Challenge, FeishuRecord, PortfolioItem, Student, Teacher, Admin } from "./types";

type FeishuListResponse = {
  code: number;
  msg?: string;
  data?: {
    items?: Array<{
      record_id: string;
      fields: Record<string, unknown>;
    }>;
    has_more?: boolean;
    page_token?: string;
  };
};

type FeishuCreateResponse = {
  code: number;
  msg?: string;
  data?: {
    record?: {
      record_id: string;
      fields: Record<string, unknown>;
    };
  };
};

let cachedTenantToken: { token: string; expiresAt: number } | null = null;

const FEISHU_FIELD_NAMES: Record<string, string> = {
  student_id: "学生ID",
  name: "姓名",
  email: "邮箱",
  github_username: "GitHub用户名",
  github_profile_url: "GitHub主页",
  school: "学校",
  major: "专业",
  grade: "年级",
  cohort: "班级/队列",
  ai_x_direction: "AI+X方向",
  status: "状态",
  portfolio_url: "作品集链接",
  challenge_id: "挑战ID",
  title: "标题",
  brief: "简介",
  objective: "目标",
  deliverables: "交付物",
  rubric: "评分标准",
  deadline: "截止时间",
  created_by: "创建人",
  teacher_id: "教师ID",
  teacher_agent_id: "教师AgentID",
  feishu_group_id: "飞书群ID",
  feishu_open_id: "feishu_open_id",
  airtable_record_id: "Airtable记录ID",
  ontology_nodes: "本体节点",
  learning_objectives: "学习目标",
  required_deliverables: "必要交付物",
  rubric_dimensions: "评分维度JSON",
  red_flags: "红线规则JSON",
  rubric_pointer: "评分标准链接",
  updated_at: "更新时间",
  submission_id: "提交ID",
  github_repo_url: "GitHub仓库链接",
  github_repo: "GitHub仓库",
  demo_url: "演示链接",
  summary: "摘要",
  submitted_at: "提交时间",
  github_check_status: "GitHub检查状态",
  readme_found: "README是否存在",
  latest_commit_at: "最新提交时间",
  student_name: "学生姓名",
  project_title: "项目标题",
  project_summary: "项目摘要",
  readme_url: "README链接",
  aar_text: "AAR复盘",
  self_evaluation_text: "自评文本",
  github_check_result: "GitHub检查结果",
  is_public: "是否公开",
  submitted_by_agent_id: "提交者AgentID",
  processed_by_agent_id: "处理者AgentID",
  submission_task_agent_id: "提交TaskAgentID",
  student_feishu_bot_id: "学生飞书BotID",
  admin_identity_mode: "管理员身份模式",
  admin_user_id: "管理员用户ID",
  submission_request_id: "提交请求ID",
  audit_log_pointer: "审计日志链接",
  review_mode: "评审模式",
  routing_status: "路由状态",
  review_status: "评审状态",
  task_state: "任务状态",
  github_branch: "GitHub分支",
  github_commit: "GitHub提交",
  submitted_files: "提交文件",
  self_reflection_pointer: "自评链接",
  skills_used: "使用技能",
  ontology_nodes_used: "使用本体节点",
  system_validation_status: "系统校验状态",
  routed_to_teacher_agent_id: "路由到教师AgentID",
  routed_to_peer_agent_ids: "路由到同伴AgentID",
  feedback_pointer: "反馈链接",
  evaluation_id: "评价ID",
  score: "分数",
  level: "等级",
  strengths: "优点",
  risks: "风险",
  suggestions: "建议",
  reviewed_at: "评价时间",
  reviewer: "评价人",
  evaluator_type: "评价类型",
  evaluator_id: "评价人ID",
  score_total: "总分",
  scores_json: "分项分数JSON",
  weaknesses: "不足",
  feedback: "反馈",
  created_at: "创建时间",
  portfolio_item_id: "作品ID",
  description: "描述",
  evidence_summary: "证据摘要",
  type: "类型",
  public_description: "公开描述",
  github_url: "GitHub链接",
  cover_image_url: "封面图链接",
  skills: "技能",
  ai_feedback_summary: "AI反馈摘要",
  api_key: "API Key",
  class_id: "班级ID",
};

function appToken() {
  return requireEnv("FEISHU_APP_TOKEN");
}

async function getTenantAccessToken() {
  if (cachedTenantToken && cachedTenantToken.expiresAt > Date.now() + 60_000) {
    return cachedTenantToken.token;
  }

  const response = await fetch(
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

  const payload = await response.json();
  if (!response.ok || payload.code !== 0) {
    throw new Error(`Feishu token failed: ${payload.msg || response.statusText}`);
  }

  cachedTenantToken = {
    token: payload.tenant_access_token,
    expiresAt: Date.now() + Math.max(1, payload.expire - 120) * 1000,
  };
  return cachedTenantToken.token;
}

async function feishuRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getTenantAccessToken();
  const response = await fetch(`https://open.feishu.cn/open-apis${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json();
  if (!response.ok || payload.code !== 0) {
    throw new Error(`Feishu API failed: ${payload.msg || response.statusText}`);
  }
  return payload as T;
}

function listPath(tableId: string, pageToken?: string) {
  const base = `/bitable/v1/apps/${appToken()}/tables/${tableId}/records?page_size=500`;
  return pageToken ? `${base}&page_token=${pageToken}` : base;
}

function createPath(tableId: string) {
  return `/bitable/v1/apps/${appToken()}/tables/${tableId}/records`;
}

function asString(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text: unknown }).text);
  }
  return value == null ? "" : String(value);
}

function asBoolean(value: unknown) {
  return value === true || value === "true" || value === "是";
}

function field(fields: Record<string, unknown>, key: string) {
  return fields[FEISHU_FIELD_NAMES[key]] ?? fields[key];
}

function toFeishuFields(fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [FEISHU_FIELD_NAMES[key] ?? key, value]),
  );
}

function normalizeStudent(record: { record_id: string; fields: Record<string, unknown> }): FeishuRecord<Student> {
  const f = record.fields;
  return {
    recordId: record.record_id,
    student_id: asString(field(f, "student_id")),
    name: asString(field(f, "name")),
    email: asString(field(f, "email")),
    feishu_open_id: asString(field(f, "feishu_open_id")),
    api_key: asString(field(f, "api_key")),
    api_key_hash: asString(f["API Key Hash"] ?? f["api_key_hash"]),
    feishu_app_id: asString(f["飞书AppID"] ?? f["feishu_app_id"]),
    feishu_app_secret: asString(f["飞书AppSecret"] ?? f["feishu_app_secret"]),
    class_id: asString(field(f, "class_id")),
    github_username: asString(field(f, "github_username")),
    github_profile_url: asString(field(f, "github_profile_url")),
    school: asString(field(f, "school")),
    major: asString(field(f, "major")),
    grade: asString(field(f, "grade")),
    cohort: asString(field(f, "cohort")),
    ai_x_direction: asString(field(f, "ai_x_direction")),
    status: asString(field(f, "status")),
    portfolio_url: asString(field(f, "portfolio_url")),
    // T06: role field (if present in table)
    ...(f["角色"] !== undefined || f["role"] !== undefined
      ? { role: asString(f["角色"] ?? f["role"]) as string }
      : {}),
  } as FeishuRecord<Student>;
}

function normalizeChallenge(record: { record_id: string; fields: Record<string, unknown> }): FeishuRecord<Challenge> {
  const f = record.fields;
  return {
    recordId: record.record_id,
    challenge_id: asString(field(f, "challenge_id")),
    title: asString(field(f, "title")),
    brief: asString(field(f, "brief")),
    objective: asString(field(f, "objective")),
    deliverables: asString(field(f, "deliverables")),
    rubric: asString(field(f, "rubric")),
    rubric_dimensions: asString(field(f, "rubric_dimensions")),
    red_flags: asString(field(f, "red_flags")),
    required_deliverables: asString(field(f, "required_deliverables")),
    deadline: asString(field(f, "deadline")),
    status: asString(field(f, "status")),
    created_by: asString(field(f, "created_by")),
    teacher_id: asString(field(f, "teacher_id")),
    teacher_agent_id: asString(field(f, "teacher_agent_id")),
    feishu_group_id: asString(field(f, "feishu_group_id")),
    airtable_record_id: asString(field(f, "airtable_record_id")),
    ontology_nodes: asString(field(f, "ontology_nodes")),
    learning_objectives: asString(field(f, "learning_objectives")),
    rubric_pointer: asString(field(f, "rubric_pointer")),
    skills: asString(field(f, "skills")),
    created_at: asString(field(f, "created_at")),
    updated_at: asString(field(f, "updated_at")),
    github_repo: asString(f["GitHub仓库"] ?? f["github_repo"]),
  };
}

function normalizePortfolio(record: { record_id: string; fields: Record<string, unknown> }): FeishuRecord<PortfolioItem> {
  const f = record.fields;
  return {
    recordId: record.record_id,
    portfolio_item_id: asString(field(f, "portfolio_item_id")),
    student_id: asString(field(f, "student_id")),
    student_name: asString(field(f, "student_name")),
    submission_id: asString(field(f, "submission_id")),
    title: asString(field(f, "title")),
    type: asString(field(f, "type")),
    summary: asString(field(f, "summary")),
    public_description: asString(field(f, "public_description")),
    github_url: asString(field(f, "github_url")),
    demo_url: asString(field(f, "demo_url")),
    cover_image_url: asString(field(f, "cover_image_url")),
    skills: asString(field(f, "skills")),
    ai_feedback_summary: asString(field(f, "ai_feedback_summary")),
    is_public: asBoolean(field(f, "is_public")),
    created_at: asString(field(f, "created_at")),
  };
}

async function listRecords(tableId: string) {
  // BUGFIX: paginate through all records, not just the first 500
  const allItems: Array<{ record_id: string; fields: Record<string, unknown> }> = [];
  let pageToken: string | undefined;

  do {
    const payload = await feishuRequest<FeishuListResponse>(listPath(tableId, pageToken));
    const items = payload.data?.items || [];
    allItems.push(...items);
    pageToken = payload.data?.has_more ? payload.data?.page_token : undefined;
  } while (pageToken);

  return allItems;
}

async function createRecord(tableId: string, fields: Record<string, unknown>) {
  const payload = await feishuRequest<FeishuCreateResponse>(createPath(tableId), {
    method: "POST",
    body: JSON.stringify({ fields: toFeishuFields(fields) }),
  });
  return payload.data?.record;
}

export async function getStudents() {
  const rows = await listRecords(requireEnv("FEISHU_STUDENTS_TABLE_ID"));
  return rows.map(normalizeStudent).filter((student) => student.status !== "inactive");
}

export async function getStudentById(studentId: string) {
  const students = await getStudents();
  const student = students.find((item) => item.student_id === studentId);
  if (!student) throw new Error(`Student not found: ${studentId}`);
  return student;
}

// ---- Teachers (T06) ----

function normalizeTeacher(record: { record_id: string; fields: Record<string, unknown> }): FeishuRecord<Teacher> {
  const f = record.fields;
  return {
    feishu_open_id: asString(f["feishu_open_id"]),
    teacher_agent_id: asString(f["teacher_agent_id"]),
    recordId: record.record_id,
    teacher_id: asString(f["teacher_id"] ?? f["教师ID"]),
    name: asString(f["姓名"] ?? f["name"]),
    email: asString(f["email"] ?? f["邮箱"]),
    role: asString(f["角色"] ?? f["role"]),
    api_key_hash: asString(f["API Key Hash"] ?? f["api_key_hash"]),
    class_id: asString(f["班级ID"] ?? f["class_id"]),
    status: asString(f["状态"] ?? f["status"]),
  };
}

export async function getTeachers(): Promise<Teacher[]> {
  const tableId = process.env.FEISHU_TEACHERS_TABLE_ID;
  if (!tableId) return [];
  const rows = await listRecords(tableId);
  return rows.map(normalizeTeacher);
}

export async function getTeacherById(teacherId: string): Promise<Teacher | null> {
  const teachers = await getTeachers();
  return teachers.find((t) => t.teacher_id === teacherId) || null;
}

// ---- Admins (T06) ----

function normalizeAdmin(record: { record_id: string; fields: Record<string, unknown> }): FeishuRecord<Admin> {
  const f = record.fields;
  return {
    feishu_open_id: asString(f["feishu_open_id"]),
    last_login_at: asString(f["last_login_at"]),
    recordId: record.record_id,
    admin_id: asString(f["admin_id"] ?? f["管理员ID"]),
    name: asString(f["姓名"] ?? f["name"]),
    email: asString(f["email"] ?? f["邮箱"]),
    role: asString(f["角色"] ?? f["role"]),
    api_key_hash: asString(f["API Key Hash"] ?? f["api_key_hash"]),
    status: asString(f["状态"] ?? f["status"]),
  };
}

export async function getAdmins(): Promise<Admin[]> {
  const tableId = process.env.FEISHU_ADMINS_TABLE_ID;
  if (!tableId) return [];
  const rows = await listRecords(tableId);
  return rows.map(normalizeAdmin);
}

export async function getAdminById(adminId: string): Promise<Admin | null> {
  const admins = await getAdmins();
  return admins.find((a) => a.admin_id === adminId) || null;
}

export async function getAdminByOpenId(openId: string): Promise<FeishuRecord<Admin> | null> {
  const admins = await getAdmins();
  return admins.find((admin) => admin.feishu_open_id === openId) || null;
}

export async function getAllStudents() {
  return (await listRecords(requireEnv("FEISHU_STUDENTS_TABLE_ID"))).map(normalizeStudent);
}

export async function getAllChallenges() {
  return (await listRecords(requireEnv("FEISHU_CHALLENGES_TABLE_ID"))).map(normalizeChallenge);
}

export type AdminEntity = "students" | "teachers" | "admins" | "challenges";

function adminEntityTable(entity: AdminEntity) {
  const names: Record<AdminEntity, string> = {
    students: "FEISHU_STUDENTS_TABLE_ID",
    teachers: "FEISHU_TEACHERS_TABLE_ID",
    admins: "FEISHU_ADMINS_TABLE_ID",
    challenges: "FEISHU_CHALLENGES_TABLE_ID",
  };
  return requireEnv(names[entity]);
}

export async function adminCreateEntity(entity: AdminEntity, fields: Record<string, unknown>) {
  return createRecord(adminEntityTable(entity), fields);
}

export async function adminUpdateEntity(entity: AdminEntity, recordId: string, fields: Record<string, unknown>) {
  await feishuRequest(
    `/bitable/v1/apps/${appToken()}/tables/${adminEntityTable(entity)}/records/${encodeURIComponent(recordId)}`,
    { method: "PUT", body: JSON.stringify({ fields: toFeishuFields(fields) }) },
  );
}

export interface SystemConfigRecord {
  recordId: string;
  key: string;
  ciphertext: string;
  nonce: string;
  tag: string;
  key_version: number;
  hint: string;
  updated_at: string;
  updated_by: string;
}

export async function getSystemConfig(key: string): Promise<SystemConfigRecord | null> {
  const tableId = process.env.FEISHU_SYSTEM_CONFIG_TABLE_ID;
  if (!tableId) return null;
  const rows = await listRecords(tableId);
  const row = rows.find((item) => asString(item.fields.key ?? item.fields["配置键"]) === key);
  if (!row) return null;
  return {
    recordId: row.record_id,
    key,
    ciphertext: asString(row.fields.ciphertext),
    nonce: asString(row.fields.nonce),
    tag: asString(row.fields.tag),
    key_version: Number(row.fields.key_version || 1),
    hint: asString(row.fields.hint),
    updated_at: asString(row.fields.updated_at),
    updated_by: asString(row.fields.updated_by),
  };
}

export async function setSystemConfig(fields: Omit<SystemConfigRecord, "recordId">) {
  const tableId = requireEnv("FEISHU_SYSTEM_CONFIG_TABLE_ID");
  const existing = await getSystemConfig(fields.key);
  if (existing) {
    await feishuRequest(
      `/bitable/v1/apps/${appToken()}/tables/${tableId}/records/${existing.recordId}`,
      { method: "PUT", body: JSON.stringify({ fields }) },
    );
  } else {
    await createRecord(tableId, fields);
  }
}

export async function updateStudent(recordId: string, fields: Record<string, unknown>): Promise<void> {
  const token = await getTenantAccessToken();
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken()}/tables/${requireEnv("FEISHU_STUDENTS_TABLE_ID")}/records/${recordId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ fields: toFeishuFields(fields) }),
    },
  );
  const payload = await resp.json();
  if (!resp.ok || payload.code !== 0) {
    throw new Error(`Feishu update failed: ${payload.msg || resp.statusText}`);
  }
}

export async function getPublishedChallenges() {
  const rows = await listRecords(requireEnv("FEISHU_CHALLENGES_TABLE_ID"));
  const challenges = rows.map(normalizeChallenge).filter(
    (challenge) => challenge.status === "published" && challenge.required_deliverables
  );
  // Deduplicate: for same challenge_id prefix, keep the one with longest required_deliverables
  const seen = new Map<string, typeof challenges[number]>();
  for (const c of challenges) {
    const prefix = c.title?.split(" ")[0] || c.challenge_id;
    const existing = seen.get(prefix);
    if (!existing || (c.required_deliverables?.length || 0) > (existing.required_deliverables?.length || 0)) {
      seen.set(prefix, c);
    }
  }
  return Array.from(seen.values());
}

export async function getChallengeById(challengeId: string) {
  const rows = await listRecords(requireEnv("FEISHU_CHALLENGES_TABLE_ID"));
  const challenge = rows.map(normalizeChallenge).find((item) => item.challenge_id === challengeId);
  if (!challenge) throw new Error(`Challenge not found: ${challengeId}`);
  return challenge;
}

export async function getPortfolioItems() {
  const rows = await listRecords(requireEnv("FEISHU_PORTFOLIO_TABLE_ID"));
  return rows.map(normalizePortfolio).filter((item) => item.is_public);
}

export async function createSubmission(fields: Record<string, unknown>) {
  const submission_id = asString(fields.submission_id) || makeId("sub");
  const record = await createRecord(requireEnv("FEISHU_SUBMISSIONS_TABLE_ID"), {
    ...fields,
    submission_id,
  });
  return { submission_id, recordId: record?.record_id };
}

export async function createEvaluation(fields: Record<string, unknown>) {
  const evaluation_id = asString(fields.evaluation_id) || makeId("eval");
  const record = await createRecord(requireEnv("FEISHU_EVALUATIONS_TABLE_ID"), {
    ...fields,
    evaluation_id,
  });
  return { evaluation_id, recordId: record?.record_id };
}

// ---- Evaluations query (P2) ----

export type EvaluationRecord = {
  recordId: string;
  evaluation_id: string;
  submission_id: string;
  student_id: string;
  challenge_id: string;
  evaluator_type: string;
  evaluator_id: string;
  score_total: number;
  feedback: string;
  strengths?: string;
  weaknesses?: string;
  suggestions?: string;
  scores_json?: string;
  created_at: string;
};

function normalizeEvaluation(record: { record_id: string; fields: Record<string, unknown> }): EvaluationRecord {
  const f = record.fields;
  return {
    recordId: record.record_id,
    evaluation_id: asString(field(f, "evaluation_id")),
    submission_id: asString(field(f, "submission_id")),
    student_id: asString(field(f, "student_id")),
    challenge_id: asString(field(f, "challenge_id")),
    evaluator_type: asString(field(f, "evaluator_type")),
    evaluator_id: asString(field(f, "evaluator_id")),
    score_total: Number(field(f, "score_total")) || 0,
    feedback: asString(field(f, "feedback")),
    strengths: asString(field(f, "strengths")),
    weaknesses: asString(field(f, "weaknesses")),
    suggestions: asString(field(f, "suggestions")),
    scores_json: asString(field(f, "scores_json")),
    created_at: asString(field(f, "created_at")),
  };
}

export async function getEvaluations(): Promise<EvaluationRecord[]> {
  const rows = await listRecords(requireEnv("FEISHU_EVALUATIONS_TABLE_ID"));
  return rows.map(normalizeEvaluation);
}

export async function getEvaluationsBySubmission(submissionId: string): Promise<EvaluationRecord[]> {
  const rows = await getEvaluations();
  return rows.filter((r) => r.submission_id === submissionId);
}

export async function getEvaluationsByEvaluator(evaluatorId: string): Promise<EvaluationRecord[]> {
  const rows = await getEvaluations();
  return rows.filter((r) => r.evaluator_id === evaluatorId);
}

export async function updateEvaluation(recordId: string, fields: Record<string, unknown>): Promise<void> {
  const token = await getTenantAccessToken();
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken()}/tables/${requireEnv("FEISHU_EVALUATIONS_TABLE_ID")}/records/${recordId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ fields: toFeishuFields(fields) }),
    },
  );
  const payload = await resp.json();
  if (!resp.ok || payload.code !== 0) {
    throw new Error(`Feishu update failed: ${payload.msg || resp.statusText}`);
  }
}

export async function createPortfolioItem(fields: Record<string, unknown>) {
  const portfolio_item_id = asString(fields.portfolio_item_id) || makeId("pf");
  const record = await createRecord(requireEnv("FEISHU_PORTFOLIO_TABLE_ID"), {
    ...fields,
    portfolio_item_id,
  });
  return { portfolio_item_id, recordId: record?.record_id };
}

export async function createChallenge(fields: Record<string, unknown>) {
  const challenge_id = asString(fields.challenge_id) || makeId("ch");
  const record = await createRecord(requireEnv("FEISHU_CHALLENGES_TABLE_ID"), {
    ...fields,
    challenge_id,
  });
  return { challenge_id, recordId: record?.record_id };
}

// ---- Submissions read (T10) ----

export type SubmissionRecord = FeishuRecord<{
  submission_id: string;
  student_id: string;
  student_name: string;
  challenge_id: string;
  project_title: string;
  project_summary?: string;
  github_repo_url?: string;
  github_repo?: string;
  github_branch?: string;
  github_commit?: string;
  github_check_result?: string;
  demo_url?: string;
  readme_url?: string;
  aar_text?: string;
  self_evaluation_text?: string;
  status?: string;
  task_state?: string;
  review_mode?: string;
  review_status?: string;
  routing_status?: string;
  submitted_at?: string;
  updated_at?: string;
  is_public?: boolean;
  score_total?: number;
  submitted_by_agent_id?: string;
  processed_by_agent_id?: string;
  submission_task_agent_id?: string;
  admin_identity_mode?: string;
  submission_request_id?: string;
  audit_log_pointer?: string;
  system_validation_status?: string;
  routed_to_teacher_agent_id?: string;
  routed_to_peer_agent_ids?: string;
  skills_used?: string;
}>;

function normalizeSubmission(record: { record_id: string; fields: Record<string, unknown> }): SubmissionRecord {
  const f = record.fields;
  return {
    recordId: record.record_id,
    submission_id: asString(field(f, "submission_id")),
    student_id: asString(field(f, "student_id")),
    student_name: asString(field(f, "student_name")),
    challenge_id: asString(field(f, "challenge_id")),
    project_title: asString(field(f, "project_title")),
    project_summary: asString(field(f, "project_summary")),
    github_repo_url: asString(field(f, "github_repo_url")),
    github_branch: asString(field(f, "github_branch")),
    github_commit: asString(field(f, "github_commit")),
    github_check_result: asString(field(f, "github_check_result")),
    demo_url: asString(field(f, "demo_url")),
    readme_url: asString(field(f, "readme_url")),
    aar_text: asString(field(f, "aar_text")),
    self_evaluation_text: asString(field(f, "self_evaluation_text")),
    status: asString(field(f, "status")),
    task_state: asString(field(f, "task_state")),
    review_mode: asString(field(f, "review_mode")),
    routing_status: asString(field(f, "routing_status")),
    submitted_at: asString(field(f, "submitted_at")),
    is_public: asBoolean(field(f, "is_public")),
    score_total: Number(field(f, "score_total") || "0"),
    // P2: AGENT_CN.md S7.2 extended fields
    github_repo: asString(field(f, "github_repo")),
    review_status: asString(field(f, "review_status")),
    updated_at: asString(field(f, "updated_at")),
    submitted_by_agent_id: asString(field(f, "submitted_by_agent_id")),
    processed_by_agent_id: asString(field(f, "processed_by_agent_id")),
    submission_task_agent_id: asString(field(f, "submission_task_agent_id")),
    admin_identity_mode: asString(field(f, "admin_identity_mode")),
    submission_request_id: asString(field(f, "submission_request_id")),
    audit_log_pointer: asString(field(f, "audit_log_pointer")),
    system_validation_status: asString(field(f, "system_validation_status")),
    routed_to_teacher_agent_id: asString(field(f, "routed_to_teacher_agent_id")),
    routed_to_peer_agent_ids: asString(field(f, "routed_to_peer_agent_ids")),
    skills_used: asString(field(f, "skills_used")),
  };
}

export async function getSubmissions(filter?: { studentId?: string }): Promise<SubmissionRecord[]> {
  const rows = await listRecords(requireEnv("FEISHU_SUBMISSIONS_TABLE_ID"));
  let results = rows.map(normalizeSubmission);
  if (filter?.studentId) {
    results = results.filter((s) => s.student_id === filter.studentId);
  }
  return results;
}

export async function getSubmissionById(submissionId: string): Promise<SubmissionRecord | null> {
  const rows = await listRecords(requireEnv("FEISHU_SUBMISSIONS_TABLE_ID"));
  const found = rows.map(normalizeSubmission).find((s) => s.submission_id === submissionId);
  return found || null;
}

// ---- Submissions update (T11) ----

export async function updateSubmission(recordId: string, fields: Record<string, unknown>): Promise<void> {
  const token = await getTenantAccessToken();
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken()}/tables/${requireEnv("FEISHU_SUBMISSIONS_TABLE_ID")}/records/${recordId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ fields: toFeishuFields(fields) }),
    },
  );
  const payload = await resp.json();
  if (!resp.ok || payload.code !== 0) {
    throw new Error(`Feishu update failed: ${payload.msg || resp.statusText}`);
  }
}
