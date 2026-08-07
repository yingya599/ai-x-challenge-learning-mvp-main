import { optionalEnv } from "./env";
import type {
  AiEvaluation,
  AiInternAssessmentResult,
  PersonalTask,
  PortfolioDescription,
  RubricDimension,
  RubricConfig,
  RedFlag,
  TaskDraft,
  TaskPlan,
} from "./types";
import { z } from "zod";

type AiInput = {
  student: unknown;
  challenge: unknown;
  submission: unknown;
  githubCheck?: unknown;
  aiEvaluation?: unknown;
};

// ---- Default dimensions (Phase 3: used when challenge has no rubric_dimensions) ----

const DEFAULT_DIMENSIONS: RubricDimension[] = [
  { id: "problemUnderstanding", label: "问题理解", weight: 20, maxPoints: 20, description: "是否准确理解项目目标与挑战", signals: ["准确定义问题", "明确目标用户"], negativeSignals: ["跑题", "理解偏差"] },
  { id: "aiUsage", label: "AI使用质量", weight: 20, maxPoints: 20, description: "AI 工具使用是否恰当、有效", signals: ["多轮迭代", "prompt优化", "工作流设计"], negativeSignals: ["一句话指令直接提交", "没有AI使用记录"] },
  { id: "artifactCompleteness", label: "产物完整性", weight: 20, maxPoints: 20, description: "交付物是否齐全、可运行", signals: ["README", "可运行代码", "安装说明"], negativeSignals: ["文件为空", "缺少核心交付物"] },
  { id: "technicalExecution", label: "技术实现", weight: 20, maxPoints: 20, description: "技术方案与代码质量", signals: ["代码规范", "Git提交", "架构设计"], negativeSignals: ["硬编码路径", "代码混乱"] },
  { id: "reflectionQuality", label: "复盘质量", weight: 20, maxPoints: 20, description: "AAR 反思是否深入、有洞察", signals: ["具体问题分析", "有改进方案", "记录了迭代过程"], negativeSignals: ["敷衍了事", "没有实际反思"] },
];

// ---- AI config ----

const defaultAiProvider = "deepseek";
const defaultAiBaseUrl = "https://api.deepseek.com";
const defaultAiModel = "deepseek-v4-flash";
const defaultAiReviewModel = "deepseek-v4-pro";

function fallbackEvaluation(reason: string): AiEvaluation {
  return {
    scoreTotal: 76,
    scores: {
      problemUnderstanding: 15,
      aiUsage: 15,
      artifactCompleteness: 16,
      technicalExecution: 15,
      reflectionQuality: 15,
    },
    strengths: "提交材料具备基本完整性，项目目标和成果描述清楚。",
    weaknesses: "当前为本地 fallback 初评，尚未接入真实 AI 评估。",
    suggestions: "补充更详细的实现过程、AI 使用记录、截图或 Demo 说明。",
    feedback: "这是系统在缺少 AI API Key 时生成的确定性初评草稿，仅用于本地开发和流程测试。",
    fallback: true,
    fallbackReason: reason,
  };
}

function fallbackPortfolioDescription(input: AiInput): PortfolioDescription {
  const submission = input.submission as { projectTitle?: string; projectSummary?: string };
  return {
    publicDescription: `${submission.projectTitle || "AI+X Mini Product"} 是一个用于展示 AI 辅助完成项目任务的示例作品。该作品沉淀了项目目标、实现过程、GitHub 产物和复盘记录，可作为学习成果展示。`,
    skills: ["AI 辅助开发", "项目复盘", "GitHub 工作流", "作品集整理"],
    fallback: true,
  };
}

function aiConfig(purpose: "general" | "review" = "general") {
  const provider = optionalEnv("AI_PROVIDER") || defaultAiProvider;
  const apiKey = optionalEnv("DEEPSEEK_API_KEY") || optionalEnv("OPENAI_API_KEY");
  const baseUrl =
    optionalEnv("AI_BASE_URL") ||
    (provider === "openai"
      ? optionalEnv("OPENAI_BASE_URL") || "https://api.openai.com/v1"
      : optionalEnv("DEEPSEEK_BASE_URL") || defaultAiBaseUrl);
  const model =
    (purpose === "review" ? optionalEnv("AI_REVIEW_MODEL") : undefined) ||
    optionalEnv("AI_MODEL") ||
    (provider === "openai" ? "gpt-4.1-mini" : purpose === "review" ? defaultAiReviewModel : defaultAiModel);

  return { apiKey, baseUrl: baseUrl.replace(/\/$/, ""), model };
}

