import type { ServicePrincipal } from "./principal";
import { getBoundStudentId, isLeader, isMentor } from "./rbac";
import {
  getAllChallenges,
  getCompetencies,
  getEvaluations,
  getPersonalTasks,
  getStudents,
  getSubmissions,
  getTeachers,
  type EvaluationRecord,
  type SubmissionRecord,
} from "./feishu";
import {
  buildInternAssessment,
  inferTaskProfile,
  matchTaskToIntern,
  type InternAssessment,
  type TaskMatchResult,
} from "./intern-assessment";
import type {
  Challenge,
  Competency,
  CompetencyAssessment,
  JobDirection,
  PersonalTask,
  Student,
  TaskCategory,
  Teacher,
} from "./types";

export const JOB_DIRECTION_LABELS: Record<JobDirection, string> = {
  business_analysis: "商业分析",
  data_analysis: "数据分析",
  quant: "量化",
};

const DEFAULT_COMPETENCIES: Competency[] = [
  { competency_id: "common-problem-definition", name: "问题定义", job_direction: "common", sort_order: 10 },
  { competency_id: "common-delivery", name: "执行与交付", job_direction: "common", sort_order: 20 },
  { competency_id: "common-communication", name: "沟通表达", job_direction: "common", sort_order: 30 },
  { competency_id: "common-reflection", name: "复盘与改进", job_direction: "common", sort_order: 40 },
  { competency_id: "ba-forecast", name: "经营预测", job_direction: "business_analysis", sort_order: 110 },
  { competency_id: "ba-diagnosis", name: "经营诊断", job_direction: "business_analysis", sort_order: 120 },
  { competency_id: "ba-market", name: "市场与竞品研究", job_direction: "business_analysis", sort_order: 130 },
  { competency_id: "ba-storytelling", name: "商业汇报", job_direction: "business_analysis", sort_order: 140 },
  { competency_id: "da-quality", name: "数据质量", job_direction: "data_analysis", sort_order: 210 },
  { competency_id: "da-metrics", name: "指标体系", job_direction: "data_analysis", sort_order: 220 },
  { competency_id: "da-analysis", name: "分析与实验", job_direction: "data_analysis", sort_order: 230 },
  { competency_id: "da-automation", name: "看板与自动化", job_direction: "data_analysis", sort_order: 240 },
  { competency_id: "quant-data", name: "市场数据处理", job_direction: "quant", sort_order: 310 },
  { competency_id: "quant-factor", name: "因子研究", job_direction: "quant", sort_order: 320 },
  { competency_id: "quant-backtest", name: "策略回测", job_direction: "quant", sort_order: 330 },
  { competency_id: "quant-risk", name: "风险收益与组合", job_direction: "quant", sort_order: 340 },
];

type CategoryTemplate = {
  title: string;
  job_direction: JobDirection;
  summary: string;
  competency_ids: string[];
};

const TEMPLATE_DEFINITIONS: Record<JobDirection, Array<{ title: string; competency_ids: string[] }>> = {
  business_analysis: [
    { title: "经营收入预测", competency_ids: ["common-problem-definition", "ba-forecast", "common-delivery"] },
    { title: "经营结果分析", competency_ids: ["common-problem-definition", "ba-diagnosis", "ba-storytelling"] },
    { title: "专题问题诊断", competency_ids: ["common-problem-definition", "ba-diagnosis", "common-communication"] },
    { title: "市场与竞品分析", competency_ids: ["ba-market", "common-problem-definition", "common-delivery"] },
    { title: "经营指标看板", competency_ids: ["ba-diagnosis", "da-metrics", "common-delivery"] },
    { title: "策略建议与汇报", competency_ids: ["ba-storytelling", "common-communication", "common-reflection"] },
  ],
  data_analysis: [
    { title: "数据清洗与质量检查", competency_ids: ["da-quality", "common-delivery"] },
    { title: "指标口径建设", competency_ids: ["da-metrics", "common-communication", "common-problem-definition"] },
    { title: "探索性数据分析", competency_ids: ["da-analysis", "common-problem-definition", "common-delivery"] },
    { title: "实验与效果评估", competency_ids: ["da-analysis", "da-metrics", "common-reflection"] },
    { title: "预测或分类分析", competency_ids: ["da-analysis", "common-problem-definition", "common-delivery"] },
    { title: "数据看板与自动化", competency_ids: ["da-automation", "da-quality", "common-delivery"] },
  ],
  quant: [
    { title: "市场数据处理", competency_ids: ["quant-data", "common-delivery"] },
    { title: "因子研究", competency_ids: ["quant-factor", "quant-data", "common-problem-definition"] },
    { title: "策略回测", competency_ids: ["quant-backtest", "quant-data", "common-reflection"] },
    { title: "风险收益分析", competency_ids: ["quant-risk", "quant-data", "common-communication"] },
    { title: "组合优化", competency_ids: ["quant-risk", "quant-factor", "common-problem-definition"] },
    { title: "量化研究报告", competency_ids: ["quant-factor", "quant-backtest", "common-communication"] },
  ],
};

