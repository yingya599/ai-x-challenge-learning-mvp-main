import type { EvaluationRecord, SubmissionRecord } from "./feishu";
import type {
  AiAssessmentConfidence,
  AiAssessmentRole,
  AiInternAssessmentResult,
  CompetencyAssessmentLevel,
  JobDirection,
  PersonalTask,
  Student,
  TaskCategory,
} from "./types";

export type CapabilityMaturity = "verified" | "practiced" | "untouched";

export type CapabilityEvidenceItem = {
  competency_id: string;
  name: string;
  maturity: CapabilityMaturity;
  evidence_count: number;
  assessment_level?: CompetencyAssessmentLevel;
};

type RoleDimensionConfig = {
  id: string;
  label: string;
  weight: number;
  competency_ids: string[];
};

type RoleModel = {
  role: AiAssessmentRole;
  direction: JobDirection;
  label: string;
  dimensions: RoleDimensionConfig[];
  default_dimension_ids: string[];
  analysis_dimension_id: string;
  business_dimension_id: string;
  tool_dimension_id: string;
  delivery_dimension_id: string;
  collaboration_dimension_id: string;
};

export type AssessmentDimension = {
  id: string;
  label: string;
  score: number;
  weight?: number;
  evidence_count: number;
  evidence: string[];
};

export type RoleExampleProfile = {
  role: AiAssessmentRole;
  role_label: string;
  overall_score: number;
  level: string;
  highlights: string[];
};

export type InternAssessment = {
  intern_id: string;
  role: AiAssessmentRole;
  job_direction: JobDirection;
  role_label: string;
  overall_score: number;
  level: string;
  stage_target_score: number;
  attainment_rate: number;
  trend: number;
  trend_label: string;
  evidence_confidence: AiAssessmentConfidence;
  summary: string;
  score_explanation: string[];
  evidence: string[];
  strengths: string[];
  weaknesses: string[];
  next_steps: string[];
  mentor_advice: string[];
  risk_alerts: string[];
  generic_dimensions: AssessmentDimension[];
  role_dimensions: AssessmentDimension[];
  task_stats: {
    assigned_count: number;
    active_count: number;
    accepted_count: number;
    returned_count: number;
    submission_count: number;
    teacher_evaluation_count: number;
    completion_rate: number;
    average_teacher_score: number;
  };
  role_examples: RoleExampleProfile[];
  ai_assessment: AiInternAssessmentResult;
};

export type TaskProfile = {
  role: AiAssessmentRole;
  job_direction: JobDirection;
  competency_ids: string[];
  requirements: Array<{
    dimension_id: string;
    label: string;
    required_level: number;
    weight: number;
  }>;
  difficulty: number;
  business_risk: "low" | "medium" | "high";
  estimated_hours: number;
  growth_value: number;
  mentor_intervention: "none" | "checkpoint" | "high";
  checkpoints: string[];
};

export type TaskMatchResult = {
  score: number;
  allocation: "direct" | "checkpoint" | "assist" | "hold";
  allocation_label: string;
  breakdown: {
    skill_match: number;
    role_relevance: number;
    growth_value: number;
    delivery_reliability: number;
    time_availability: number;
    risk_penalty: number;
  };
  task_profile: TaskProfile;
  reasons: string[];
  gaps: string[];
  risks: string[];
  mentor_action: string;
};

export type TaskProfileInput = {
  category?: Pick<TaskCategory, "category_id" | "title" | "job_direction" | "summary" | "instructions_md" | "acceptance_criteria" | "competency_ids_json"> | null;
  title?: string;
  description?: string;
  job_direction?: JobDirection;
  competency_ids?: string[];
};

