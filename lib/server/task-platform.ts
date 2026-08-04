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

const CATEGORY_TEMPLATES: Array<Omit<TaskCategory, "category_id">> = [
  ...["经营收入预测", "经营结果分析", "专题问题诊断", "市场与竞品分析", "经营指标看板", "策略建议与汇报"].map((title) => ({ title, job_direction: "business_analysis" as const })),
  ...["数据清洗与质量检查", "指标口径建设", "探索性数据分析", "实验与效果评估", "预测或分类分析", "数据看板与自动化"].map((title) => ({ title, job_direction: "data_analysis" as const })),
  ...["市场数据处理", "因子研究", "策略回测", "风险收益分析", "组合优化", "量化研究报告"].map((title) => ({ title, job_direction: "quant" as const })),
];

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
  const practiced = new Set(tasks.flatMap((task) => parseJsonArray<string>(task.competency_ids_json)));
  const verified = new Set<string>();
  for (const evaluation of evals) {
    for (const assessment of parseJsonArray<CompetencyAssessment>(evaluation.competency_assessment_json)) {
      if (assessment.level === "meets" || assessment.level === "outstanding") verified.add(assessment.competency_id);
    }
  }
  // Historical accepted tasks count as practice, but never auto-verify competency.
  return {
    direction,
    targetCount: targets.length,
    practicedCount: practiced.size,
    verifiedCount: verified.size,
    coverage: targets.length ? Math.round((verified.size / targets.length) * 100) : 0,
    items: targets.map((competency) => ({
      ...competency,
      maturity: verified.has(competency.competency_id)
        ? "verified"
        : practiced.has(competency.competency_id)
          ? "practiced"
          : "untouched",
    })),
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
  return {
    student,
    job_direction: directionForStudent(student),
    mentor: data.teachers.find((item) => item.teacher_id === student.mentor_id) || null,
    tasks,
    submissions,
    evaluations,
    summary: {
      daysOnJob: dayDiff(student.internship_start_date),
      completionRate: tasks.length ? Math.round((tasks.filter((task) => task.status === "accepted").length / tasks.length) * 100) : 0,
      pendingTasks: tasks.filter((task) => !["accepted", "cancelled"].includes(task.status || "")).length,
    },
  };
}

export async function getTaskCategoriesView(principal: ServicePrincipal) {
  const data = await loadTaskPlatformData(principal);
  const stored = data.challenges.map((challenge): TaskCategory => ({
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
  }));
  const templates = CATEGORY_TEMPLATES.map((item, index): TaskCategory => ({
    ...item,
    category_id: `template-${item.job_direction}-${index + 1}`,
    source_type: "template",
    status: "template",
  }));
  return [...templates, ...stored].map((category) => {
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