const TEMPLATE_SUMMARIES: Record<JobDirection, string> = {
  business_analysis: "适合把真实经营问题整理成分析、诊断和汇报交付的首期任务模板。",
  data_analysis: "适合从数据质量、指标、分析到自动化逐步建立交付能力的首期任务模板。",
  quant: "适合覆盖市场数据、因子、回测与风险收益分析的首期任务模板。",
};

const CATEGORY_TEMPLATES: CategoryTemplate[] = (Object.keys(TEMPLATE_DEFINITIONS) as JobDirection[]).flatMap((job_direction) =>
  TEMPLATE_DEFINITIONS[job_direction].map((item) => ({
    ...item,
    job_direction,
    summary: TEMPLATE_SUMMARIES[job_direction],
  })),
);

type RawTaskPlatformData = {
  allStudents: Student[];
  challenges: Challenge[];
  submissions: SubmissionRecord[];
  evaluations: EvaluationRecord[];
  storedTasks: PersonalTask[];
  storedCompetencies: Competency[];
  teachers: Teacher[];
};

let rawDataCache: Promise<RawTaskPlatformData> | null = null;
let rawDataCacheExpiresAt = 0;
const RAW_DATA_CACHE_MS = 5_000;

async function loadRawTaskPlatformData(): Promise<RawTaskPlatformData> {
  if (rawDataCache && Date.now() < rawDataCacheExpiresAt) return rawDataCache;
  rawDataCacheExpiresAt = Date.now() + RAW_DATA_CACHE_MS;
  rawDataCache = Promise.all([
    getStudents(),
    getAllChallenges(),
    getSubmissions(),
    getEvaluations(),
    getPersonalTasks(),
    getCompetencies(),
    getTeachers(),
  ]).then(([allStudents, challenges, submissions, evaluations, storedTasks, storedCompetencies, teachers]) => ({
    allStudents, challenges, submissions, evaluations, storedTasks, storedCompetencies, teachers,
  })).catch((error) => {
    rawDataCache = null;
    rawDataCacheExpiresAt = 0;
    throw error;
  });
  return rawDataCache;
}

export function invalidateTaskPlatformCache() {
  rawDataCache = null;
  rawDataCacheExpiresAt = 0;
}

function parseJsonArray<T>(value?: string): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dateOnly(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dayDiff(from?: string, to = new Date()) {
  const start = dateOnly(from);
  if (!start) return 0;
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / 86_400_000));
}

function directionForStudent(student: Student): JobDirection {
  const raw = `${student.position || ""} ${student.ai_x_direction || ""}`.toLowerCase();
  if (raw.includes("量化") || raw.includes("quant")) return "quant";
  if (raw.includes("商业") || raw.includes("商分") || raw.includes("business")) return "business_analysis";
  return "data_analysis";
}

function historicalTaskStatus(submission: SubmissionRecord, hasTeacherReview: boolean): PersonalTask["status"] {
  const state = `${submission.task_state || ""} ${submission.status || ""} ${submission.review_status || ""}`.toLowerCase();
  if (state.includes("accepted") || state.includes("completed") || submission.status === "已评分") return "accepted";
  if (state.includes("returned") || state.includes("revision")) return "returned";
  if (hasTeacherReview) return "accepted";
  return "submitted";
}