async function callAiJson<T>(
  messages: Array<{ role: "system" | "user"; content: string }>,
  purpose: "general" | "review" = "general",
): Promise<T> {
  const { apiKey, baseUrl, model } = aiConfig(purpose);
  if (!apiKey) throw new Error("AI API key missing");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || "AI request failed");
  return JSON.parse(payload.choices[0].message.content) as T;
}

function isRevenueForecastBrief(value: string) {
  return /收入|营收/.test(value) && /预测|时间序列|流量/.test(value);
}

function demoTaskDraft(brief: string, categoryTitle?: string): TaskDraft {
  const revenue = isRevenueForecastBrief(brief) || categoryTitle === "经营收入预测";
  if (revenue) {
    return {
      title: "流量收入预测与经营分析",
      business_context: "通信运营业务以年度收入为核心经营指标，需要基于历史月度数据形成可复用的收入预测与预警分析，为预算跟踪和经营决策提供依据。业务数据仅限内部使用。",
      objective: "先基于近 36 个月流量收入完成直接时间序列预测，再分别对流量单价、出账用户数、零流量用户数和户均流量进行预测与驱动分析。比较候选模型，预测下一阶段收入，解释主要驱动因素并提出可执行的经营建议。",
      acceptance_criteria: "1. 说明数据口径、质量检查与预处理过程；\n2. 使用留出集或滚动验证比较多个候选模型，并展示 WAPE、偏差和稳定性；\n3. 明确直接收入预测与四指标间接预测各自用途，并对差异进行解释；\n4. PPT 展示预测结果、不确定性、关键驱动及对应经营建议；\n5. 不在公开工具或公开链接中暴露原始业务数据。",
      priority: "high",
      confidentiality: "restricted",
      evidence_requirements: [
        { type: "presentation", label: "收入预测分析汇报 PPT", required: true },
        { type: "spreadsheet", label: "预测结果与模型评估表", required: false },
      ],
      clarification_questions: [
        "预测周期和收入指标口径是否已经最终确认？",
        "第一阶段是否先交付直接收入预测，再扩展四指标驱动分析？",
        "模型选择优先看 WAPE，还是还需要满足偏差或稳定性阈值？",
        "哪些数据和结果允许进入外部 AI，哪些只能在本地处理？",
        "是否需要设置中期检查点，例如数据检查、模型选择和 PPT 初稿？",
      ],
      assumptions: ["默认使用月度数据", "默认先建立可解释的基线，再扩展驱动模型", "默认最终成果以内部 PPT 为主"],
      suggested_category_title: "经营收入预测",
      mode: "demo",
    };
  }

  const firstLine = brief.split(/[。！？\n]/).map((item) => item.trim()).find(Boolean) || "真实业务任务";
  return {
    title: firstLine.slice(0, 32),
    business_context: brief,
    objective: "根据带教描述梳理问题边界，完成分析或执行过程，并形成可供带教验收的成果与结论。",
    acceptance_criteria: "说明任务口径和假设；记录关键处理步骤；提供可打开的成果材料；结论能够回答业务问题；提交前完成保密与完整性检查。",
    priority: "medium",
    confidentiality: "internal",
    evidence_requirements: [{ type: "document", label: "任务成果文档", required: true }],
    clarification_questions: ["最终要支持哪一个业务决策？", "交付格式和截止时间是什么？", "有哪些数据或内容不能发送给外部 AI？", "带教希望在哪些节点检查进度？"],
    assumptions: ["当前按带教原始描述生成草稿，所有字段仍需人工确认"],
    suggested_category_title: categoryTitle,
    mode: "demo",
  };
}

