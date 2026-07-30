# 评分规则结构化 + 维度随 Challenge

> **目标：** 把评分标准从"老师手写一段自由文本"升级为"结构化 JSON"，让每个 challenge 拥有独立的评分维度（维度数、名称、权重、分值都随 challenge 变化），实现 Richard 资料中的维度按 challenge 类型变化的设计。

**现状：** `lib/server/ai.ts` 的 Zod schema 硬编码 5 个维度和固定 5×20 权重。无论什么 challenge，评分结构不变。rubric 文本只是给 LLM 的建议，没有机器可读的约束力。

**改后：** 每个挑战在飞书表里存结构化维度 JSON。AI 评分时动态生成 Zod schema 和 system prompt。每个挑战可以有不同的维度。

---

## 一、数据结构设计

### 1.1 飞书 Challenges 表新增字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `rubric_dimensions` | JSON 文本 | 结构化评分维度数组 |
| `red_flags` | JSON 文本 | 全局红线规则（可选） |
| `required_files` | JSON 文本 | 必须交付物（第一步已加） |

`rubric` 字段保留，作为维度的**人类可读说明**，由 `rubric_dimensions` 自动生成。

### 1.2 `rubric_dimensions` JSON 格式

```json
{
  "dimensions": [
    {
      "id": "aiUsage",
      "label": "AI 使用质量",
      "weight": 20,
      "maxPoints": 20,
      "description": "AI 工具使用是否恰当、有效、有迭代",
      "signals": ["多轮迭代", "prompt 优化", "工作流设计", "反向举证"],
      "negativeSignals": ["一句话指令直接提交", "没有 AI 使用记录"]
    },
    {
      "id": "artifactCompleteness",
      "label": "产物完整性",
      "weight": 20,
      "maxPoints": 20,
      "description": "交付物是否齐全、可运行",
      "signals": ["README", "可运行代码", "安装说明", "demo"],
      "negativeSignals": ["文件为空", "缺少核心交付物"]
    },
    {
      "id": "problemUnderstanding",
      "label": "问题理解",
      "weight": 15,
      "maxPoints": 15,
      "description": "是否准确理解项目目标与挑战要求",
      "signals": ["准确定义问题", "明确目标用户", "分析竞品或参考"],
      "negativeSignals": ["跑题", "理解偏差"]
    },
    {
      "id": "reusability",
      "label": "可复用性",
      "weight": 25,
      "maxPoints": 25,
      "description": "别人拿过去能直接用吗？",
      "signals": ["安装步骤", "环境要求", "无硬编码路径", "有使用文档"],
      "negativeSignals": ["硬编码路径", "缺少安装说明"]
    },
    {
      "id": "reflectionQuality",
      "label": "复盘质量",
      "weight": 20,
      "maxPoints": 20,
      "description": "AAR 反思是否深入、有洞察",
      "signals": ["具体问题分析", "有改进方案", "记录了迭代过程"],
      "negativeSignals": ["敷衍了事", "没有实际反思"]
    }
  ],
  "totalPoints": 100
}
```

**关键约束：**
- `weight` 之和 = 100
- `maxPoints` 之和 = 100（或 `weight` = `maxPoints`）
- 维度数量不限制（最少 2 个，建议 3-6 个）
- `id` 必须唯一，用于 Zod schema 字段名

### 1.3 `red_flags` JSON 格式

```json
{
  "flags": [
    {
      "id": "hardcoded_path",
      "description": "代码中出现硬编码绝对路径",
      "pattern": "/Users/|C:\\\\|/home/",
      "affectedDimension": "reusability",
      "maxScore": 5,
      "check": "content"
    },
    {
      "id": "api_key_leak",
      "description": "API key 明文泄露",
      "pattern": "sk-[a-zA-Z0-9]{20,}|api_key\\s*=\\s*['\"][^'\"]+['\"]",
      "affectedDimension": "aiUsage",
      "maxScore": 5,
      "check": "content"
    }
  ]
}
```

红线规则可以在 **AI 评分前**用正则确定性检查，不依赖 LLM。

---

## 二、后端改动

### 2.1 类型定义 (`lib/server/types.ts`)