function projectHistoricalTasks(
  students: Student[],
  challenges: Challenge[],
  submissions: SubmissionRecord[],
  evaluations: EvaluationRecord[],
): PersonalTask[] {
  const studentMap = new Map(students.map((student) => [student.student_id, student]));
  const challengeMap = new Map(challenges.map((challenge) => [challenge.challenge_id, challenge]));
  const latest = new Map<string, SubmissionRecord>();
  const teacherReviewed = new Set(evaluations.filter((item) => item.evaluator_type === "teacher").map((item) => item.submission_id));
  for (const submission of submissions) {
    const key = `${submission.student_id}:${submission.challenge_id}`;
    const current = latest.get(key);
    if (!current || (submission.submitted_at || "") > (current.submitted_at || "")) latest.set(key, submission);
  }
  return Array.from(latest.values()).map((submission) => {
    const student = studentMap.get(submission.student_id);
    const challenge = challengeMap.get(submission.challenge_id);
    return {
      task_id: `history-${submission.student_id}-${submission.challenge_id}`,
      category_id: submission.challenge_id,
      job_direction: student ? directionForStudent(student) : "data_analysis",
      student_id: submission.student_id,
      mentor_id: student?.mentor_id || "",
      title: submission.project_title || challenge?.title || "历史培训任务",
      business_context: challenge?.brief,
      objective: challenge?.objective,
      instructions_md: challenge?.instructions_md,
      acceptance_criteria: challenge?.rubric,
      competency_ids_json: challenge?.competency_ids_json,
      due_date: challenge?.deadline,
      priority: "medium",
      confidentiality: "internal",
      status: historicalTaskStatus(submission, teacherReviewed.has(submission.submission_id)),
      risk_status: "normal",
      return_count: submission.task_state === "RETURNED" ? 1 : 0,
      is_public: false,
      updated_at: submission.updated_at || submission.submitted_at,
    };
  });
}

async function visibleStudents(principal: ServicePrincipal, students: Student[]) {
  if (isLeader(principal)) return students;
  if (principal.role === "student" || principal.role === "agent") {
    const boundId = getBoundStudentId(principal);
    return students.filter((student) => student.student_id === boundId);
  }
  if (isMentor(principal) || principal.role === "ta") {
    // One mentor account maps to one mentor ID. Never fall back to the full class,
    // otherwise a newly created mentor account would see unrelated interns.
    return students.filter((student) => student.mentor_id === principal.person);
  }
  return [];
}

export async function loadTaskPlatformData(principal: ServicePrincipal) {
  const { allStudents, challenges, submissions, evaluations, storedTasks, storedCompetencies, teachers } = await loadRawTaskPlatformData();
  const students = await visibleStudents(principal, allStudents);
  const studentIds = new Set(students.map((student) => student.student_id));
  const tasksTableConfigured = Boolean(process.env.FEISHU_TASKS_TABLE_ID);
  const allTasks = tasksTableConfigured ? storedTasks : projectHistoricalTasks(allStudents, challenges, submissions, evaluations);
  const tasks = allTasks.filter((task) => studentIds.has(task.student_id));
  return {
    students,
    tasks,
    challenges,
    submissions: submissions.filter((submission) => studentIds.has(submission.student_id)),
    evaluations,
    competencies: storedCompetencies.length > 0 ? storedCompetencies : DEFAULT_COMPETENCIES,
    teachers,
    usingLegacyTaskProjection: !tasksTableConfigured,
  };
}

function taskRisk(task: PersonalTask) {
  if (task.risk_status && task.risk_status !== "normal") return task.risk_status;
  if (task.status === "accepted" || task.status === "cancelled") return "normal";
  const due = dateOnly(task.due_date);
  if (due && due.getTime() < Date.now()) return "overdue";
  if (due && due.getTime() - Date.now() < 3 * 86_400_000) return "due_soon";
  if ((task.return_count || 0) >= 2) return "repeated_return";
  const updated = dateOnly(task.updated_at || task.start_date);
  if (updated && Date.now() - updated.getTime() >= 7 * 86_400_000) return "no_progress";
  return "normal";
}