function normalizeTaskDraft(raw: Partial<TaskDraft>, fallback: TaskDraft): TaskDraft {
  const priorities = new Set(["low", "medium", "high", "urgent"]);
  const confidentiality = new Set(["internal", "confidential", "restricted"]);
  return {
    ...fallback,
    ...raw,
    title: String(raw.title || fallback.title),
    business_context: String(raw.business_context || fallback.business_context),
    objective: String(raw.objective || fallback.objective),
    acceptance_criteria: String(raw.acceptance_criteria || fallback.acceptance_criteria),
    priority: priorities.has(String(raw.priority)) ? raw.priority as TaskDraft["priority"] : fallback.priority,
    confidentiality: confidentiality.has(String(raw.confidentiality)) ? raw.confidentiality as TaskDraft["confidentiality"] : fallback.confidentiality,
    evidence_requirements: Array.isArray(raw.evidence_requirements) ? raw.evidence_requirements : fallback.evidence_requirements,
    clarification_questions: Array.isArray(raw.clarification_questions) ? raw.clarification_questions.map(String) : fallback.clarification_questions,
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String) : fallback.assumptions,
    mode: "model",
  };
}

export async function generateTaskDraft(input: {
  brief: string;
  categoryTitle?: string;
  jobDirection?: string;
  allowExternalAi?: boolean;
}): Promise<TaskDraft> {
  const fallback = demoTaskDraft(input.brief, input.categoryTitle);
  if (!input.allowExternalAi || !aiConfig().apiKey) return fallback;
  try {
    const raw = await callAiJson<Partial<TaskDraft>>([
      {
        role: "system",
        content: "你是企业实习任务设计助手。把带教的自然语言描述整理成可编辑任务草稿。不要虚构业务事实；不确定项放入 clarification_questions。只返回 JSON，字段为 title、business_context、objective、acceptance_criteria、priority、confidentiality、evidence_requirements、clarification_questions、assumptions、suggested_category_title。",
      },
      { role: "user", content: JSON.stringify(input) },
    ]);
    return normalizeTaskDraft(raw, fallback);
  } catch (error) {
    console.warn("[ai/task-draft] using demo fallback:", error instanceof Error ? error.message : String(error));
    return fallback;
  }
}

function demoTaskPlan(task: PersonalTask): TaskPlan {
  const revenue = isRevenueForecastBrief(`${task.title} ${task.business_context || ""} ${task.objective || ""}`);
  const clarification = (() => {
    try {
      const value = JSON.parse(task.ai_clarification_questions_json || "[]");
      return Array.isArray(value) ? value.map(String) : [];
    } catch { return []; }
  })();
  const steps = revenue ? [
    { title: "确认口径与保密边界", purpose: "避免一开始就用错指标或泄露业务数据", actions: ["确认预测周期、收入口径和数据频率", "确认哪些字段可进入 AI、哪些必须本地处理", "与带教确认阶段交付节点"], deliverable: "一页任务口径与假设清单", mentor_checkpoint: "开始建模前请带教确认" },
    { title: "完成数据质量与业务检查", purpose: "先确保历史序列可信", actions: ["检查 36 个月完整性、重复值和异常值", "核对收入与四个驱动指标的业务逻辑", "记录清洗规则和处理前后差异"], deliverable: "数据质量检查表与处理说明" },
    { title: "建立直接收入预测基线", purpose: "先得到稳定、可比较的总收入预测", actions: ["完成趋势、季节性和序列诊断", "设置留出集或滚动验证", "比较 Theta、SARIMA、Holt 等候选模型", "用 WAPE、偏差和稳定性选择模型"], deliverable: "直接预测结果与模型对比表", mentor_checkpoint: "确定最终模型后同步一次" },
    { title: "分别预测四项经营驱动", purpose: "让最终结论具有业务解释性", actions: ["分别对流量单价、出账用户数、零流量用户数、户均流量建模", "每项指标独立选模型，不强求同一模型", "保留预测误差和关键假设"], deliverable: "四指标预测结果及模型选择依据" },
    { title: "合成收入并解释差异", purpose: "把直接预测和驱动预测组合成一个可信结论", actions: ["代入收入公式形成间接预测", "与直接收入预测对照", "解释两条路径的差异和适用场景", "识别主要正向和负向驱动"], deliverable: "收入预测结论、驱动贡献与风险说明" },
    { title: "形成经营建议与汇报", purpose: "让分析真正支持管理动作", actions: ["将每条建议对应到具体驱动指标", "标注预测区间和不确定性", "按问题—方法—结果—建议组织 PPT", "完成保密、口径和数字一致性检查"], deliverable: "可供带教验收的收入预测分析 PPT", mentor_checkpoint: "提交正式版前先发 PPT 初稿" },
  ] : [
    { title: "确认任务边界", purpose: "把自然语言要求转成明确问题", actions: ["确认目标、对象和截止时间", "列出待澄清问题", "确认保密边界"], deliverable: "任务理解与问题清单", mentor_checkpoint: "开始执行前确认" },
    { title: "准备数据与材料", purpose: "保证输入完整可靠", actions: ["收集必要材料", "检查口径和质量", "记录缺失项"], deliverable: "输入材料清单" },
    { title: "完成核心分析或执行", purpose: "形成可验证的中间结果", actions: ["先做最小可行版本", "记录方法和假设", "验证关键结果"], deliverable: "中间成果", mentor_checkpoint: "完成初版后同步" },
    { title: "整理结论和建议", purpose: "把过程转成可使用的业务成果", actions: ["回答核心业务问题", "区分事实、推断和建议", "说明限制与风险"], deliverable: "成果初稿" },
    { title: "提交前检查", purpose: "减少返工", actions: ["核对验收标准", "检查附件和链接", "完成保密检查"], deliverable: "正式提交版本" },
  ];
  return {
    summary: revenue ? "建议按“先直接预测建立基线，再拆解四项经营驱动，最后形成管理建议”的顺序推进。每个关键节点都留下可供带教快速确认的中间产物。" : "先确认边界，再完成最小可验证成果，最后对照验收标准提交。",
    steps,
    clarification_questions: clarification,
    risks: revenue ? ["指标口径未统一会导致结果不可比", "小样本下复杂模型可能过拟合", "直接预测与间接预测差异需要解释", "原始经营数据不得上传到未经批准的外部工具"] : ["任务边界不清", "中间过程缺少带教确认", "成果格式不符合验收要求"],
    pre_submit_checklist: revenue ? ["已展示数据质量检查与预处理", "已展示候选模型、评估指标和选择依据", "已说明预测结果及不确定性", "已区分直接预测和四指标间接预测的用途", "经营建议已对应到具体驱动因素", "未在公开链接或外部工具中泄露保密数据"] : ["任务目标已回答", "关键假设已说明", "成果链接或附件可打开", "已逐项对照验收标准", "已完成保密检查"],
    mode: "demo",
    generated_at: new Date().toISOString(),
  };
}