```typescript
// 新增类型
export interface RubricDimension {
  id: string;
  label: string;
  weight: number;      // 0-100, 所有维度 weight 之和 = 100
  maxPoints: number;
  description: string;
  signals: string[];
  negativeSignals: string[];
}

export interface RubricConfig {
  dimensions: RubricDimension[];
  totalPoints: number;  // 固定 100
}

export interface RedFlag {
  id: string;
  description: string;
  pattern: string;      // 正则表达式
  affectedDimension: string;
  maxScore: number;
  check: "content" | "filename" | "structure";
}

export interface RedFlagsConfig {
  flags: RedFlag[];
}

// 修改 AiEvaluation 类型 — scores 变成动态
export interface AiEvaluation {
  scoreTotal: number;
  scores: Record<string, number>;  // 原来是固定 5 个字段，现在动态
  strengths: string;
  weaknesses: string;
  suggestions: string;
  feedback: string;
  fallback?: boolean;
  fallbackReason?: string;
  redFlagsHit?: string[];  // 命中的红线
}
```

### 2.2 AI 评分改造 (`lib/server/ai.ts`)

**改前：**
```typescript
// 固定 Zod schema
const AiEvaluationSchema = z.object({
  problemUnderstanding: z.number().int().min(0).max(20),
  aiUsage: z.number().int().min(0).max(20),
  // ...
});
```

**改后：**
```typescript
function buildAiSchema(dimensions: RubricDimension[]) {
  // 动态构建 Zod schema
  const shape: Record<string, z.ZodNumber> = {};
  
  for (const dim of dimensions) {
    shape[dim.id] = z.number().int().min(0).max(dim.maxPoints);
  }
  
  // 通用字段
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
  // 动态构建评分标准
  const dimLines = dimensions.map(d =>
    `- **${d.label}** (${d.id}, 0-${d.maxPoints}分): ${d.description}\n  正面信号: ${d.signals.join("、")}\n  负面信号: ${d.negativeSignals.join("、")}`
  ).join("\n\n");
  
  const redFlagLines = redFlags?.map(f =>
    `- ${f.description}: 命中则 ${f.affectedDimension} ≤ ${f.maxScore} 分`
  ).join("\n") || "";
  
  return `你是 AI+X 项目课的助教。请按以下评分标准进行初评，只返回严格 JSON。

评分维度（共 ${dimensions.length} 个）：

${dimLines}

${redFlags ? `\n红线规则（命中则对应维度不超过上限分）：\n${redFlagLines}` : ""}

返回格式（严格 JSON，所有字段必填，scoreTotal 等于各维度之和）：
{
${dimensions.map(d => `  "${d.id}": <0-${d.maxPoints} 整数>`).join(",\n")},
  "scoreTotal": <各维度之和，0-100 整数>,
  "strengths": "<优点>",
  "weaknesses": "<不足>",
  "suggestions": "<改进建议>",
  "feedback": "<综合评价>"
}`;
}
```

**`evaluateSubmission` 主函数改造：**

```typescript
export async function evaluateSubmission(input: AiInput): Promise<AiEvaluation> {
  const config = aiConfig();
  if (!config.apiKey) return fallbackEvaluation("AI_API_KEY_missing");

  // ① 解析结构化 rubric
  const challenge = input.challenge as { rubric_dimensions?: string; red_flags?: string };
  const dimensions: RubricDimension[] = challenge?.rubric_dimensions
    ? JSON.parse(challenge.rubric_dimensions).dimensions
    : DEFAULT_DIMENSIONS;  // fallback 用旧 5 维

  const redFlags: RedFlag[] = challenge?.rubric_dimensions_red_flags
    ? JSON.parse(challenge.rubric_dimensions_red_flags).flags
    : [];

  // ② 确定性红线检查（正则，不调 AI）
  const redFlagsHit = redFlags
    .filter(f => new RegExp(f.pattern, "i").test(JSON.stringify(input)))
    .map(f => f.id);

  // ③ 动态 Zod schema
  const schema = buildAiSchema(dimensions);

  // ④ 动态 system prompt
  const systemPrompt = buildSystemPrompt(dimensions, redFlags);

  // ⑤ 调用 AI（同现有逻辑）
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callAiJson<Record<string, unknown>>([
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(input, null, 2) },
      ]);

      const parsed = schema.safeParse(raw);
      if (!parsed.success) { /* retry logic */ continue; }

      const result = parsed.data;
      
      // ⑥ 应用红线约束
      const scores: Record<string, number> = {};
      for (const dim of dimensions) {
        const hitFlag = redFlags.find(f => f.affectedDimension === dim.id && redFlagsHit.includes(f.id));
        scores[dim.id] = hitFlag
          ? Math.min(result[dim.id] as number, hitFlag.maxScore)
          : result[dim.id] as number;
      }
      
      // 重算总分
      const computedTotal = Object.values(scores).reduce((a, b) => a + b, 0);

      return {
        scoreTotal: computedTotal,
        scores,
        strengths: result.strengths as string,
        weaknesses: result.weaknesses as string,
        suggestions: result.suggestions as string,
        feedback: result.feedback as string,
        redFlagsHit: redFlagsHit.length > 0 ? redFlagsHit : undefined,
      };
    } catch (err) {
      if (attempt === 0) continue;
      return fallbackEvaluation(`ai_call_failed: ${err}`);
    }
  }
  return fallbackEvaluation("unexpected_loop_exit");
}
```