function acceptedEvaluations(evaluations: EvaluationRecord[], submissionIds: Set<string>) {
  return evaluations.filter((item) => item.evaluator_type === "teacher" && submissionIds.has(item.submission_id));
}

function submissionNeedsReview(submission: SubmissionRecord, teacherReviewedIds: Set<string>) {
  if (teacherReviewedIds.has(submission.submission_id)) return false;
  const state = `${submission.task_state || ""} ${submission.status || ""} ${submission.review_status || ""}`.toLowerCase();
  return !["accepted", "completed", "returned", "revision"].some((value) => state.includes(value));
}

type CapabilityMaturity = "verified" | "practiced" | "untouched";

export type TaskMatchRecommendation = {
  category_id: string;
  title: string;
  summary?: string;
  job_direction: JobDirection;
  source_type?: TaskCategory["source_type"];
  score: number;
  fit: "high" | "medium" | "stretch";
  allocation: TaskMatchResult["allocation"];
  allocation_label: string;
  reasons: string[];
  gaps: string[];
  risks: string[];
  mentor_action: string;
  competency_ids: string[];
};

export type CapabilityProfile = {
  direction: JobDirection;
  profile_completeness: number;
  profile_signals: string[];
  summary: string;
  target_count: number;
  practiced_count: number;
  verified_count: number;
  coverage: number;
  items: Array<Competency & {
    maturity: CapabilityMaturity;
    evidence_count: number;
    assessment_level?: CompetencyAssessment["level"];
  }>;
  recommended_tasks: TaskMatchRecommendation[];
  assessment: InternAssessment;
  ai_assessment: InternAssessment["ai_assessment"];
};

function competencyProgress(
  student: Student,
  tasks: PersonalTask[],
  submissions: SubmissionRecord[],
  evaluations: EvaluationRecord[],
  competencies: Competency[],
) {
  const direction = directionForStudent(student);
  const targets = competencies.filter((item) => item.job_direction === "common" || item.job_direction === direction);
  const taskIds = new Set(tasks.map((task) => task.task_id));
  const studentSubs = submissions.filter((item) => item.student_id === student.student_id && (!item.task_id || taskIds.has(item.task_id)));
  const evals = acceptedEvaluations(evaluations, new Set(studentSubs.map((item) => item.submission_id)));
  const practiceCounts = new Map<string, number>();
  for (const task of tasks) {
    for (const competencyId of parseJsonArray<string>(task.competency_ids_json)) {
      practiceCounts.set(competencyId, (practiceCounts.get(competencyId) || 0) + 1);
    }
  }
  const verified = new Set<string>();
  const assessmentLevels = new Map<string, CompetencyAssessment["level"]>();
  for (const evaluation of evals) {
    for (const assessment of parseJsonArray<CompetencyAssessment>(evaluation.competency_assessment_json)) {
      assessmentLevels.set(assessment.competency_id, assessment.level);
      if (assessment.level === "meets" || assessment.level === "outstanding") {
        verified.add(assessment.competency_id);
      }
    }
  }
  // Historical accepted tasks count as practice, but never auto-verify competency.
  return {
    direction,
    targetCount: targets.length,
    practicedCount: targets.filter((competency) => practiceCounts.has(competency.competency_id)).length,
    verifiedCount: targets.filter((competency) => verified.has(competency.competency_id)).length,
    coverage: targets.length ? Math.round((targets.filter((competency) => verified.has(competency.competency_id)).length / targets.length) * 100) : 0,
    items: targets.map((competency) => ({
      ...competency,
      maturity: (verified.has(competency.competency_id)
        ? "verified"
        : practiceCounts.has(competency.competency_id)
          ? "practiced"
          : "untouched") as CapabilityMaturity,
      evidence_count: (practiceCounts.get(competency.competency_id) || 0) + (assessmentLevels.has(competency.competency_id) ? 1 : 0),
      assessment_level: assessmentLevels.get(competency.competency_id),
    })),
  };
}