const ROLE_MODELS: Record<JobDirection, RoleModel> = {
  business_analysis: {
    role: "business_analyst",
    direction: "business_analysis",
    label: "商业分析",
    dimensions: [
      { id: "business_understanding", label: "业务理解", weight: 0.25, competency_ids: ["ba-diagnosis", "ba-forecast", "ba-market"] },
      { id: "structured_analysis", label: "问题拆解与结构化分析", weight: 0.2, competency_ids: ["common-problem-definition", "ba-diagnosis", "ba-forecast"] },
      { id: "data_awareness", label: "数据意识", weight: 0.15, competency_ids: ["ba-forecast", "da-metrics", "da-quality"] },
      { id: "market_analysis", label: "竞品/市场/用户分析", weight: 0.15, competency_ids: ["ba-market"] },
      { id: "documentation", label: "文档与表达", weight: 0.15, competency_ids: ["ba-storytelling", "common-communication", "common-delivery"] },
      { id: "collaboration", label: "协作与推进", weight: 0.1, competency_ids: ["common-delivery", "common-communication", "common-reflection"] },
    ],
    default_dimension_ids: ["business_understanding", "structured_analysis", "documentation"],
    analysis_dimension_id: "structured_analysis",
    business_dimension_id: "business_understanding",
    tool_dimension_id: "data_awareness",
    delivery_dimension_id: "documentation",
    collaboration_dimension_id: "collaboration",
  },
  data_analysis: {
    role: "data_analyst",
    direction: "data_analysis",
    label: "数据分析",
    dimensions: [
      { id: "data_processing", label: "SQL / Python / 数据处理", weight: 0.2, competency_ids: ["da-quality", "da-automation", "common-delivery"] },
      { id: "metric_system", label: "指标体系理解", weight: 0.2, competency_ids: ["da-metrics", "common-problem-definition"] },
      { id: "analysis_statistics", label: "分析方法与统计思维", weight: 0.2, competency_ids: ["da-analysis", "common-problem-definition", "common-reflection"] },
      { id: "business_insight", label: "业务洞察", weight: 0.15, competency_ids: ["da-metrics", "da-analysis", "common-problem-definition"] },
      { id: "visualization", label: "可视化与报告", weight: 0.15, competency_ids: ["da-automation", "common-communication", "common-delivery"] },
      { id: "data_quality", label: "数据质量与复现性", weight: 0.1, competency_ids: ["da-quality", "common-reflection"] },
    ],
    default_dimension_ids: ["data_processing", "analysis_statistics", "visualization"],
    analysis_dimension_id: "analysis_statistics",
    business_dimension_id: "business_insight",
    tool_dimension_id: "data_processing",
    delivery_dimension_id: "visualization",
    collaboration_dimension_id: "visualization",
  },
  quant: {
    role: "quant",
    direction: "quant",
    label: "量化",
    dimensions: [
      { id: "math_statistics", label: "数学/统计基础", weight: 0.2, competency_ids: ["quant-factor", "quant-backtest"] },
      { id: "modeling_research", label: "建模与研究能力", weight: 0.25, competency_ids: ["quant-factor", "quant-data", "common-problem-definition"] },
      { id: "engineering", label: "编程与工程实现", weight: 0.2, competency_ids: ["quant-data", "quant-factor", "common-delivery"] },
      { id: "backtest_rigor", label: "回测与评估严谨性", weight: 0.15, competency_ids: ["quant-backtest", "common-reflection"] },
      { id: "market_risk", label: "金融市场与风险理解", weight: 0.1, competency_ids: ["quant-risk", "quant-data"] },
      { id: "documentation", label: "文档与协作", weight: 0.1, competency_ids: ["common-communication", "common-delivery", "common-reflection"] },
    ],
    default_dimension_ids: ["math_statistics", "modeling_research", "engineering"],
    analysis_dimension_id: "modeling_research",
    business_dimension_id: "market_risk",
    tool_dimension_id: "engineering",
    delivery_dimension_id: "documentation",
    collaboration_dimension_id: "documentation",
  },
};

