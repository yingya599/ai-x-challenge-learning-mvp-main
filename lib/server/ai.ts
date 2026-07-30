import { optionalEnv } from "./env";
import type { AiEvaluation, PortfolioDescription, RubricDimension, RubricConfig, RedFlag } from "./types";
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
const defaultAiModel = "deepseek-chat";

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

function aiConfig() {
  const provider = optionalEnv("AI_PROVIDER") || defaultAiProvider;
  const apiKey = optionalEnv("DEEPSEEK_API_KEY") || optionalEnv("OPENAI_API_KEY");
  const baseUrl =
    optionalEnv("AI_BASE_URL") ||
    (provider === "openai" ? "https://api.openai.com" : defaultAiBaseUrl);
  const model =
    optionalEnv("AI_MODEL") ||
    (provider === "openai" ? "gpt-4.1-mini" : defaultAiModel);

  return { apiKey, baseUrl: baseUrl.replace(/\/$/, ""), model };
}

async function callAiJson<T>(messages: Array<{ role: "system" | "user"; content: string }>): Promise<T> {
  const { apiKey, baseUrl, model } = aiConfig();
  if (!apiKey) throw new Error("AI API key missing");

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
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
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || "AI request failed");
  return JSON.parse(payload.choices[0].message.content) as T;
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