function challengeToCategory(challenge: Challenge): TaskCategory {
  return {
    category_id: challenge.challenge_id,
    title: challenge.title,
    job_direction: challenge.job_direction || "data_analysis",
    summary: challenge.brief,
    instructions_md: challenge.instructions_md || [challenge.objective, challenge.deliverables, challenge.rubric].filter(Boolean).join("\n\n"),
    acceptance_criteria: challenge.rubric,
    evidence_requirements_json: challenge.evidence_requirements_json,
    competency_ids_json: challenge.competency_ids_json,
    source_type: challenge.source_type || "historical_challenge",
    status: challenge.status,
    github_repo: challenge.github_repo,
  };
}

function categoryCatalog(challenges: Challenge[]) {
  const templates = CATEGORY_TEMPLATES.map((item, index): TaskCategory => ({
    title: item.title,
    job_direction: item.job_direction,
    competency_ids_json: JSON.stringify(item.competency_ids),
    category_id: `template-${item.job_direction}-${index + 1}`,
    source_type: "template",
    status: "template",
  }));
  return [...templates, ...challenges.map(challengeToCategory)];
}

function categoryCompetencyIds(category: TaskCategory) {
  const configured = parseJsonArray<string>(category.competency_ids_json);
  if (configured.length) return configured;
  const defaults: Record<JobDirection, string[]> = {
    business_analysis: ["common-problem-definition", "ba-diagnosis", "common-delivery"],
    data_analysis: ["common-problem-definition", "da-analysis", "common-delivery"],
    quant: ["quant-data", "quant-factor", "common-delivery"],
  };
  return defaults[category.job_direction];
}