### 2.3 飞书写入 (`lib/server/workflow.ts`)

Evaluations 表的 `scores_json` 字段已经存 JSON，从固定 5 字段变成动态 `Record<string, number>`，无需改表结构。

关键改动：写入 `scores_json` 时原样写入 `aiEvaluation.scores`。

### 2.4 飞书读取 (`lib/server/feishu.ts`)

`getChallengeById` 返回的 challenge 类型需要加 `rubric_dimensions?: string`。

### 2.5 `required_files` 检查（第一步已规划）

在 `workflow.ts` 的 AI 评分前插入：

```typescript
// 完整性检查
const requiredFiles = challenge.rubric_dimensions_required_files
  ? JSON.parse(challenge.rubric_dimensions_required_files) as string[]
  : [];

if (requiredFiles.length > 0) {
  const fileList = githubCheck.fileList || [];  // GitHub API 返回的文件列表
  const missing = requiredFiles.filter(req => 
    !fileList.some(f => minimatch(f, req))
  );
  if (missing.length > 0) {
    // 标 needs_revision, 通知学生缺什么, 不进入 AI 评分
    return { ok: false, error: `缺少交付物: ${missing.join(", ")}` };
  }
}
```

---

## 三、前端改动

### 3.1 教师发布 Challenge 页面

**改前：** 一个 `rubric` 文本域，老师手写评分标准。

**改后：**
- 先选 Challenge 类型（构建型/探索型/研究型/产品型）→ 自动加载**默认维度模板**
- 维度列表（可增删改）：
  - 每行：维度名称、ID、权重(0-100)、满分、描述、正面信号、负面信号
  - 底部显示权重合计，必须 = 100 才允许发布
- `rubric` 文本域变为**自动生成的只读预览**（从维度拼出来给人看）
- 飞书表存储：`rubric_dimensions` = JSON.stringify({ dimensions }), `rubric` = 自动生成的人类可读文本

### 3.2 学生提交后查看评分

**改前：** 固定 5 个维度 + 固定分值展示。

**改后：** 从 `evaluations.scores_json` 动态渲染维度列表（维度的 label 和分值都来自数据）。

### 3.3 教师仪表盘

同学生端，评分展示改为动态渲染。

---

## 四、默认维度模板

从 Richard 的 `evaluation_patterns.md` 映射过来：

| Challenge 类型 | 默认维度 |
|---------------|---------|
| **构建型** (build) | 问题理解(15) + AI使用质量(20) + 产物完整性(25) + 技术实现(25) + 复盘质量(15) |
| **探索型** (explore) | 探索深度(25) + AI使用质量(20) + 方法严谨性(20) + 发现价值(20) + 复盘质量(15) |
| **研究型** (research) | 思想深度(30) + 结构/严谨性(25) + 可发表性(20) + AI使用质量(15) + 拿来主义(10) |
| **产品型** (product) | 产品完成度(30) + 用户体验(20) + 技术实现(20) + AI使用质量(15) + 文档质量(15) |

这些存为前端常量，教师发布时根据类型自动填充，可自由修改。

---

## 五、实施顺序

| 阶段 | 内容 | 预估 |
|------|------|------|
| **Phase 1** | 类型定义 + AI 评分动态化（`types.ts`, `ai.ts`） | 2 小时 |
| **Phase 2** | 飞书表字段 + 读写（`feishu.ts`） | 1 小时 |
| **Phase 3** | 默认维度模板 + 教师发布页 UI | 2 小时 |
| **Phase 4** | 学生评分展示 + 教师仪表盘改为动态渲染 | 2 小时 |
| **Phase 5** | 红线规则 + 正则检查 + Zod 动态 schema | 1 小时 |
| **Phase 6** | `required_files` 完整性检查 | 1 小时 |

---

## 六、向后兼容

- 旧 challenge 的 `rubric` 字段仍然有效：如果 `rubric_dimensions` 为空，使用 DEFAULT_DIMENSIONS（即现有的 5 维）
- `scores_json` 字段原本存 `{problemUnderstanding, aiUsage, ...}`，新格式存 `Record<string, number>`，前端读取时兼容两种格式
- 旧 Evaluations 记录不变，新提交的评分用新格式
