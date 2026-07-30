# NSEAP 评审系统全面升级计划

> **目标：** 三步把评分系统从「LLM 只听学生自述」升级为「先验证、再看代码、按结构化规则评分」，对齐 Richard 资料的评审框架。

**现状问题：**
1. AI 评分只看学生填的文字描述，不读 GitHub 代码
2. 不检查交付物是否齐全
3. 评分维度写死 5×20，所有 challenge 用同一套，rubric 形同虚设

---

## 改造全景

```
学生提交
    │
    ▼
┌────────────────────────────────────────┐
│ Phase 2: 完整性检查（确定性规则）          │
│  • 从飞书读 required_files               │
│  • 对比 GitHub 实际文件列表               │
│  • 缺文件 → 直接打回，不调 AI，不花钱      │
└──────────────┬─────────────────────────┘
               │ ✅ 齐全
               ▼
┌────────────────────────────────────────┐
│ Phase 1: AI 评分增强                      │
│  发给 DeepSeek 的内容：                   │
│  ┌──────────────────────────────────┐   │
│  │ system prompt                      │   │
│  │  • 结构化评分维度（从飞书 rubric_      │   │
│  │    dimensions 读取，动态生成）         │   │
│  │  • 红线规则（red_flags）              │   │
│  ├──────────────────────────────────┤   │
│  │ user prompt                         │   │
│  │  • GitHub README 全文 ← 新增         │   │
│  │  • 仓库文件列表 ← 新增                │   │
│  │  • 最新 commit message ← 新增         │   │
│  │  • 学生自述（AAR + 自评）             │   │
│  └──────────────────────────────────┘   │
│                                          │
│  返回：动态维度评分 + strengths/weaknesses │
│  Zod 动态校验 → 不通过重试一次 → fallback │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│ Phase 1b: 红线确定性检查（正则，不调 AI）    │
│  • 硬编码路径(/Users/、C:\) → 可复用 ≤ 5  │
│  • API key 明文(sk-xxx) → AI使用 ≤ 5     │
│  • 在 LLM 返回结果上钳位                  │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│ 写入飞书（现有逻辑不变）                   │
│  • Submissions 表：status + task_state   │
│  • Evaluations 表：动态维度 scores_json  │
│  • Portfolio 表                          │
│  • 飞书通知学生                           │
│  • 群通知                                │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│ 教师终审（现有逻辑不变）                   │
│  • 查看 AI 评分 + GitHub 检查结果         │
│  • accept 或 return                      │
│  • 通知学生                               │
└────────────────────────────────────────┘
```

---

## Phase 1: AI 评分增强 — 让 AI 看到代码

### 目标
AI 评分时不再只收学生自述文本，同时收到 GitHub 仓库的实际内容。

### 文件改动

**`lib/server/github.ts`** — 新增两个方法：

```typescript
// 获取 README 内容
export async function getReadmeContent(repoUrl: string): Promise<string | null>

// 获取仓库文件列表（顶层 + 二级目录）
export async function getFileTree(repoUrl: string): Promise<string[]>
```

**`lib/server/types.ts`** — `GithubCheck` 加字段：

```typescript
export interface GithubCheck {
  // 现有字段...
  readmeContent?: string;       // README 全文
  fileList?: string[];          // 文件列表
  latestCommitMsg?: string;     // 最新提交 message
}
```

**`lib/server/ai.ts`** — user prompt 改造：

```typescript
// 改前
{ role: "user", content: JSON.stringify(input, null, 2) }

// 改后
{ role: "user", content: JSON.stringify({
  student: input.student,
  challenge: input.challenge,
  submission: input.submission,
  github: {
    repoExists: githubCheck.repoExists,
    readmeContent: githubCheck.readmeContent,      // ← 新增
    fileList: githubCheck.fileList,                // ← 新增
    latestCommitMsg: githubCheck.latestCommitMsg,  // ← 新增
    hasReadme: githubCheck.hasReadme,
    commitCount: githubCheck.commitCount,
  }
})}
```

### 验证
- 发布一个测试 challenge，用真实 GitHub 仓库提交，检查 AI 评分是否引用了 README 内容

---