function buildCapabilityProfile(
  student: Student,
  tasks: PersonalTask[],
  submissions: SubmissionRecord[],
  evaluations: EvaluationRecord[],
  competencies: Competency[],
  challenges: Challenge[],
): CapabilityProfile {
  const progress = competencyProgress(student, tasks, submissions, evaluations, competencies);
  const profileFields = [
    student.position,
    student.department,
    student.school,
    student.major,
    student.grade,
    student.portfolio_url,
    student.github_username,
  ];
  const profileCompleteness = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);
  const profileSignals = [
    student.position ? `岗位：${student.position}` : "",
    student.major ? `专业：${student.major}` : "",
    student.school ? `学校：${student.school}` : "",
    student.github_username || student.portfolio_url ? "已有作品或代码入口" : "",
    progress.verifiedCount ? `已通过带教验收的能力：${progress.verifiedCount} 项` : "暂无带教验收能力证据",
  ].filter(Boolean);

  const assessment = buildInternAssessment({
    student,
    direction: progress.direction,
    tasks,
    submissions,
    evaluations,
    capability_items: progress.items,
  });
  const candidates = categoryCatalog(challenges)
    .filter((category) => category.source_type !== "historical_challenge" && category.job_direction === progress.direction)
    .reduce<TaskCategory[]>((result, category) => {
      if (!result.some((item) => item.title === category.title)) result.push(category);
      return result;
    }, []);

  const recommendedTasks = candidates.map((category): TaskMatchRecommendation => {
    const profile = inferTaskProfile({ category });
    const match = matchTaskToIntern(assessment, profile);
    return {
      category_id: category.category_id,
      title: category.title,
      summary: category.summary,
      job_direction: category.job_direction,
      source_type: category.source_type,
      score: match.score,
      fit: match.score >= 85 ? "high" : match.score >= 70 ? "medium" : "stretch",
      allocation: match.allocation,
      allocation_label: match.allocation_label,
      reasons: match.reasons,
      gaps: match.gaps,
      risks: match.risks,
      mentor_action: match.mentor_action,
      competency_ids: profile.competency_ids,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 6);

  assessment.ai_assessment.recommendedTasks = recommendedTasks.map((task) => ({
    taskId: task.category_id,
    matchScore: task.score,
    reason: task.reasons[1] || task.reasons[0] || "与当前岗位能力模型匹配",
    mentorAction: task.mentor_action,
  }));

  return {
    direction: progress.direction,
    profile_completeness: profileCompleteness,
    profile_signals: profileSignals,
    summary: assessment.summary,
    target_count: progress.targetCount,
    practiced_count: progress.practicedCount,
    verified_count: progress.verifiedCount,
    coverage: progress.coverage,
    items: progress.items,
    recommended_tasks: recommendedTasks,
    assessment,
    ai_assessment: assessment.ai_assessment,
  };
}

export async function getManagementOverview(principal: ServicePrincipal) {
  const data = await loadTaskPlatformData(principal);
  const activeStudents = data.students.filter((student) => !["inactive", "离职", "已离岗"].includes(student.status || ""));
  const activeTasks = data.tasks.filter((task) => !["accepted", "cancelled"].includes(task.status || ""));
  const teacherReviewedIds = new Set(data.evaluations.filter((item) => item.evaluator_type === "teacher").map((item) => item.submission_id));
  const pendingSubmissions = data.submissions.filter((submission) => submissionNeedsReview(submission, teacherReviewedIds));
  const risky = activeTasks.filter((task) => taskRisk(task) !== "normal");
  const accepted = data.tasks.filter((task) => task.status === "accepted");
  const finished = data.tasks.filter((task) => ["accepted", "cancelled"].includes(task.status || ""));
  const onTime = accepted.filter((task) => {
    const due = dateOnly(task.due_date);
    const updated = dateOnly(task.updated_at);
    return !due || !updated || updated <= due;
  });
  const directions = (Object.keys(JOB_DIRECTION_LABELS) as JobDirection[]).map((direction) => {
    const students = activeStudents.filter((student) => directionForStudent(student) === direction);
    const tasks = data.tasks.filter((task) => task.job_direction === direction);
    const done = tasks.filter((task) => task.status === "accepted").length;
    return {
      id: direction,
      label: JOB_DIRECTION_LABELS[direction],
      interns: students.length,
      tasks: tasks.length,
      completionRate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    };
  });
  const mentorWorkload = data.teachers
    .filter((teacher) => {
      const role = String(teacher.role || "").toLowerCase();
      return !role || ["teacher", "mentor"].includes(role) || role.includes("教师") || role.includes("带教");
    })
    .map((teacher) => ({
    mentorId: teacher.teacher_id,
    name: teacher.name,
    interns: activeStudents.filter((student) => student.mentor_id === teacher.teacher_id).length,
    pendingReviews: pendingSubmissions.filter((submission) => activeStudents.find((student) => student.student_id === submission.student_id)?.mentor_id === teacher.teacher_id).length,
  }));
  return {
    scope: isLeader(principal) ? "global" : "mentor",
    metrics: {
      activeInterns: activeStudents.length,
      activeTasks: activeTasks.length,
      pendingReviews: pendingSubmissions.length,
      riskAlerts: risky.length,
      completionRate: data.tasks.length ? Math.round((accepted.length / data.tasks.length) * 100) : 0,
      onTimeRate: accepted.length ? Math.round((onTime.length / accepted.length) * 100) : 0,
      finishedTasks: finished.length,
    },
    directions,
    riskyTasks: risky.slice(0, 8).map((task) => ({ ...task, computed_risk: taskRisk(task) })),
    recentCompleted: accepted.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")).slice(0, 8),
    mentorWorkload,
    usingLegacyTaskProjection: data.usingLegacyTaskProjection,
  };
}

export async function getInternRows(principal: ServicePrincipal) {
  const data = await loadTaskPlatformData(principal);
  return data.students.map((student) => {
    const tasks = data.tasks.filter((task) => task.student_id === student.student_id);
    const completed = tasks.filter((task) => task.status === "accepted");
    const onTime = completed.filter((task) => {
      const due = dateOnly(task.due_date);
      const updated = dateOnly(task.updated_at);
      return !due || !updated || updated <= due;
    });
    const latest = tasks.map((task) => task.updated_at || task.start_date || "").sort().at(-1) || "";
    const mentor = data.teachers.find((item) => item.teacher_id === student.mentor_id);
    return {
      ...student,
      job_direction: directionForStudent(student),
      mentor_name: mentor?.name || "未分配",
      days_on_job: dayDiff(student.internship_start_date),
      completed_tasks: completed.length,
      total_tasks: tasks.length,
      active_tasks: tasks.filter((task) => !["accepted", "cancelled"].includes(task.status || "")).length,
      on_time_rate: completed.length ? Math.round((onTime.length / completed.length) * 100) : 0,
      last_activity_at: latest,
      risk_status: tasks.some((task) => taskRisk(task) !== "normal") ? "risk" : "normal",
    };
  });
}

export async function getInternDetail(principal: ServicePrincipal, studentId: string) {
  const data = await loadTaskPlatformData(principal);
  const student = data.students.find((item) => item.student_id === studentId);
  if (!student) return null;
  const tasks = data.tasks.filter((task) => task.student_id === studentId).map((task) => ({ ...task, computed_risk: taskRisk(task) }));
  const submissions = data.submissions.filter((submission) => submission.student_id === studentId);
  const submissionIds = new Set(submissions.map((submission) => submission.submission_id));
  const evaluations = data.evaluations.filter((evaluation) => submissionIds.has(evaluation.submission_id));
  const capability = buildCapabilityProfile(student, tasks, submissions, evaluations, data.competencies, data.challenges);
  return {
    student,
    job_direction: directionForStudent(student),
    mentor: data.teachers.find((item) => item.teacher_id === student.mentor_id) || null,
    tasks,
    submissions,
    evaluations,
    capability,
    summary: {
      daysOnJob: dayDiff(student.internship_start_date),
      completionRate: tasks.length ? Math.round((tasks.filter((task) => task.status === "accepted").length / tasks.length) * 100) : 0,
      pendingTasks: tasks.filter((task) => !["accepted", "cancelled"].includes(task.status || "")).length,
    },
  };
}

export async function getInternTaskMatch(
  principal: ServicePrincipal,
  studentId: string,
  input: {
    category_id?: string;
    title?: string;
    description?: string;
    job_direction?: JobDirection;
    competency_ids?: string[];
  },
) {
  const data = await loadTaskPlatformData(principal);
  const student = data.students.find((item) => item.student_id === studentId);
  if (!student) return null;
  const tasks = data.tasks.filter((task) => task.student_id === studentId);
  const submissions = data.submissions.filter((submission) => submission.student_id === studentId);
  const submissionIds = new Set(submissions.map((submission) => submission.submission_id));
  const evaluations = data.evaluations.filter((evaluation) => submissionIds.has(evaluation.submission_id));
  const progress = competencyProgress(student, tasks, submissions, evaluations, data.competencies);
  const assessment = buildInternAssessment({
    student,
    direction: progress.direction,
    tasks,
    submissions,
    evaluations,
    capability_items: progress.items,
  });
  const category = input.category_id
    ? categoryCatalog(data.challenges).find((item) => item.category_id === input.category_id) || null
    : null;
  const taskProfile = inferTaskProfile({
    category,
    title: input.title,
    description: input.description,
    job_direction: input.job_direction || category?.job_direction || progress.direction,
    competency_ids: input.competency_ids,
  });
  return matchTaskToIntern(assessment, taskProfile);
}

export async function getTaskCategoriesView(principal: ServicePrincipal) {
  const data = await loadTaskPlatformData(principal);
  return categoryCatalog(data.challenges).map((category) => {
    const tasks = data.tasks.filter((task) => task.category_id === category.category_id);
    const students = new Set(tasks.map((task) => task.student_id));
    const completed = tasks.filter((task) => task.status === "accepted");
    const cycleDays = completed.map((task) => {
      const start = dateOnly(task.start_date);
      const end = dateOnly(task.updated_at);
      return start && end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000)) : 0;
    }).filter(Boolean);
    return {
      ...category,
      task_count: tasks.length,
      participant_count: students.size,
      completion_rate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
      average_cycle_days: cycleDays.length ? Math.round(cycleDays.reduce((sum, value) => sum + value, 0) / cycleDays.length) : 0,
    };
  });
}

export async function getVisibleTasks(principal: ServicePrincipal) {
  const data = await loadTaskPlatformData(principal);
  const students = new Map(data.students.map((student) => [student.student_id, student]));
  const mentors = new Map(data.teachers.map((teacher) => [teacher.teacher_id, teacher]));
  return data.tasks.map((task) => ({
    ...task,
    student_name: students.get(task.student_id)?.name || task.student_id,
    mentor_name: mentors.get(task.mentor_id)?.name || "未分配",
    computed_risk: taskRisk(task),
  }));
}