export async function generateTaskPlan(task: PersonalTask, allowExternalAi = false): Promise<TaskPlan> {
  const fallback = demoTaskPlan(task);
  if (!allowExternalAi || !aiConfig().apiKey) return fallback;
  try {
    const raw = await callAiJson<Omit<TaskPlan, "mode" | "generated_at">>([
      { role: "system", content: "你是实习生任务教练。把真实业务任务拆成 4-7 个可执行阶段，每阶段说明目的、动作、交付物和必要的带教检查点。不要代做答案，不要虚构数据。只返回 JSON：summary、steps、clarification_questions、risks、pre_submit_checklist。" },
      { role: "user", content: JSON.stringify(task) },
    ]);
    return { ...fallback, ...raw, mode: "model", generated_at: new Date().toISOString() };
  } catch (error) {
    console.warn("[ai/task-plan] using demo fallback:", error instanceof Error ? error.message : String(error));
    return fallback;
  }
}

export async function generateInternAssessment(input: {
  ruleBased: AiInternAssessmentResult;
  allowExternalAi?: boolean;
}): Promise<AiInternAssessmentResult> {
  // Reserved integration point: later send only the structured assessment evidence
  // to the approved model and validate the response back into this same shape.
  // The first version intentionally stays deterministic and local.
  return input.ruleBased;
}

const taskEvaluationSchema = z.object({
  goalAlignment: z.number().int().min(0).max(25),
  deliverableCompleteness: z.number().int().min(0).max(25),
  methodAndEvidence: z.number().int().min(0).max(25),
  communicationAndReflection: z.number().int().min(0).max(25),
  strengths: z.string().min(1),
  weaknesses: z.string().min(1),
  suggestions: z.string().min(1),
  feedback: z.string().min(1),
});