## Phase 2: 完整性检查 — 缺文件直接打回

### 目标
在调用 AI 之前，用确定性规则检查交付物是否齐全。缺件不评分，不消耗 token。

### 数据来源
飞书 Challenges 表新增字段 `required_files`（JSON 文本），如：

```json
["README.md", "*.py", "demo.*", "*AI日志*", "*拿来说明*"]
```

### 文件改动

**`lib/server/feishu.ts`** — challenge 类型加 `required_files?: string`

**`lib/server/workflow.ts`** — 在 `evaluateSubmission` 之前插入检查：

```typescript
// Phase 2: 完整性检查
const requiredFiles = challenge.required_files
  ? (JSON.parse(challenge.required_files) as string[])
  : [];

if (requiredFiles.length > 0) {
  const fileNames = githubCheck.fileList || [];
  const missing = requiredFiles.filter(pattern =>
    !fileNames.some(f => {
      // 简单 glob 匹配：* → .*, ? → .
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i"
      );
      return regex.test(f);
    })
  );
  
  if (missing.length > 0) {
    audit.log("completeness_check_failed", submissionId, { missing });
    return { ok: false, error: `缺少交付物: ${missing.join(", ")}`, needsRevision: true };
  }
}
```

### 前端改动
`app/(app)/teacher/page.tsx` — 发布表单加 `required_files` 输入（逗号分隔，如 `README.md, *.py, demo.*`）

### 验证
- 用一个缺少 README 的仓库提交，应返回 "缺少交付物: README.md"

---

## Phase 3: 评分规则结构化 — 维度随 Challenge

### 目标
每个 challenge 拥有独立的评分维度。老师发布时选类型自动填默认维度，可微调。AI 评分时动态生成 Zod schema 和 system prompt。

### 核心数据结构

**飞书 Challenges 表新增 `rubric_dimensions` 字段（JSON 文本）：**

```json
{
  "dimensions": [
    {
      "id": "reusability",
      "label": "可复用性",
      "weight": 30,
      "maxPoints": 30,
      "description": "别人拿过去能直接用吗",
      "signals": ["安装说明", "环境要求", "无硬编码路径", "有使用文档"],
      "negativeSignals": ["硬编码路径", "缺少安装说明"]
    }
  ],
  "totalPoints": 100
}
```

### 默认维度模板

| Challenge 类型 | 默认维度 |
|---------------|---------|
| **构建型** (build) | 问题理解(15) + AI使用(20) + 产物完整性(25) + 技术实现(25) + 复盘(15) |
| **探索型** (explore) | 探索深度(25) + AI使用(20) + 方法严谨性(20) + 发现价值(20) + 复盘(15) |
| **研究型** (research) | 思想深度(30) + 结构严谨(25) + 可发表性(20) + AI使用(15) + 拿来主义(10) |
| **产品型** (product) | 产品完成度(30) + 用户体验(20) + 技术实现(20) + AI使用(15) + 文档(15) |

### 文件改动

#### 1. 类型定义 (`lib/server/types.ts`)

```typescript
export interface RubricDimension {
  id: string;
  label: string;
  weight: number;
  maxPoints: number;
  description: string;
  signals: string[];
  negativeSignals: string[];
}

export interface RubricConfig {
  dimensions: RubricDimension[];
  totalPoints: number;
}

export interface RedFlag {
  id: string;
  description: string;
  pattern: string;
  affectedDimension: string;
  maxScore: number;
}

// AiEvaluation.scores 从固定 5 字段变成动态
export interface AiEvaluation {
  scoreTotal: number;
  scores: Record<string, number>;       // 原来是 {problemUnderstanding, aiUsage, ...}
  strengths: string;
  weaknesses: string;
  suggestions: string;
  feedback: string;
  fallback?: boolean;
  fallbackReason?: string;
  redFlagsHit?: string[];
}
```

#### 2. AI 评分 (`lib/server/ai.ts`)