export const ROLE_EXAMPLE_PROFILES: RoleExampleProfile[] = [
  { role: "business_analyst", role_label: "商业分析", overall_score: 68, level: "L3", highlights: ["业务理解 3.6/5", "结构化分析 3.4/5", "下一步补强数据意识"] },
  { role: "data_analyst", role_label: "数据分析", overall_score: 72, level: "L4", highlights: ["数据处理 3.8/5", "统计分析 3.7/5", "下一步补强业务洞察"] },
  { role: "quant", role_label: "量化", overall_score: 65, level: "L3", highlights: ["建模研究 3.5/5", "工程实现 3.3/5", "下一步补强回测严谨性"] },
];

const ASSESSMENT_LEVEL_SCORES: Record<CompetencyAssessmentLevel, number> = {
  not_demonstrated: 0,
  emerging: 2,
  meets: 3.5,
  outstanding: 5,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function parseStringArray(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function dateValue(value?: string) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function isOpenTask(task: PersonalTask) {
  return !["accepted", "cancelled"].includes(task.status || "");
}

function roleModel(direction: JobDirection) {
  return ROLE_MODELS[direction];
}

function capabilityScore(item: CapabilityEvidenceItem) {
  if (item.assessment_level) return ASSESSMENT_LEVEL_SCORES[item.assessment_level];
  if (item.maturity === "verified") return 3.5;
  if (item.maturity === "practiced") return clamp(1.4 + item.evidence_count * 0.35, 1.4, 3);
  return 0;
}

function confidenceFor(teacherEvaluationCount: number, evidenceCount: number): AiAssessmentConfidence {
  if (teacherEvaluationCount >= 3 && evidenceCount >= 8) return "high";
  if (teacherEvaluationCount >= 1 || evidenceCount >= 4) return "medium";
  return "low";
}

function stageFor(overallScore: number) {
  if (overallScore < 40) return { level: "L1", target: 40 };
  if (overallScore < 55) return { level: "L2", target: 55 };
  if (overallScore < 70) return { level: "L3", target: 70 };
  if (overallScore < 85) return { level: "L4", target: 85 };
  return { level: "L5", target: 100 };
}

function trendFor(evaluations: EvaluationRecord[]) {
  const scores = evaluations
    .filter((item) => item.evaluator_type === "teacher" && item.score_total > 0)
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
    .map((item) => item.score_total);
  if (scores.length < 2) return { value: 0, label: "等待下一次带教验收" };
  const current = scores[scores.length - 1];
  const previous = mean(scores.slice(0, -1));
  const value = Math.round(current - previous);
  return {
    value,
    label: value > 0 ? `较上一周期 +${value} 分` : value < 0 ? `较上一周期 ${value} 分` : "与上一周期持平",
  };
}

function scoreDimension(config: RoleDimensionConfig, capabilityById: Map<string, CapabilityEvidenceItem>): AssessmentDimension {
  const matched = config.competency_ids
    .map((competencyId) => capabilityById.get(competencyId))
    .filter((item): item is CapabilityEvidenceItem => Boolean(item));
  const evidence = matched.filter((item) => item.evidence_count > 0 || item.assessment_level).map((item) => item.name);
  return {
    id: config.id,
    label: config.label,
    score: roundToOne(mean(config.competency_ids.map((competencyId) => {
      const item = capabilityById.get(competencyId);
      return item ? capabilityScore(item) : 0;
    }))),
    weight: config.weight,
    evidence_count: matched.reduce((sum, item) => sum + item.evidence_count, 0),
    evidence,
  };
}

function dimensionById(dimensions: AssessmentDimension[], id: string) {
  return dimensions.find((dimension) => dimension.id === id);
}

function genericDimension(
  id: string,
  label: string,
  values: Array<AssessmentDimension | undefined>,
  extraEvidence: string[] = [],
) {
  const available = values.filter((item): item is AssessmentDimension => Boolean(item));
  return {
    id,
    label,
    score: roundToOne(mean(available.map((item) => item.score))),
    evidence_count: available.reduce((sum, item) => sum + item.evidence_count, 0),
    evidence: Array.from(new Set([...available.flatMap((item) => item.evidence), ...extraEvidence])).slice(0, 4),
  };
}

function allocationFor(score: number): Pick<TaskMatchResult, "allocation" | "allocation_label"> {
  if (score >= 85) return { allocation: "direct", allocation_label: "可直接分配" };
  if (score >= 70) return { allocation: "checkpoint", allocation_label: "可分配，设置检查点" };
  if (score >= 55) return { allocation: "assist", allocation_label: "适合辅助参与或拆分子任务" };
  return { allocation: "hold", allocation_label: "暂不建议分配" };
}

export function roleForDirection(direction: JobDirection): AiAssessmentRole {
  return roleModel(direction).role;
}

export function inferCompetencyIds(direction: JobDirection, text: string, configuredIds: string[] = []) {
  const source = text.toLowerCase();
  const ids = new Set(configuredIds.filter(Boolean));
  ids.add("common-problem-definition");
  ids.add("common-delivery");
  if (/沟通|汇报|ppt|报告|presentation/.test(source)) ids.add("common-communication");
  if (/复盘|迭代|改进|验证/.test(source)) ids.add("common-reflection");

  if (direction === "business_analysis") {
    if (/预测|收入|营收|forecast/.test(source)) ids.add("ba-forecast");
    if (/诊断|原因|经营|问题|增长/.test(source)) ids.add("ba-diagnosis");
    if (/市场|竞品|用户|调研/.test(source)) ids.add("ba-market");
    if (/建议|汇报|ppt|报告/.test(source)) ids.add("ba-storytelling");
  } else if (direction === "quant") {
    if (/数据|行情|价格|收益率/.test(source)) ids.add("quant-data");
    if (/因子|模型|研究/.test(source)) ids.add("quant-factor");
    if (/回测|策略|评估/.test(source)) ids.add("quant-backtest");
    if (/风险|收益|组合|敞口/.test(source)) ids.add("quant-risk");
  } else {
    if (/清洗|质量|口径|预处理|异常值/.test(source)) ids.add("da-quality");
    if (/指标|口径|kpi|收入|流量|留存|转化/.test(source)) ids.add("da-metrics");
    if (/分析|实验|效果|预测|分类|模型|时间序列|arima|prophet|统计/.test(source)) ids.add("da-analysis");
    if (/看板|自动化|dashboard|可视化|报表/.test(source)) ids.add("da-automation");
  }

  const directionalIds = ROLE_MODELS[direction].dimensions.flatMap((item) => item.competency_ids);
  if (!Array.from(ids).some((item) => directionalIds.includes(item))) {
    for (const dimensionId of ROLE_MODELS[direction].default_dimension_ids) {
      const config = ROLE_MODELS[direction].dimensions.find((item) => item.id === dimensionId);
      if (config) ids.add(config.competency_ids[0]);
    }
  }
  return Array.from(ids);
}

export function buildInternAssessment(input: {
  student: Student;
  direction: JobDirection;
  tasks: PersonalTask[];
  submissions: SubmissionRecord[];
  evaluations: EvaluationRecord[];
  capability_items: CapabilityEvidenceItem[];
}) {
  const model = roleModel(input.direction);
  const capabilityById = new Map(input.capability_items.map((item) => [item.competency_id, item]));
  const roleDimensions = model.dimensions.map((config) => scoreDimension(config, capabilityById));
  const assignedTasks = input.tasks.filter((task) => task.status !== "cancelled");
  const acceptedTasks = assignedTasks.filter((task) => task.status === "accepted");
  const activeTasks = assignedTasks.filter(isOpenTask);
  const returnedTasks = assignedTasks.filter((task) => task.status === "returned" || (task.return_count || 0) > 0);
  const teacherEvaluations = input.evaluations.filter((item) => item.evaluator_type === "teacher");
  const averageTeacherScore = teacherEvaluations.length ? Math.round(mean(teacherEvaluations.map((item) => item.score_total))) : 0;
  const completionRate = assignedTasks.length ? Math.round((acceptedTasks.length / assignedTasks.length) * 100) : 0;
  const evidenceCount = input.capability_items.reduce((sum, item) => sum + item.evidence_count, 0);
  const confidence = confidenceFor(teacherEvaluations.length, evidenceCount);
  const trend = trendFor(teacherEvaluations);
  const weightedRoleScore = roleDimensions.reduce((sum, dimension) => sum + dimension.score * (dimension.weight || 0), 0);
  const overallScore = Math.round(weightedRoleScore * 20);
  const stage = stageFor(overallScore);
  const attainmentRate = Math.min(100, Math.round((overallScore / stage.target) * 100));

  const commonDelivery = capabilityById.get("common-delivery");
  const commonCommunication = capabilityById.get("common-communication");
  const commonReflection = capabilityById.get("common-reflection");
  const commonProblem = capabilityById.get("common-problem-definition");
  const teacherScoreDimension = averageTeacherScore
    ? { id: "teacher_score", label: "带教验收", score: roundToOne(averageTeacherScore / 20), evidence_count: teacherEvaluations.length, evidence: ["带教验收评分"] }
    : undefined;
  const itemDimension = (id: string, label: string, item?: CapabilityEvidenceItem): AssessmentDimension | undefined => item
    ? { id, label, score: capabilityScore(item), evidence_count: item.evidence_count, evidence: item.evidence_count ? [item.name] : [] }
    : undefined;
  const roleDimension = (id: string) => dimensionById(roleDimensions, id);
  const learningScore = assignedTasks.length
    ? clamp(
      (input.capability_items.filter((item) => item.maturity !== "untouched").length / Math.max(input.capability_items.length, 1)) * 2.2
      + (input.capability_items.filter((item) => item.maturity === "verified").length / Math.max(input.capability_items.length, 1)) * 2
      + (trend.value > 0 ? 0.8 : 0),
      0,
      5,
    )
    : 0;
  const independenceScore = assignedTasks.length
    ? clamp((acceptedTasks.length / assignedTasks.length) * 4 + (returnedTasks.length ? 0 : 0.7) + (input.submissions.length ? 0.3 : 0), 0, 5)
    : 0;
  const genericDimensions: AssessmentDimension[] = [
    genericDimension("professional", "岗位专业能力", roleDimensions),
    genericDimension("analytical_thinking", "分析思维", [roleDimension(model.analysis_dimension_id), itemDimension("problem_definition", "问题定义", commonProblem)]),
    genericDimension("business_understanding", "业务理解", [roleDimension(model.business_dimension_id)]),
    genericDimension("tooling", "工具/技术能力", [roleDimension(model.tool_dimension_id)]),
    genericDimension("delivery_quality", "交付质量", [roleDimension(model.delivery_dimension_id), itemDimension("delivery", "执行与交付", commonDelivery), teacherScoreDimension]),
    genericDimension("communication", "沟通协作", [roleDimension(model.collaboration_dimension_id), itemDimension("communication", "沟通表达", commonCommunication)]),
    {
      id: "learning_speed",
      label: "学习成长速度",
      score: roundToOne(learningScore),
      evidence_count: input.capability_items.filter((item) => item.maturity !== "untouched").reduce((sum, item) => sum + item.evidence_count, 0),
      evidence: trend.value !== 0 ? [trend.label] : commonReflection?.evidence_count ? [commonReflection.name] : [],
    },
    {
      id: "independence",
      label: "独立性",
      score: roundToOne(independenceScore),
      evidence_count: acceptedTasks.length + input.submissions.length,
      evidence: acceptedTasks.length ? [`已通过任务 ${acceptedTasks.length} 项`] : input.submissions.length ? [`已提交 ${input.submissions.length} 次`] : [],
    },
  ];

  const strongest = roleDimensions
    .filter((dimension) => dimension.evidence_count > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  const weakest = [...roleDimensions].sort((a, b) => a.score - b.score).slice(0, 2);
  const evidence = [
    `已分配任务 ${assignedTasks.length} 项`,
    `提交记录 ${input.submissions.length} 次`,
    `带教验收 ${teacherEvaluations.length} 次`,
    evidenceCount ? `能力证据 ${evidenceCount} 条` : "尚无可核验的能力证据",
  ];
  const riskAlerts: string[] = [];
  if (confidence === "low") riskAlerts.push("当前评分以任务映射和有限档案为主，证据可信度较低。");
  if (returnedTasks.length >= 2) riskAlerts.push("已有多次退回记录，分配复杂任务前建议增加中期检查点。");
  if (activeTasks.some((task) => {
    const due = dateValue(task.due_date);
    return due && due.getTime() < Date.now();
  })) riskAlerts.push("存在逾期中的个人任务，建议先确认当前任务负荷。");
  const strengths = strongest.length
    ? strongest.map((dimension) => `${dimension.label} ${dimension.score}/5`)
    : ["暂未形成可确认的优势项，建议先完成一项边界清晰的任务并由带教验收。"];
  const weaknesses = weakest.map((dimension) => `${dimension.label} 当前 ${dimension.score}/5`);
  const nextSteps = weakest.map((dimension) => `下一项任务聚焦「${dimension.label}」，设置一个可验收的中间产物。`);
  const mentorAdvice = [
    confidence === "low" ? "先分配范围清晰、难度 2-3 的任务，并在验收时填写能力评价。" : "优先把任务要求与当前最弱能力项一一对应，形成可追踪的成长证据。",
    trend.value < 0 ? "针对最近一次验收的退步项安排复盘，不直接叠加更高难度任务。" : `在任务中期检查「${weakest[0]?.label || "核心能力"}」的过程证据。`,
  ];
  const scoreExplanation = [
    `综合实力分按${model.label}岗位的 ${roleDimensions.map((item) => `${item.label} ${Math.round((item.weight || 0) * 100)}%`).join("、")} 加权计算。`,
    `各项能力采用 0-5 级：未体现、需大量指导、能按模板完成、可独立完成、可处理复杂任务、可沉淀方法。`,
    `当前证据来自任务能力映射、提交记录和带教验收；证据可信度为${confidence === "high" ? "高" : confidence === "medium" ? "中" : "低"}。`,
  ];
  const aiAssessment: AiInternAssessmentResult = {
    internId: input.student.student_id,
    role: model.role,
    overallScore,
    level: stage.level,
    strengths,
    weaknesses,
    recommendedTasks: [],
    confidence,
    evidenceConfidence: confidence,
    evidence,
    source: "rule_based",
    generatedAt: new Date().toISOString(),
  };

  return {
    intern_id: input.student.student_id,
    role: model.role,
    job_direction: input.direction,
    role_label: model.label,
    overall_score: overallScore,
    level: stage.level,
    stage_target_score: stage.target,
    attainment_rate: attainmentRate,
    trend: trend.value,
    trend_label: trend.label,
    evidence_confidence: confidence,
    summary: `当前综合实力 ${overallScore}/100（${stage.level}），距本阶段目标 ${stage.target} 分还差 ${Math.max(0, stage.target - overallScore)} 分。`,
    score_explanation: scoreExplanation,
    evidence,
    strengths,
    weaknesses,
    next_steps: nextSteps,
    mentor_advice: mentorAdvice,
    risk_alerts: riskAlerts,
    generic_dimensions: genericDimensions,
    role_dimensions: roleDimensions,
    task_stats: {
      assigned_count: assignedTasks.length,
      active_count: activeTasks.length,
      accepted_count: acceptedTasks.length,
      returned_count: returnedTasks.length,
      submission_count: input.submissions.length,
      teacher_evaluation_count: teacherEvaluations.length,
      completion_rate: completionRate,
      average_teacher_score: averageTeacherScore,
    },
    role_examples: ROLE_EXAMPLE_PROFILES,
    ai_assessment: aiAssessment,
  } satisfies InternAssessment;
}

export function inferTaskProfile(input: TaskProfileInput): TaskProfile {
  const direction = input.job_direction || input.category?.job_direction || "data_analysis";
  const model = roleModel(direction);
  const source = [
    input.title,
    input.description,
    input.category?.title,
    input.category?.summary,
    input.category?.instructions_md,
    input.category?.acceptance_criteria,
  ].filter(Boolean).join("\n");
  const configured = input.competency_ids?.length ? input.competency_ids : parseStringArray(input.category?.competency_ids_json);
  const competencyIds = inferCompetencyIds(direction, source, configured);
  const advancedSignalCount = ["建模", "时间序列", "预测", "回测", "策略", "算法", "自动化", "实验", "统计", "sql", "python", "机器学习", "因子", "多模型"]
    .filter((signal) => source.toLowerCase().includes(signal))
    .length;
  let difficulty = 2 + (competencyIds.length >= 4 ? 1 : 0) + (competencyIds.length >= 6 ? 1 : 0) + Math.min(2, advancedSignalCount);
  if (source.length > 900) difficulty += 1;
  difficulty = clamp(difficulty, 1, 5);
  const riskHigh = /保密|敏感|生产|正式上线|客户|财务|交易|投资/.test(source);
  const riskMedium = /跨部门|外部|预算|核心指标|市场/.test(source) || difficulty >= 4;
  const businessRisk = riskHigh ? "high" : riskMedium ? "medium" : "low";
  const requestedConfigs = model.dimensions.filter((dimension) => dimension.competency_ids.some((item) => competencyIds.includes(item)));
  const selectedConfigs = requestedConfigs.length
    ? requestedConfigs
    : model.default_dimension_ids.map((id) => model.dimensions.find((dimension) => dimension.id === id)).filter((item): item is RoleDimensionConfig => Boolean(item));
  const totalWeight = selectedConfigs.reduce((sum, item) => sum + item.weight, 0);
  const requiredLevel = roundToOne(clamp(1.5 + difficulty * 0.6, 2, 5));
  const requirements = selectedConfigs.map((dimension) => ({
    dimension_id: dimension.id,
    label: dimension.label,
    required_level: requiredLevel,
    weight: dimension.weight / totalWeight,
  }));
  const mentorIntervention = businessRisk === "high" || difficulty >= 4 ? "high" : difficulty >= 3 ? "checkpoint" : "none";
  return {
    role: model.role,
    job_direction: direction,
    competency_ids: competencyIds,
    requirements,
    difficulty,
    business_risk: businessRisk,
    estimated_hours: Math.round(6 + difficulty * 6 + Math.max(0, competencyIds.length - 2) * 2),
    growth_value: clamp(difficulty, 1, 5),
    mentor_intervention: mentorIntervention,
    checkpoints: mentorIntervention === "high"
      ? ["任务口径确认", "中期方法与过程证据检查", "提交前验收预检"]
      : mentorIntervention === "checkpoint"
        ? ["任务口径确认", "中期成果检查"]
        : ["提交前验收预检"],
  };
}

export function matchTaskToIntern(assessment: InternAssessment, taskProfile: TaskProfile): TaskMatchResult {
  const dimensionById = new Map(assessment.role_dimensions.map((dimension) => [dimension.id, dimension]));
  const skillMatch = Math.round(taskProfile.requirements.reduce((sum, requirement) => {
    const current = dimensionById.get(requirement.dimension_id)?.score || 0;
    return sum + Math.min(current / requirement.required_level, 1) * requirement.weight;
  }, 0) * 100);
  const roleRelevance = assessment.job_direction === taskProfile.job_direction ? 100 : 35;
  const weightedGap = taskProfile.requirements.reduce((sum, requirement) => {
    const current = dimensionById.get(requirement.dimension_id)?.score || 0;
    return sum + (requirement.required_level - current) * requirement.weight;
  }, 0);
  let growthValue = 0;
  if (weightedGap < -0.5) growthValue = 55;
  else if (weightedGap <= 0.4) growthValue = 78;
  else if (weightedGap <= 1.2) growthValue = 100;
  else if (weightedGap <= 2) growthValue = 68;
  else growthValue = 32;
  const hasDeliveryEvidence = assessment.task_stats.teacher_evaluation_count > 0 || assessment.task_stats.accepted_count > 0;
  const deliveryReliability = hasDeliveryEvidence
    ? Math.round(clamp(
      assessment.task_stats.completion_rate * 0.55
      + assessment.task_stats.average_teacher_score * 0.3
      + (assessment.task_stats.returned_count ? 0 : 15),
      0,
      100,
    ))
    : 55;
  const nearDue = assessment.task_stats.active_count > 0 && assessment.task_stats.active_count >= 2;
  const timeAvailability = clamp(100 - assessment.task_stats.active_count * 26 - (nearDue ? 10 : 0), 20, 100);
  let riskPenalty = taskProfile.business_risk === "high" ? 10 : taskProfile.business_risk === "medium" ? 5 : 0;
  if (taskProfile.difficulty >= 4 && skillMatch < 65) riskPenalty += 5;
  if (assessment.evidence_confidence === "low" && taskProfile.difficulty >= 3) riskPenalty += 4;
  if (assessment.task_stats.returned_count >= 2) riskPenalty += 4;
  const score = Math.round(clamp(
    skillMatch * 0.5
    + roleRelevance * 0.15
    + growthValue * 0.15
    + deliveryReliability * 0.1
    + timeAvailability * 0.1
    - riskPenalty,
    0,
    100,
  ));
  const allocation = allocationFor(score);
  const gaps = taskProfile.requirements
    .map((requirement) => {
      const current = dimensionById.get(requirement.dimension_id)?.score || 0;
      return { requirement, current };
    })
    .filter(({ requirement, current }) => current < requirement.required_level * 0.8)
    .map(({ requirement, current }) => `${requirement.label}当前 ${current}/5，任务要求 ${requirement.required_level}/5`);
  const reasons = [
    roleRelevance === 100 ? "任务岗位方向与实习生当前岗位一致。" : "任务岗位方向与实习生当前岗位不完全一致，建议确认是否作为跨岗位培养。",
    `技能匹配贡献 ${Math.round(skillMatch * 0.5)}/50，覆盖 ${taskProfile.requirements.length} 项核心能力要求。`,
    weightedGap > 0.4 && weightedGap <= 1.2 ? "任务难度比当前能力略高，具备较好的成长价值。" : weightedGap <= 0.4 ? "当前能力可覆盖多数要求，成长价值以巩固和交付为主。" : "当前能力与要求存在较大跨度，需要拆分或提供支持。",
  ];
  const risks: string[] = [];
  if (taskProfile.business_risk !== "low") risks.push(`任务业务风险为${taskProfile.business_risk === "high" ? "高" : "中"}，需要保留带教检查点。`);
  if (assessment.evidence_confidence === "low") risks.push("实习生当前证据可信度低，匹配结论应以带教判断为准。");
  if (assessment.task_stats.active_count >= 2) risks.push("当前进行中任务较多，需确认时间可用性。");
  if (gaps.length) risks.push(`重点短板：${gaps.slice(0, 2).join("；")}。`);
  const mentorAction = allocation.allocation === "direct"
    ? `可以直接发布，建议在「${taskProfile.checkpoints[taskProfile.checkpoints.length - 1]}」确认交付质量。`
    : allocation.allocation === "checkpoint"
      ? `可以发布，但请设置「${taskProfile.checkpoints.join("、")}」并在中期核对过程证据。`
      : allocation.allocation === "assist"
        ? `建议拆分为子任务，先让实习生负责「${taskProfile.requirements[0]?.label || "基础分析"}」部分，再由带教复核。`
        : `暂不建议独立分配。可先安排难度更低的「${taskProfile.requirements[0]?.label || "基础能力"}」训练任务并补充验收证据。`;
  return {
    score,
    ...allocation,
    breakdown: {
      skill_match: skillMatch,
      role_relevance: roleRelevance,
      growth_value: growthValue,
      delivery_reliability: deliveryReliability,
      time_availability: timeAvailability,
      risk_penalty: riskPenalty,
    },
    task_profile: taskProfile,
    reasons,
    gaps,
    risks,
    mentor_action: mentorAction,
  };
}