export async function evaluateTaskSubmission(input: {
  task: PersonalTask;
  submission: {
    result_summary: string;
    aar_text?: string;
    self_evaluation_text?: string;
    evidence_items?: unknown[];
    uploaded_files?: Array<{ name?: string; evidence_type?: string }>;
  };
}): Promise<AiEvaluation> {
  if (!aiConfig("review").apiKey) return fallbackEvaluation("AI_API_KEY_missing");

  const safeInput = {
    task: {
      title: input.task.title,
      business_context: input.task.business_context,
      objective: input.task.objective,
      instructions: input.task.instructions_md,
      acceptance_criteria: input.task.acceptance_criteria,
      evidence_requirements: input.task.evidence_requirements_json,
      confidentiality: input.task.confidentiality,
    },
    submission: {
      result_summary: input.submission.result_summary,
      aar_text: input.submission.aar_text || "",
      self_evaluation_text: input.submission.self_evaluation_text || "",
      evidence_links: input.submission.evidence_items || [],
      uploaded_file_names: (input.submission.uploaded_files || []).map((item) => ({
        name: item.name,
        type: item.evidence_type,
      })),
    },
    boundary: "附件原文和原始业务数据未发送给模型；只能依据上述摘要与证据名称初评。",
  };

  try {
    const raw = await callAiJson<z.infer<typeof taskEvaluationSchema>>([
      {
        role: "system",
        content: `你是企业实习任务的 AI 初评助手。严格对照任务目标和验收标准，只依据用户提供的摘要、AAR、自评、证据链接名称进行初评，不得假装读取附件内容。你的结论仅供带教参考，不能代替人工终审。请输出 JSON：{"goalAlignment":0-25,"deliverableCompleteness":0-25,"methodAndEvidence":0-25,"communicationAndReflection":0-25,"strengths":"...","weaknesses":"...","suggestions":"...","feedback":"..."}。证据不足时必须明确指出，并降低相应维度分数。`,
      },
      { role: "user", content: JSON.stringify(safeInput) },
    ], "review");
    const parsed = taskEvaluationSchema.parse(raw);
    const scores = {
      goalAlignment: parsed.goalAlignment,
      deliverableCompleteness: parsed.deliverableCompleteness,
      methodAndEvidence: parsed.methodAndEvidence,
      communicationAndReflection: parsed.communicationAndReflection,
    };
    return {
      scoreTotal: Object.values(scores).reduce((sum, score) => sum + score, 0),
      scores,
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      suggestions: parsed.suggestions,
      feedback: parsed.feedback,
    };
  } catch (error) {
    return fallbackEvaluation(`task_review_failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ---- Phase 3: Dynamic schema & prompt builders ----

function buildAiSchema(dimensions: RubricDimension[]) {
  const shape: Record<string, z.ZodNumber> = {};
  for (const dim of dimensions) {
    shape[dim.id] = z.number().int().min(0).max(dim.maxPoints);
  }
  return z.object({
    ...shape,
    scoreTotal: z.number().int().min(0).max(100),
    strengths: z.string().min(1),
    weaknesses: z.string().min(1),
    suggestions: z.string().min(1),
    feedback: z.string().min(1),
  });
}

function buildSystemPrompt(dimensions: RubricDimension[], redFlags?: RedFlag[]) {
  const dimLines = dimensions.map(d =>
    `- **${d.label}** (${d.id}, 0-${d.maxPoints}分): ${d.description}
  正面信号: ${d.signals.join("、")}
  负面信号: ${d.negativeSignals.join("、")}`
  ).join("\n\n");

  const flagLines = redFlags && redFlags.length > 0
    ? `\n红线规则（命中则对应维度不超过上限分）：\n${redFlags.map(f => `- ${f.description} → ${f.affectedDimension} ≤ ${f.maxScore}分`).join("\n")}`
    : "";

  return `你是 AI+X 项目课的助教。请严格按以下评分标准进行初评，只返回严格 JSON。

评分维度（共 ${dimensions.length} 个）：

${dimLines}${flagLines}

返回格式（严格 JSON，所有字段必填，scoreTotal 等于各维度之和）：
{
${dimensions.map(d => `  "${d.id}": <0-${d.maxPoints} 整数>`).join(",\n")},
  "scoreTotal": <各维度之和，0-100 整数>,
  "strengths": "<优点，非空字符串>",
  "weaknesses": "<不足，非空字符串>",
  "suggestions": "<改进建议，非空字符串>",
  "feedback": "<综合评价，非空字符串>"
}`;
}

function checkRedFlags(inputContent: string, redFlags: RedFlag[]): string[] {
  return redFlags
    .filter(f => {
      try {
        return new RegExp(f.pattern, "i").test(inputContent);
      } catch { return false; }
    })
    .map(f => f.id);
}

// ---- Public API ----

export async function evaluateSubmission(input: AiInput): Promise<AiEvaluation> {
  const config = aiConfig();
  if (!config.apiKey) {
    const reason = "AI_API_KEY_missing";
    console.error("[ai] fallback:", reason);
    return fallbackEvaluation(reason);
  }

  // Phase 3: Parse structured rubric dimensions from challenge
  const challenge = input.challenge as {
    rubric?: string;
    rubric_dimensions?: string;
    red_flags?: string;
  } | undefined;

  let dimensions: RubricDimension[];
  try {
    if (challenge?.rubric_dimensions) {
      const rubric: RubricConfig = JSON.parse(challenge.rubric_dimensions);
      dimensions = rubric.dimensions?.length > 0 ? rubric.dimensions : DEFAULT_DIMENSIONS;
    } else {
      dimensions = DEFAULT_DIMENSIONS;
    }
  } catch {
    dimensions = DEFAULT_DIMENSIONS;
  }

  let redFlags: RedFlag[] = [];
  try {
    if (challenge?.red_flags) {
      const parsed = JSON.parse(challenge.red_flags);
      redFlags = parsed.flags || [];
    }
  } catch { /* ignore */ }

  // Phase 1: Build user content with GitHub data
  const ghCheck = input.githubCheck as Record<string, unknown> | undefined;
  const userContent = {
    student: input.student,
    challenge: input.challenge,
    submission: input.submission,
    github: {
      readmeContent: ghCheck?.readmeContent ?? null,
      fileList: ghCheck?.fileList ?? [],
      latestCommitMsg: ghCheck?.latestCommitMsg ?? null,
      repoExists: ghCheck?.repoExists ?? false,
      hasReadme: ghCheck?.readmeExists ?? false,
    },
  };

  // Phase 3: Regex red flag check on the raw content (deterministic, before AI)
  const userContentStr = JSON.stringify(userContent);
  const redFlagsHit = redFlags.length > 0 ? checkRedFlags(userContentStr, redFlags) : [];

  // Build dynamic schema and prompt
  const schema = buildAiSchema(dimensions);
  const systemPrompt = buildSystemPrompt(dimensions, redFlags);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callAiJson<Record<string, unknown>>([
        { role: "system", content: systemPrompt },
        { role: "user", content: userContentStr },
      ]);

      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        if (attempt === 0) {
          console.warn("[ai] schema validation failed, retrying:", parsed.error.flatten());
          continue;
        }
        const reason = `schema_validation_failed: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`;
        console.error("[ai] fallback:", reason);
        return fallbackEvaluation(reason);
      }

      const result = parsed.data as Record<string, unknown>;

      // Apply red flag score caps
      const scores: Record<string, number> = {};
      let computedTotal = 0;
      for (const dim of dimensions) {
        const aiScore = result[dim.id] as number;
        const hitFlag = redFlags.find(f => f.affectedDimension === dim.id && redFlagsHit.includes(f.id));
        const capped = hitFlag ? Math.min(aiScore, hitFlag.maxScore) : aiScore;
        scores[dim.id] = capped;
        computedTotal += capped;
      }

      return {
        scoreTotal: Math.min(computedTotal, 100),
        scores,
        strengths: result.strengths as string,
        weaknesses: result.weaknesses as string,
        suggestions: result.suggestions as string,
        feedback: result.feedback as string,
        redFlagsHit: redFlagsHit.length > 0 ? redFlagsHit : undefined,
      };
    } catch (err) {
      if (attempt === 0) {
        console.warn("[ai] AI call failed, retrying:", err instanceof Error ? err.message : String(err));
        continue;
      }
      const reason = `ai_call_failed: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[ai] fallback:", reason);
      return fallbackEvaluation(reason);
    }
  }

  const reason = "unexpected_loop_exit";
  console.error("[ai] fallback:", reason);
  return fallbackEvaluation(reason);
}

export async function generatePortfolioDescription(input: AiInput): Promise<PortfolioDescription> {
  if (!aiConfig().apiKey) return fallbackPortfolioDescription(input);

  try {
    return await callAiJson<PortfolioDescription>([
      {
        role: "system",
        content:
          "你是作品集编辑。请把学生项目整理成可公开展示的中文简介，并给出3-6个技能标签。只返回 JSON：publicDescription, skills。",
      },
      {
        role: "user",
        content: JSON.stringify(input, null, 2),
      },
    ]);
  } catch {
    return fallbackPortfolioDescription(input);
  }
}