```typescript
// 动态构建 Zod schema
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

// 动态构建 system prompt
function buildSystemPrompt(dimensions: RubricDimension[], redFlags?: RedFlag[]) {
  const dimLines = dimensions.map(d =>
    `- **${d.label}** (${d.id}, 0-${d.maxPoints}分): ${d.description}
     正面信号: ${d.signals.join("、")}
     负面信号: ${d.negativeSignals.join("、")}`
  ).join("\n\n");

  const flagLines = redFlags?.map(f =>
    `- ${f.description} → ${f.affectedDimension} ≤ ${f.maxScore} 分`
  ).join("\n") || "";

  return `你是 AI+X 项目课的助教。按以下标准评分，只返回 JSON。

评分维度：
${dimLines}
${flagLines ? `\n红线（命中则对应维度不超上限）：\n${flagLines}` : ""}

返回 JSON：
{${dimensions.map(d => `"${d.id}": <0-${d.maxPoints}>`).join(", ")}, "scoreTotal": <和>, ...}`;
}

// 主函数
export async function evaluateSubmission(input: AiInput): Promise<AiEvaluation> {
  // ① 解析结构化 rubric
  const challenge = input.challenge as { rubric_dimensions?: string; red_flags?: string };
  const rubric: RubricConfig = challenge?.rubric_dimensions
    ? JSON.parse(challenge.rubric_dimensions)
    : { dimensions: DEFAULT_DIMENSIONS, totalPoints: 100 };
  const redFlags: RedFlag[] = challenge?.red_flags
    ? JSON.parse(challenge.red_flags).flags : [];

  // ② 正则红线检查
  const redFlagsHit = redFlags
    .filter(f => new RegExp(f.pattern, "i").test(JSON.stringify(input)))
    .map(f => f.id);

  // ③ 动态 Zod + prompt
  const schema = buildAiSchema(rubric.dimensions);
  const systemPrompt = buildSystemPrompt(rubric.dimensions, redFlags);

  // ④ 调 AI + ⑤ 应用红线钳位 + ⑥ 返回
  // ...（同现有重试+fallback逻辑）
}
```

#### 3. 飞书读写 (`lib/server/feishu.ts`)

- `getChallengeById` 返回加 `rubric_dimensions?: string` 和 `red_flags?: string`
- `createChallenge` 入参加 `rubric_dimensions?` 和 `red_flags?`

#### 4. 工作流 (`lib/server/workflow.ts`)

- 传 `rubric_dimensions` 到 `evaluateSubmission` 的 input 里
- 写 Evaluations 时 `scores_json` 原样存 `aiEvaluation.scores`（动态 Record）

### 前端改动（`app/(app)/teacher/page.tsx`）

**发布表单改造：**

```
选 Challenge 类型: [构建型 ▾]   ← 选类型自动填默认维度

评分维度（权重合计 = 100）：
┌──────────┬────┬────┬────────────────┬───────────────┐
│ 维度名称  │权重│满分│ 正面信号         │ 负面信号       │
├──────────┼────┼────┼────────────────┼───────────────┤
│问题理解   │ 15 │ 15 │准确定义,明确用户 │跑题,理解偏差   │
│AI使用    │ 20 │ 20 │多轮迭代,工作流  │一句话指令      │
│产物完整性 │ 25 │ 25 │README,可运行    │文件为空       │
│技术实现   │ 25 │ 25 │代码规范,Git提交 │硬编码路径     │
│复盘质量   │ 15 │ 15 │具体分析,迭代记录│敷衍了事       │
└──────────┴────┴────┴────────────────┴───────────────┘
                       合计: 100 ✓

交付物(逗号分隔): [README.md, *.py, demo.*, *AI日志*]
红线规则（可选）: [展开/收起]

评分标准预览（自动生成，只读）:
"评分维度：问题理解(15分)、AI使用质量(20分)..."

[发布]
```

**POST body 变化：**

```typescript
// 改前
body: JSON.stringify({ title, brief, objective, deliverables, rubric, deadline })

// 改后
body: JSON.stringify({
  title, brief, objective, deliverables, deadline,
  rubric: autoGeneratedPreview,              // 人类可读文本
  rubricDimensions: dimensions,              // 结构化数组
  requiredFiles: ["README.md","*.py",...],   // 字符串数组
})
```

**学生评分展示 + 教师仪表盘：** 从 `scores_json` 动态渲染，支持任意数量的维度。

### 向后兼容
- `rubric_dimensions` 为空时 → fallback 到 DEFAULT_DIMENSIONS（现有 5 维）
- `scores_json` 兼容新旧两种格式（固定 5 字段 vs 动态 Record）
- 旧 challenge 的 `rubric` 自由文本不受影响

---

## 失败处理链

```
① GitHub 仓库不可访问 → 标 needs_revision，不进入评分
② 缺交付物 → 返回 needsRevision，通知学生缺什么
③ AI API 不可用 → fallbackEvaluation(76分)，审计日志
④ AI 返回格式不对 → Zod 校验失败 → 重试一次 → fallback
⑤ 红线命中 → 正则钳位对应维度分数，不依赖 LLM 自觉
⑥ 飞书写入失败 → 现有错误处理 + audit trail
```

---

## 实施顺序

| 阶段 | 内容 | 预估 | 依赖 |
|------|------|------|------|
| **Phase 1** | AI 看到代码（GitHub README + 文件列表） | 1.5h | 无 |
| **Phase 2** | 完整性检查（required_files vs 实际文件） | 1.5h | Phase 1（共用 fileList） |
| **Phase 3a** | 类型定义 + AI 评分动态化（types.ts, ai.ts） | 2h | 无 |
| **Phase 3b** | 飞书字段 + 读写适配 | 1h | Phase 3a |
| **Phase 3c** | 教师发布页 UI（维度表 + 默认模板） | 2h | Phase 3b |
| **Phase 3d** | 学生 + 教师评分展示动态化 | 1.5h | Phase 3b |
| **Phase 3e** | 红线规则（正则 + Zod + 钳位） | 1h | Phase 3a |

**推荐顺序：Phase 1 → Phase 2 → Phase 3a-e**

Phase 1 + 2 改动最小，可以立刻上线产生价值。Phase 3 是结构性改动，需要前后端联调。

---

## 改后 vs Richard 资料对比

| | NSEAP 改后 | Richard 资料 |
|---|---|---|
| **完整性检查** | ✅ required_files 对比 GitHub 文件列表 | ✅ filename_patterns + content_signals |
| **反模式/红线** | ✅ 正则检查 + system prompt 规则 | ✅ 维度级 positive/negative signals |
| **评分维度** | ✅ 随 challenge 类型变化，默认 4 套模板 | ✅ 通用 2 维 + 专属 2-4 维 |
| **权重设计** | ✅ 老师在 UI 上调，总和 = 100 | ✅ 公式：challenge 专属 50-60% + 通用 40-50% |
| **看代码** | ✅ README + 文件列表 + commit | ✅ content_signals 检测代码块 |
| **教师终审** | ✅ accept/return + 覆盖分数 | ⚠️ 只有概念设计 |
| **同伴互评** | ✅ 随机 3 人 + 飞书通知 | ⚠️ KSTAR 模板，无系统 |
| **迭代追踪** | ❌ | ✅ v1→v2→v3 |
| **规则可配置** | ✅ 结构化 JSON，老师可在 UI 改 | ✅ YAML |

---

## 改动文件清单

| 文件 | Phase | 改动 |
|------|-------|------|
| `lib/server/github.ts` | P1 | +getReadmeContent(), +getFileTree() |
| `lib/server/types.ts` | P1, P3a | GithubCheck 加字段；+RubricDimension, +RedFlag, AiEvaluation.scores 改动态 |
| `lib/server/ai.ts` | P1, P3a, P3e | user prompt 加 GitHub 内容；动态 Zod schema + system prompt；红线检查 |
| `lib/server/workflow.ts` | P1, P2, P3 | 传 GitHub 内容到 AI；完整性检查；动态维度传参 |
| `lib/server/feishu.ts` | P2, P3b | challenge 类型加新字段 |
| `app/(app)/teacher/page.tsx` | P2, P3c | 发布表单：required_files + 维度表 UI |
| 学生/教师评分展示组件 | P3d | 动态维度渲染 |
| 飞书 Challenges 表 | P2, P3 | +required_files, +rubric_dimensions, +red_flags |
