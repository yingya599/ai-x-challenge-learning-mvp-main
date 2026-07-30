// ============================================================
// NSEAP Learning Platform — Mock Data（对齐设计仓库规格）
// ============================================================
// 数据来源：
//   - Challenge 名称/描述/难度: elite20-builder-program-nseap Challenge Library
//   - 课程名称/内容: teams/platform-team/course-platform/curriculum/
//   - Rubric 结构: challenges/Challenge-Library/rubrics/assessment-rubric.md
//   - 知识条目类型: knowledge-base/schemas/knowledge-item.schema.json
//   - 学生/提交/作品: 飞书表中有真实数据，此处仅供离线开发和 Demo 使用
// ============================================================

// ===== 类型定义 =====

export interface Course {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: "进行中" | "已完成" | "未开始";
  modules: number;
  completedModules: number;
}

export interface Challenge {
  id: string;
  number: string;
  title: string;
  description: string;
  difficulty: "入门" | "进阶" | "挑战";
  status: "待完成" | "进行中" | "已完成";
  team: string;
  deliverables?: string;
  rubric?: string;
  deadline?: string;
  skills?: string;
  github_repo?: string;
  objective?: string;
  brief?: string;
  learning_objectives?: string;
  required_deliverables?: string;
}

export interface DocSection {
  id: string;
  title: string;
  category: string;
  lastUpdated: string;
  author: string;
  content: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  type: "FAQ" | "教材" | "Prompt" | "最佳实践" | "案例" | "Agent笔记" | "参考资料";
  tags: string[];
  summary: string;
  lastUpdated: string;
}

// ===== Challenge 详情类型（对齐 4 维评估体系） =====

export interface RubricLevel {
  label: string;
  points: number;
  description: string;
}

export interface RubricItem {
  criterion: string;
  weight: number;
  description: string;
  levels: RubricLevel[];
}

export interface ChallengeDetail {
  id: string;
  number: string;
  title: string;
  description: string;
  difficulty: "入门" | "进阶" | "挑战";
  status: "待完成" | "进行中" | "已完成";
  team: string;
  deliverables?: string;
  deadline?: string;
  skills?: string;
  rubric?: string;
  github_repo?: string;
  deadlines: string[];
  skillsList: string[];
  requirements: string[];
  rubricItems: RubricItem[];
  resources: string[];
}

export interface CheckResult {
  readme: boolean;
  commits: boolean;
  demo: boolean;
  reflection: boolean;
}

export interface AiReview {
  summary: string;
  score: number;
  strengths: string[];
  improvements: string[];
}

export type SubmissionStatus = "已提交" | "检查中" | "检查失败" | "待评审" | "已评分";

export interface Submission {
  id: string;
  challengeId: string;
  challengeTitle: string;
  studentId: string;
  studentName: string;
  githubRepo: string;
  githubBranch: string;
  status: SubmissionStatus;
  checkResults: CheckResult;
  aiReview: AiReview;
  teacherFeedback?: string;
  teacherScore?: number;
  submittedAt: string;
  reviewedAt?: string;
}

export interface PortfolioItem {
  id: string;
  studentName: string;
  studentId: string;
  challengeTitle: string;
  challengeId: string;
  summary: string;
  techStack: string[];
  demoUrl?: string;
  githubRepo: string;
  aiScore: number;
  teacherScore?: number;
  isPublic: boolean;
  submittedAt: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  github: string;
  email: string;
  studentClass: string;
  completedChallenges: number;
  totalChallenges: number;
  skillsList: string[];
}

// ============================================================
// 课程数据（对齐设计仓库 curriculum/ 目录 10 个模块）
// ============================================================

export const courses: Course[] = [
  { id: "elite20", title: "Elite20 AI+X 实验班", description: "10 周完整 AI 开发课程体系，从 KSTAR 学习循环到 Vibe Coding 实战", progress: 30, status: "进行中", modules: 10, completedModules: 3 },
  { id: "kstar", title: "KSTAR 学习循环", description: "认知细胞架构：Knowledge → Skill → Task → Artifact → Review 五步进化", progress: 100, status: "已完成", modules: 4, completedModules: 4 },
  { id: "agents", title: "Agent 开发实战", description: "单智能体 → 多智能体协作 → 真实项目交付", progress: 45, status: "进行中", modules: 6, completedModules: 3 },
];

// ============================================================
// Challenge 列表（对齐设计仓库 10 个真实 Challenge）
// ============================================================

// ============================================================
// Richard 7.14 挑战体系 — 20 个挑战（Phase 1 选拔 + Phase 2 实战）
// ============================================================

export const challenges: Challenge[] = [
  // Phase 1: SELECTION（选拔）— C1-C7
  { id: "c1",  number: "C1",  title: "课程资料获取与翻译",     description: "全量翻译 Stanford Vibe Coding 课程——从获取到翻译到发布，完整的信息获取与处理管线", difficulty: "入门", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c1-course-translation",  deliverables: "完整中文翻译、术语表、翻译说明、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-04-30" },
  { id: "c2",  number: "C2",  title: "AI for Math 论文",       description: "围绕 AI4Math 可靠性框架撰写一篇可投稿 LaTeX 学术论文——证明你能产出学术级别的成果", difficulty: "进阶", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c2-ai4math-paper",      deliverables: "LaTeX 论文、参考文献、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-05-15" },
  { id: "c2a", number: "C2A", title: "衡量 AGI 的认知能力",     description: "设计 Kaggle 竞赛基准提案，覆盖 5 个认知能力赛道——从学术研究到竞赛设计", difficulty: "进阶", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c2a-agi-benchmark",       deliverables: "竞赛提案文档、评估方案、数据样本、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-05-20" },
  { id: "c2g", number: "C2G", title: "参数高尔夫 Parameter Golf", description: "16MB + 10分钟 8×H100 极限约束下训 nanoGPT，冲 OpenAI 全球榜单——直通顶级 ML 岗位", difficulty: "挑战", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c2g-parameter-golf",     deliverables: "训练脚本、最优配置、实验记录、榜单截图、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-04-30" },
  { id: "c3",  number: "C3",  title: "群内高质量参与",         description: "在群内进行高质量提问、反思、推动讨论——成为思考驱动者而非潜水者", difficulty: "入门", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c3-quality-discussion", deliverables: "讨论记录摘要、关键提问清单、推动讨论的证据、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-07-01" },
  { id: "c3c", number: "C3C", title: "双人协作与技能迁移",     description: "跨专业组队互教，联合完成单独做不到的项目——证明 1+1>2 的协作能力", difficulty: "进阶", status: "进行中", team: "2人组", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c3c-peer-collab",          deliverables: "协作项目代码、知识迁移证据、双向教学记录、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-07-15" },
  { id: "c4",  number: "C4",  title: "技能分享与传播",         description: "创建一个可复用、可执行、可验证、IO 明确的 AI 技能包——把个人能力变成可复制的工具", difficulty: "入门", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c4-skill-sharing",        deliverables: "技能说明、可执行内容、演示、教学说明、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-07-01" },
  { id: "c4a", number: "C4A", title: "技能提交自动评审",       description: "把收发室升级为阅卷系统——自动扫描并评审 C4 技能提交的完整性与质量", difficulty: "进阶", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c4a-skill-evaluator",      deliverables: "评审 Agent、评分报告、自动校验脚本、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-07-10" },
  { id: "c4b", number: "C4B", title: "公众号文章生成技能",     description: "构建 Markdown/Word → 微信公众号 HTML 转换流水线——一键生成排版精美的公众号文章", difficulty: "进阶", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c4b-wechat-publisher",    deliverables: "转换流水线代码、样式模板、输出样例、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-07-10" },
  { id: "c4c", number: "C4C", title: "作业自动求解与排版",     description: "迁移至国产大模型（Qwen/Kimi），扩展到非极限学科——构建完整自动化求解流水线", difficulty: "挑战", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c4c-homework-solver",      deliverables: "求解代码、LaTeX模板、对比报告、正确PDF输出、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-07-20" },
  { id: "c4d", number: "C4D", title: "本地大模型 Agent 技能",  description: "在本地设备上运行 Gemma 4 驱动 Agent 技能，生成交互式地图——不花一分钱 API 费用", difficulty: "挑战", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c4d-local-gemma-agent",   deliverables: "本地部署配置、Agent 技能代码、交互式地图、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-07-20" },
  { id: "c5",  number: "C5",  title: "GitHub 开源项目",        description: "创建公开仓库，含 README、文档、可复现代码——建立公开可验证的技术能力", difficulty: "入门", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c5-github-repo",          deliverables: "开源仓库、完整README、文档、可复现代码、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-08-01" },
  { id: "c5a", number: "C5A", title: "GitHub 入门与仓库理解",  description: "创建 GitHub 账号，Fork neolaf2/neoskills，Clone 到本地，写仓库分析——工程素养基础", difficulty: "入门", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c5a-github-fundamentals", deliverables: "仓库分析文档、Fork/Clone记录、AAR（每级）、AI日志", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-07-25" },
  { id: "c6",  number: "C6",  title: "Web 应用",              description: "部署一个集成 AI 能力的完整 Web 应用——不是 demo，而是别人打开就能用的产品", difficulty: "进阶", status: "待完成", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c6-web-app",              deliverables: "可部署Web应用、产品文档、用户指南、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-08-15" },
  { id: "c6a", number: "C6A", title: "提交数据仪表盘",         description: "用 C4A 收集全部提交数据，构建按学生/挑战/时间分类的可交互仪表盘——你的第一个数据产品", difficulty: "进阶", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c6a-dashboard",             deliverables: "仪表盘网站、Excel报表、结构化数据、数据管线、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-08-15" },
  { id: "c7",  number: "C7",  title: "内容传播",               description: "在微信公众号或知乎持续发布内容，建立个人影响力——让世界看到你的能力", difficulty: "入门", status: "待完成", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c7-content-distribution", deliverables: "已发布文章、阅读数据、内容规划、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-09-01" },
  // Phase 2: EXECUTION（实战）— C8-C10 + C10H
  { id: "c8",  number: "C8",  title: "真实项目落地",           description: "参与真实客户项目（Project A/B/C），交付可验证成果——证明你能在真实世界里做成事", difficulty: "挑战", status: "待完成", team: "3-5人组", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c8-real-world-project", deliverables: "项目交付物、客户确认、项目文档、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-10-01" },
  { id: "c9",  number: "C9",  title: "自驱项目",               description: "完全自定义、自驱动的个人项目——如果没人给你方向，你还能持续创造价值吗？", difficulty: "挑战", status: "待完成", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c9-self-initiated",      deliverables: "项目定义、可运行产品、使用文档、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-10-01" },
  { id: "c10", number: "C10", title: "构建个人智能体",         description: "构建个人 Agent 系统，沉淀 Skill、Memory、Workflow——你未来十年的能力基础设施", difficulty: "挑战", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c10-personal-agent",      deliverables: "Agent系统、技能库、记忆系统、工作流、AI日志、AAR复盘", rubric: "拿来主义(20) + 有效反馈(20) + 多次迭代(30) + 可复用性(30)", deadline: "2026-10-15" },
  { id: "c10h", number: "C10H", title: "安装并驾驭 Hermes Agent", description: "安装 Nous Research 开源 Agent 平台，配置多平台接入，定制个性化智能体——先站在巨人肩膀上", difficulty: "入门", status: "进行中", team: "个人", github_repo: "https://github.com/a976xw7td/nseap-elite20-challenges/tree/main/c10h-hermes-agent",      deliverables: "安装记录、平台接入截图、自定义技能、SOUL.md、AI日志、AAR复盘", rubric: "安装运行(25) + 功能探索(25) + 完成级别(20) + 个性化创造(20) + 拿来主义(10)", deadline: "2026-07-30" },
];

// ============================================================
// Challenge 详情（对齐设计仓库的四维评估体系）
// ============================================================

export const challengeDetails: ChallengeDetail[] = [
  {
    id: "c01", number: "C01", title: "构建你的第一个 AI 助手", description: "用 AI 工具创建一个能与用户对话的 AI 助手——你不需要会编程，只需要会思考和指挥", difficulty: "入门", status: "已完成", team: "个人",
    deadlines: ["助手定义文档", "可运行的助手原型", "人机协作记录", "AAR 复盘"],
    deadline: "2026-07-20",
    skillsList: ["AI 对话设计", "提示词基础", "需求定义", "迭代思维"],
    requirements: ["助手能完成至少 3 轮有意义的对话", "协作记录含 3 条以上迭代", "AAR 包含具体经历和反思"],
    rubricItems: [
      { criterion: "拿来主义（借鉴已有方案）", weight: 20, description: "是否参考了已有方案并做了改进", levels: [
        { label: "未达标", points: 0, description: "从零开始，没有参考任何已有方案" },
        { label: "通过", points: 60, description: "参考了至少 1 个已有方案或示例" },
        { label: "良好", points: 80, description: "参考多个方案并做了对比选择" },
        { label: "优秀", points: 100, description: "借鉴精华并做了原创性改进" }]},
      { criterion: "有效反馈（获取外部意见）", weight: 20, description: "是否获取并吸收了外部反馈", levels: [
        { label: "未达标", points: 0, description: "没有获取任何外部反馈" },
        { label: "通过", points: 60, description: "获得至少 1 人的反馈" },
        { label: "良好", points: 80, description: "获得 2+ 人反馈并做了吸收" },
        { label: "优秀", points: 100, description: "主动迭代反馈循环（提反馈→修改→再反馈）" }]},
      { criterion: "多次迭代（持续改进）", weight: 30, description: "是否进行了多轮迭代改进", levels: [
        { label: "未达标", points: 0, description: "一版定稿，没有修改" },
        { label: "通过", points: 60, description: "完成 1 轮迭代" },
        { label: "良好", points: 80, description: "完成 2 轮迭代，每轮有明确方向" },
        { label: "优秀", points: 100, description: "3 轮以上迭代，有明显质量提升" }]},
      { criterion: "可复用性（产出能共享）", weight: 30, description: "成果是否可以被他人理解和使用", levels: [
        { label: "未达标", points: 0, description: "别人无法理解你做了什么" },
        { label: "通过", points: 60, description: "别人能看懂做的是什么" },
        { label: "良好", points: 80, description: "别人能用你的代码/配置跑起来" },
        { label: "优秀", points: 100, description: "别人能直接使用你的助手" }]},
    ],
    resources: ["DeepSeek / ChatGPT / Claude 任一 AI 工具", "Hermes Agent Skill 模板", "单页 Web 应用示例"],
  },
  {
    id: "c02", number: "C02", title: "AI 结对编程入门", description: "体验 AI 辅助编程的完整流程——不是让 AI 替你写代码，而是让 AI 做你的结对编程伙伴", difficulty: "入门", status: "已完成", team: "个人",
    deadlines: ["需求文档", "可运行程序", "代码审查记录", "AAR 复盘"],
    deadline: "2026-07-25",
    skillsList: ["Python/JavaScript 基础", "AI 辅助编程", "代码阅读", "调试"],
    requirements: ["程序能正常运行", "代码有注释和 README", "审查记录含 AI 辅助的改进意见"],
    rubricItems: [
      { criterion: "拿来主义", weight: 20, description: "是否参考了已有项目或模板", levels: [
        { label: "未达标", points: 0, description: "完全没有参考任何已有代码" },
        { label: "通过", points: 60, description: "参考了至少 1 个开源项目" },
        { label: "良好", points: 80, description: "比较多个方案后选择最佳实践" },
        { label: "优秀", points: 100, description: "在借鉴基础上做了架构改进" }]},
      { criterion: "有效反馈", weight: 20, description: "是否让 AI 审查了代码并采纳了建议", levels: [
        { label: "未达标", points: 0, description: "没有用 AI 审查代码" },
        { label: "通过", points: 60, description: "让 AI 审查了代码" },
        { label: "良好", points: 80, description: "AI 提出改进建议并被采纳" },
        { label: "优秀", points: 100, description: "多轮 AI 审查 + 人工审查" }]},
      { criterion: "多次迭代", weight: 30, description: "代码经历了几轮迭代", levels: [
        { label: "未达标", points: 0, description: "代码一次性提交无修改" },
        { label: "通过", points: 60, description: "完成 1 轮功能迭代" },
        { label: "良好", points: 80, description: "2 轮迭代有明显改进" },
        { label: "优秀", points: 100, description: "3 轮以上，每轮 commit 清晰可追溯" }]},
      { criterion: "可复用性", weight: 30, description: "代码是否规范可维护", levels: [
        { label: "未达标", points: 0, description: "无注释、无 README" },
        { label: "通过", points: 60, description: "有基本 README 和注释" },
        { label: "良好", points: 80, description: "README 完整，代码可读" },
        { label: "优秀", points: 100, description: "有测试、有文档、可以直接复用" }]},
    ],
    resources: ["Claude Code / Codex / Cursor", "Python 或 Node.js 环境", "GitHub 仓库模板"],
  },
  {
    id: "c03", number: "C03", title: "提示词工程实战", description: "系统学习提示词设计——从单轮对话到多轮上下文管理，让 AI 稳定输出高质量结果", difficulty: "入门", status: "已完成", team: "个人",
    deadlines: ["提示词库（至少 10 条）", "效果对比报告", "使用指南", "AAR 复盘"],
    deadline: "2026-08-01",
    skillsList: ["Prompt Engineering", "上下文管理", "Few-shot 设计", "效果评估"],
    requirements: ["提示词库覆盖 3+ 场景", "效果对比含改进前后输出", "指南能让别人直接用"],
    rubricItems: [
      { criterion: "拿来主义", weight: 20, description: "是否参考了成熟的 Prompt 模板", levels: [
        { label: "未达标", points: 0, description: "所有提示词都是自己从零写的" },
        { label: "通过", points: 60, description: "参考了社区 Prompt 模板" },
        { label: "良好", points: 80, description: "综合多个来源做了优化" },
        { label: "优秀", points: 100, description: "形成了自己的提示词方法论" }]},
      { criterion: "有效反馈", weight: 20, description: "是否用 AI 评估提示词效果", levels: [
        { label: "未达标", points: 0, description: "没有对比提示词效果" },
        { label: "通过", points: 60, description: "对比了至少 3 条提示词的效果" },
        { label: "良好", points: 80, description: "有结构化的效果评估" },
        { label: "优秀", points: 100, description: "有量化指标和 A/B 测试" }]},
      { criterion: "多次迭代", weight: 30, description: "提示词是否经过多轮优化", levels: [
        { label: "未达标", points: 0, description: "每条提示词只写了一版" },
        { label: "通过", points: 60, description: "每条提示词至少迭代了 2 轮" },
        { label: "良好", points: 80, description: "记录了迭代理由和效果变化" },
        { label: "优秀", points: 100, description: "迭代过程可追溯、可复现" }]},
      { criterion: "可复用性", weight: 30, description: "提示词库是否组织清晰", levels: [
        { label: "未达标", points: 0, description: "提示词散乱，无分类" },
        { label: "通过", points: 60, description: "按场景分类" },
        { label: "良好", points: 80, description: "分类清晰 + 使用说明" },
        { label: "优秀", points: 100, description: "有模板系统，可直接导入使用" }]},
    ],
    resources: ["Prompt Engineering Guide", "OpenAI Prompt 最佳实践", "Few-shot 示例集"],
  },
  {
    id: "c04", number: "C04", title: "用 AI 做研究综述", description: "用 AI 工具快速梳理一个领域的文献、构建知识图谱、撰写综述报告", difficulty: "入门", status: "进行中", team: "个人",
    deadlines: ["文献综述报告", "知识图谱（思维导图）", "参考文献列表", "AAR 复盘"],
    deadline: "2026-08-05",
    skillsList: ["文献检索", "AI 辅助阅读", "知识整理", "学术写作"],
    requirements: ["综述覆盖 10+ 篇文献", "知识图谱展示领域结构", "参考文献格式规范"],
    rubricItems: [
      { criterion: "拿来主义", weight: 20, description: "文献检索是否充分", levels: [
        { label: "未达标", points: 0, description: "只看了不到 5 篇文献" },
        { label: "通过", points: 60, description: "检索了 10+ 篇文献" },
        { label: "良好", points: 80, description: "覆盖了领域经典 + 最新成果" },
        { label: "优秀", points: 100, description: "文献覆盖全面且有筛选标准" }]},
      { criterion: "有效反馈", weight: 20, description: "是否用 AI 交叉验证", levels: [
        { label: "未达标", points: 0, description: "完全自己阅读，没用 AI" },
        { label: "通过", points: 60, description: "用 AI 辅助阅读了文献" },
        { label: "良好", points: 80, description: "AI 帮助发现了文献间关联" },
        { label: "优秀", points: 100, description: "AI + 人工交叉验证，识别了矛盾" }]},
      { criterion: "多次迭代", weight: 30, description: "综述是否经过多轮完善", levels: [
        { label: "未达标", points: 0, description: "一稿提交" },
        { label: "通过", points: 60, description: "完成了 1 轮修改" },
        { label: "良好", points: 80, description: "2 轮修改有结构优化" },
        { label: "优秀", points: 100, description: "3 轮以上，每次都有明确改进" }]},
      { criterion: "可复用性", weight: 30, description: "成果是否可被他人使用", levels: [
        { label: "未达标", points: 0, description: "只有综述，无结构化输出" },
        { label: "通过", points: 60, description: "有文献列表和摘要" },
        { label: "良好", points: 80, description: "有知识图谱可视化" },
        { label: "优秀", points: 100, description: "综述 + 图谱 + 可交互浏览" }]},
    ],
    resources: ["Google Scholar / Semantic Scholar", "Zotero 文献管理", "Obsidian / Logseq 知识图谱工具"],
  },
  {
    id: "c05", number: "C05", title: "单智能体系统开发", description: "用 AI 辅助设计并实现一个完整功能的 AI Agent，包含身份定义、能力声明和接口设计", difficulty: "进阶", status: "待完成", team: "Agent 组",
    deadlines: ["Agent 设计文档", "Agent 实现代码", "测试用例", "部署配置"],
    deadline: "2026-08-15",
    skillsList: ["Agent 架构", "API 设计", "Prompt 编排", "MCP 协议"],
    requirements: ["Agent 能独立完成任务", "有明确的输入输出接口", "含错误处理和日志"],
    rubricItems: [
      { criterion: "拿来主义", weight: 20, description: "是否基于现有 Agent 框架", levels: [
        { label: "未达标", points: 0, description: "完全从零实现，没有参考任何框架" },
        { label: "通过", points: 60, description: "参考了至少 1 个 Agent 框架" },
        { label: "良好", points: 80, description: "在框架基础上做了定制" },
        { label: "优秀", points: 100, description: "对框架做了改进并回馈社区" }]},
      { criterion: "有效反馈", weight: 20, description: "是否让其他 Agent 审查", levels: [
        { label: "未达标", points: 0, description: "没有做 Agent 间交叉审查" },
        { label: "通过", points: 60, description: "用另一个 AI 审查了代码" },
        { label: "良好", points: 80, description: "多 Agent 交叉审查 + 人工检查" },
        { label: "优秀", points: 100, description: "建立了自动化审查流程" }]},
      { criterion: "多次迭代", weight: 30, description: "Agent 功能迭代了几版", levels: [
        { label: "未达标", points: 0, description: "只有一个基础版本" },
        { label: "通过", points: 60, description: "完成了至少 1 次功能迭代" },
        { label: "良好", points: 80, description: "2 次迭代有明显功能扩展" },
        { label: "优秀", points: 100, description: "3 次以上，有版本管理和 Changelog" }]},
      { criterion: "可复用性", weight: 30, description: "Agent 是否可被他人部署和使用", levels: [
        { label: "未达标", points: 0, description: "只有代码，无文档无配置" },
        { label: "通过", points: 60, description: "有 README 和基本配置" },
        { label: "良好", points: 80, description: "有部署脚本和 API 文档" },
        { label: "优秀", points: 100, description: "一键部署 + 完整文档 + 测试" }]},
    ],
    resources: ["Hermes Agent 文档", "MCP 协议规范", "Agent Manifest Schema"],
  },
  {
    id: "c06", number: "C06", title: "多智能体协作系统", description: "让多个 AI Agent 协同工作——消息路由、信任关系、审计日志全链路打通", difficulty: "进阶", status: "待完成", team: "Agent 组",
    deadlines: ["多 Agent 架构图", "消息路由配置", "集成测试", "审计日志"],
    deadline: "2026-08-22",
    skillsList: ["多 Agent 编排", "消息队列", "信任关系", "审计"],
    requirements: ["至少 3 个 Agent 协作", "消息链路可追踪", "审计日志完整"],
    rubricItems: [
      { criterion: "拿来主义", weight: 20, description: "是否参考了多 Agent 架构", levels: [
        { label: "未达标", points: 0, description: "没有参考任何多 Agent 设计" },
        { label: "通过", points: 60, description: "参考了至少 1 个多 Agent 案例" },
        { label: "良好", points: 80, description: "比较多种架构后选择最佳方案" },
        { label: "优秀", points: 100, description: "提出了自己的多 Agent 设计模式" }]},
      { criterion: "有效反馈", weight: 20, description: "是否做了 Agent 间压力测试", levels: [
        { label: "未达标", points: 0, description: "没有测试边界情况" },
        { label: "通过", points: 60, description: "测试了正常流程" },
        { label: "良好", points: 80, description: "测试了异常和边界情况" },
        { label: "优秀", points: 100, description: "有完整的测试矩阵和故障恢复" }]},
      { criterion: "多次迭代", weight: 30, description: "协作链路是否持续优化", levels: [
        { label: "未达标", points: 0, description: "消息路由只实现了一个版本" },
        { label: "通过", points: 60, description: "优化了 1 次消息路由" },
        { label: "良好", points: 80, description: "2 轮优化有明显延迟降低" },
        { label: "优秀", points: 100, description: "有性能监控和持续优化机制" }]},
      { criterion: "可复用性", weight: 30, description: "多 Agent 系统是否可重现部署", levels: [
        { label: "未达标", points: 0, description: "只能在自己的环境跑" },
        { label: "通过", points: 60, description: "有 docker-compose 可一键启动" },
        { label: "良好", points: 80, description: "有完整的部署文档" },
        { label: "优秀", points: 100, description: "有 CI/CD + 自动化部署" }]},
    ],
    resources: ["NSEAP Agent 协作流文档", "Message Envelope Schema", "Audit Log Schema"],
  },
  {
    id: "c07", number: "C07", title: "AI + 数据处理管道", description: "构建一条用 AI 驱动的数据处理管道——从原始数据采集到结构化输出", difficulty: "进阶", status: "待完成", team: "知识组",
    deadlines: ["数据处理管道代码", "数据 Schema 定义", "处理结果样本", "性能测试报告"],
    deadline: "2026-08-29",
    skillsList: ["数据工程", "ETL 管道", "AI 数据增强", "Schema 设计"],
    requirements: ["管道能处理真实数据", "有数据质量验证", "处理速度达标"],
    rubricItems: [
      { criterion: "拿来主义", weight: 20, description: "是否参考了成熟的数据管道设计", levels: [
        { label: "未达标", points: 0, description: "管道设计完全自创" },
        { label: "通过", points: 60, description: "参考了至少 1 个 ETL 框架" },
        { label: "良好", points: 80, description: "基于成熟框架做了定制" },
        { label: "优秀", points: 100, description: "框架选择有充分理由和对比" }]},
      { criterion: "有效反馈", weight: 20, description: "是否用 AI 验证了数据质量", levels: [
        { label: "未达标", points: 0, description: "没有数据质量检查" },
        { label: "通过", points: 60, description: "有基本的数据校验" },
        { label: "良好", points: 80, description: "AI 辅助发现了数据异常" },
        { label: "优秀", points: 100, description: "建立了持续的 AI 数据监控" }]},
      { criterion: "多次迭代", weight: 30, description: "管道是否经过性能优化", levels: [
        { label: "未达标", points: 0, description: "管道只有初版" },
        { label: "通过", points: 60, description: "优化了 1 次处理逻辑" },
        { label: "良好", points: 80, description: "2 轮优化有明显性能提升" },
        { label: "优秀", points: 100, description: "有性能基准测试和持续优化" }]},
      { criterion: "可复用性", weight: 30, description: "管道是否能被他人使用", levels: [
        { label: "未达标", points: 0, description: "硬编码配置，无法复用" },
        { label: "通过", points: 60, description: "有配置文件可修改" },
        { label: "良好", points: 80, description: "有 Schema 文档和使用示例" },
        { label: "优秀", points: 100, description: "插件化设计，可直接集成" }]},
    ],
    resources: ["Apache Airflow / Prefect", "Pandas / Polars", "Great Expectations 数据验证"],
  },
  {
    id: "c08", number: "C08", title: "飞书/钉钉/微信集成", description: "将 AI Agent 接入企业 IM 平台，实现 Agent 对人通知和消息交互", difficulty: "进阶", status: "待完成", team: "平台组",
    deadlines: ["IM 集成代码", "消息卡片模板", "Bot 配置指南", "用户反馈报告"],
    deadline: "2026-09-05",
    skillsList: ["飞书 API", "Webhook", "消息卡片", "Bot 开发"],
    requirements: ["Agent 能通过 IM 收发消息", "消息格式符合平台规范", "有异常处理"],
    rubricItems: [
      { criterion: "拿来主义", weight: 20, description: "是否参考了官方 SDK 和示例", levels: [
        { label: "未达标", points: 0, description: "没有看官方文档" },
        { label: "通过", points: 60, description: "基于官方 SDK 开发" },
        { label: "良好", points: 80, description: "参考了社区最佳实践" },
        { label: "优秀", points: 100, description: "贡献了改进建议或 PR" }]},
      { criterion: "有效反馈", weight: 20, description: "是否让真实用户试用", levels: [
        { label: "未达标", points: 0, description: "只有开发者自己测过" },
        { label: "通过", points: 60, description: "1 位用户试用过" },
        { label: "良好", points: 80, description: "3+ 用户试用并给出了反馈" },
        { label: "优秀", points: 100, description: "收集了 5+ 用户反馈并迭代" }]},
      { criterion: "多次迭代", weight: 30, description: "集成的稳定性和体验是否提升", levels: [
        { label: "未达标", points: 0, description: "只实现了基础收发" },
        { label: "通过", points: 60, description: "增加了错误处理和重试" },
        { label: "良好", points: 80, description: "优化了消息格式和交互体验" },
        { label: "优秀", points: 100, description: "有 SLA 监控和自动恢复" }]},
      { criterion: "可复用性", weight: 30, description: "集成方案是否通用", levels: [
        { label: "未达标", points: 0, description: "写死了特定群聊 ID" },
        { label: "通过", points: 60, description: "支持配置文件切换" },
        { label: "良好", points: 80, description: "支持多平台（飞书+钉钉+微信）" },
        { label: "优秀", points: 100, description: "抽象了通用 IM 接口层" }]},
    ],
    resources: ["飞书开放平台文档", "钉钉机器人文档", "企业微信 API"],
  },
  {
    id: "c09", number: "C09", title: "真实项目交付", description: "为一个真实需求方交付可部署的产品——从需求分析到上线，完整走一遍", difficulty: "挑战", status: "待完成", team: "全员",
    deadlines: ["项目任务书", "可部署产品", "用户使用文档", "项目复盘报告"],
    deadline: "2026-09-20",
    skillsList: ["全栈开发", "需求分析", "项目交付", "客户沟通"],
    requirements: ["需求方确认过任务书", "产品能实际使用", "有完整的交付文档"],
    rubricItems: [
      { criterion: "拿来主义", weight: 20, description: "是否基于成熟技术栈", levels: [
        { label: "未达标", points: 0, description: "技术选型无依据" },
        { label: "通过", points: 60, description: "选型有对比分析" },
        { label: "良好", points: 80, description: "选型针对需求方场景优化" },
        { label: "优秀", points: 100, description: "选型方案可推广到同类项目" }]},
      { criterion: "有效反馈", weight: 20, description: "是否与需求方持续沟通", levels: [
        { label: "未达标", points: 0, description: "需求方只见过最终产品" },
        { label: "通过", points: 60, description: "需求方参与了中期评审" },
        { label: "良好", points: 80, description: "每周同步，需求方参与迭代" },
        { label: "优秀", points: 100, description: "需求方成为产品 advocate" }]},
      { criterion: "多次迭代", weight: 30, description: "产品是否根据真实反馈改进", levels: [
        { label: "未达标", points: 0, description: "产品没有根据反馈修改" },
        { label: "通过", points: 60, description: "根据反馈改了 1 版" },
        { label: "良好", points: 80, description: "2 轮反馈驱动的迭代" },
        { label: "优秀", points: 100, description: "3 轮以上，每次迭代有明确的需求依据" }]},
      { criterion: "可复用性", weight: 30, description: "是否沉淀了可复用的经验", levels: [
        { label: "未达标", points: 0, description: "只有产品，没有沉淀" },
        { label: "通过", points: 60, description: "有项目复盘文档" },
        { label: "良好", points: 80, description: "复盘含可复用的模板和流程" },
        { label: "优秀", points: 100, description: "形成了可复用的交付方案" }]},
    ],
    resources: ["需求分析模板", "项目管理工具", "部署平台（Vercel / 服务器）"],
  },
  {
    id: "c10", number: "C10", title: "平台重构与开源发布", description: "将 MVP 重构为可开源的生产级平台，含完整文档、部署指南和 CI/CD", difficulty: "挑战", status: "待完成", team: "全员",
    deadlines: ["开源代码仓库", "完整文档体系", "CI/CD 流程", "社区贡献指南"],
    deadline: "2026-10-01",
    skillsList: ["开源协作", "CI/CD", "文档工程", "社区运营"],
    requirements: ["代码开源且 License 清晰", "文档覆盖安装/使用/贡献", "CI 全绿"],
    rubricItems: [
      { criterion: "拿来主义", weight: 20, description: "是否参考了优秀开源项目", levels: [
        { label: "未达标", points: 0, description: "没有参考任何开源项目" },
        { label: "通过", points: 60, description: "参考了至少 1 个项目结构" },
        { label: "良好", points: 80, description: "综合多个项目的优点" },
        { label: "优秀", points: 100, description: "形成了自己的开源工程规范" }]},
      { criterion: "有效反馈", weight: 20, description: "是否获取了社区反馈", levels: [
        { label: "未达标", points: 0, description: "发布后无任何外部反馈" },
        { label: "通过", points: 60, description: "获得了至少 1 条外部反馈" },
        { label: "良好", points: 80, description: "收到了 issue 或 PR" },
        { label: "优秀", points: 100, description: "有活跃的社区互动" }]},
      { criterion: "多次迭代", weight: 30, description: "平台是否持续演进", levels: [
        { label: "未达标", points: 0, description: "开源后无更新" },
        { label: "通过", points: 60, description: "发布了至少 1 个 patch 版本" },
        { label: "良好", points: 80, description: "有版本规划和 Changelog" },
        { label: "优秀", points: 100, description: "有 Roadmap 和定期发布节奏" }]},
      { criterion: "可复用性", weight: 30, description: "一键部署是否真的能跑", levels: [
        { label: "未达标", points: 0, description: "文档有坑，别人跑不起来" },
        { label: "通过", points: 60, description: "新人按文档能跑起来" },
        { label: "良好", points: 80, description: "有 Docker 和 Vercel 两种部署方式" },
        { label: "优秀", points: 100, description: "有自动化测试验证部署流程" }]},
    ],
    resources: ["GitHub Actions 文档", "Docker 文档", "开源项目治理指南"],
  },
];

export function getChallengeDetail(id: string): ChallengeDetail | undefined {
  return challengeDetails.find((c) => c.id === id);
}

// ============================================================
// 学生数据（Demo 用，真实数据在飞书 Students 表）
// ============================================================

export const students: StudentProfile[] = [
  { id: "s01", name: "张浩", github: "a976xw7td", email: "2461681460@qq.com", studentClass: "AI+X Vibe Coding 实验班", completedChallenges: 3, totalChallenges: 10, skillsList: ["TypeScript", "React", "Next.js", "Python", "Agent 架构", "飞书集成", "本体工程", "KSTAR 闭环"] },
  { id: "s02", name: "李四", github: "lisi-dev", email: "lisi@example.com", studentClass: "Elite20", completedChallenges: 2, totalChallenges: 10, skillsList: ["Python", "FastAPI", "PostgreSQL"] },
  { id: "s03", name: "王五", github: "wangwu-dev", email: "wangwu@example.com", studentClass: "Elite20", completedChallenges: 1, totalChallenges: 10, skillsList: ["Vue.js", "JavaScript"] },
  { id: "s04", name: "赵六", github: "zhaoliu-dev", email: "zhaoliu@example.com", studentClass: "Elite20", completedChallenges: 3, totalChallenges: 10, skillsList: ["Rust", "WebAssembly", "TypeScript"] },
  { id: "s05", name: "陈七", github: "chenqi-dev", email: "chenqi@example.com", studentClass: "Elite20", completedChallenges: 0, totalChallenges: 10, skillsList: ["Java", "Spring Boot"] },
];

// ============================================================
// 提交数据（Demo 用，对齐真实 Challenge ID）
// ============================================================

export const submissions: Submission[] = [
  { id: "sub-001", challengeId: "c01", challengeTitle: "构建你的第一个 AI 助手", studentId: "s01", studentName: "张浩", githubRepo: "a976xw7td/first-ai-assistant", githubBranch: "main", status: "已评分", checkResults: { readme: true, commits: true, demo: true, reflection: true }, aiReview: { summary: "助手定义清晰，定位为「编程入门助手」帮新生快速了解课程体系。协作记录展示了完整的指挥→校验→反馈循环。提示词设计有明确的迭代方向。", score: 88, strengths: ["需求定义准确", "协作记录完整", "迭代方向清晰", "AAR 反思深入"], improvements: ["可增加更多边缘情况处理", "知识库可进一步扩展"] }, teacherFeedback: "整体完成度很高，初次用 AI 就能做到这个程度很不容易。建议下一步让几个同学试用你的助手，收集真实反馈再迭代。", teacherScore: 90, submittedAt: "2026-07-05", reviewedAt: "2026-07-07" },
  { id: "sub-002", challengeId: "c01", challengeTitle: "构建你的第一个 AI 助手", studentId: "s02", studentName: "李四", githubRepo: "lisi-dev/study-buddy", githubBranch: "main", status: "待评审", checkResults: { readme: true, commits: true, demo: false, reflection: true }, aiReview: { summary: "做的是一个学习监督助手，能根据学习计划提醒和检查进度。功能设计实用，但缺少可运行的 Demo 链接。", score: 72, strengths: ["功能设计贴近实际需求", "包含 AAR 复盘", "代码结构规范"], improvements: ["缺少 Demo 链接", "README 可以更详细", "可增加学习计划模板"] }, submittedAt: "2026-07-06" },
  { id: "sub-003", challengeId: "c02", challengeTitle: "AI 结对编程入门", studentId: "s01", studentName: "张浩", githubRepo: "a976xw7td/ai-pair-calc", githubBranch: "main", status: "已评分", checkResults: { readme: true, commits: true, demo: true, reflection: true }, aiReview: { summary: "做了一个计算器应用，展示了完整的 AI 结对编程流程——从自然语言描述需求到 AI 生成代码，再到人工审查和迭代优化。代码审查记录展示了良好的「指挥→校验→反馈」循环。", score: 92, strengths: ["结对编程流程完整", "代码审查记录详实", "多轮迭代可追溯", "README 清晰"], improvements: ["可增加单元测试", "UI 可以更友好"] }, teacherFeedback: "结对编程流程展示得很好，代码审查记录是很好的学习材料。建议下次尝试更复杂的项目，比如一个 Todo 应用。", teacherScore: 93, submittedAt: "2026-07-03", reviewedAt: "2026-07-05" },
  { id: "sub-004", challengeId: "c03", challengeTitle: "提示词工程实战", studentId: "s04", studentName: "赵六", githubRepo: "zhaoliu-dev/prompt-playbook", githubBranch: "main", status: "检查失败", checkResults: { readme: false, commits: true, demo: false, reflection: false }, aiReview: { summary: "仓库已创建但 README 为空，没有效果对比报告和使用指南。提交不完整。", score: 30, strengths: ["仓库结构基本正确", "有部分提示词草稿"], improvements: ["需要补充 README", "需要效果对比报告", "需要使用指南"] }, submittedAt: "2026-07-04" },
  { id: "sub-005", challengeId: "c02", challengeTitle: "AI 结对编程入门", studentId: "s02", studentName: "李四", githubRepo: "lisi-dev/cli-todo", githubBranch: "main", status: "检查中", checkResults: { readme: true, commits: true, demo: false, reflection: false }, aiReview: { summary: "正在检查仓库内容...", score: 0, strengths: [], improvements: [] }, submittedAt: "2026-07-08" },
];

export function getSubmissionsByStudent(studentId: string): Submission[] {
  return submissions.filter((s) => s.studentId === studentId);
}

export function getSubmissionById(id: string): Submission | undefined {
  return submissions.find((s) => s.id === id);
}

// ============================================================
// 作品集（Demo 用，对齐真实 Challenge）
// ============================================================

export const portfolioItems: PortfolioItem[] = [
  { id: "pf-001", studentName: "张浩", studentId: "s01", challengeTitle: "构建你的第一个 AI 助手", challengeId: "c01", summary: "做了一个「编程入门助手」，帮助大一新生快速了解 AI+X 课程体系。从需求定义到 AI 生成原型，再到多轮迭代优化，完整展示了人机协作的流程。", techStack: ["HTML/CSS/JS", "AI Prompt Engineering", "DeepSeek"], demoUrl: "https://first-ai-assistant.vercel.app", githubRepo: "a976xw7td/first-ai-assistant", aiScore: 88, teacherScore: 90, isPublic: true, submittedAt: "2026-07-05" },
  { id: "pf-002", studentName: "赵六", studentId: "s04", challengeTitle: "提示词工程实战", challengeId: "c03", summary: "整理了 15 条常用的 AI 编程提示词，覆盖代码生成、代码审查、Bug 修复、文档编写等场景。正在进行效果对比测试。", techStack: ["Markdown", "Prompt Engineering"], githubRepo: "zhaoliu-dev/prompt-playbook", aiScore: 30, isPublic: false, submittedAt: "2026-07-04" },
  { id: "pf-003", studentName: "张浩", studentId: "s01", challengeTitle: "AI 结对编程入门", challengeId: "c02", summary: "通过 AI 结对编程完成了一个计算器应用，展示了完整的「你思考→AI 写代码→你审查→一起迭代」流程。代码审查记录是很好的学习材料。", techStack: ["Python", "AI 辅助编程", "Claude Code"], githubRepo: "a976xw7td/ai-pair-calc", aiScore: 92, teacherScore: 93, isPublic: true, submittedAt: "2026-07-03" },
  { id: "pf-004", studentName: "李四", studentId: "s02", challengeTitle: "构建你的第一个 AI 助手", challengeId: "c01", summary: "做了一个学习监督助手，能根据学习计划提醒和检查进度。功能设计贴近实际需求，正在补充 Demo 部署链接。", techStack: ["Next.js", "TailwindCSS", "TypeScript"], githubRepo: "lisi-dev/study-buddy", aiScore: 72, isPublic: false, submittedAt: "2026-07-06" },
];

export function getPortfolioByStudent(studentId: string): PortfolioItem[] {
  return portfolioItems.filter((p) => p.studentId === studentId);
}

// ============================================================
// 文档（对齐设计仓库实际文档）
// ============================================================

export const docSections: DocSection[] = [
  { id: "d1", title: "NSEAP 架构概述", category: "架构设计", lastUpdated: "2026-07-08", author: "架构组", content: "NSEAP 基于认知细胞（Cognitive Cell）架构，一切皆 Agent。系统由 4 个核心 Agent 组成（Student/Teacher Companion + Submission/Review Task Agent），通过 Message Envelope 通信，Trusted Relationship 管理权限，Audit Log 保证可追溯。" },
  { id: "d2", title: "Agent 协作流程", category: "Agent 设计", lastUpdated: "2026-07-08", author: "Agent 组", content: "Agent 之间有明确的协作流程：Teacher Companion 发布 Challenge → Student Companion 接收并引导学生完成 → Submission Task Agent 校验并写入提交记录 → Review Task Agent 按 Rubric 执行评审 → 结果通过飞书 Bot 通知学生和老师。" },
  { id: "d3", title: "Challenge 设计规范", category: "课程设计", lastUpdated: "2026-07-08", author: "挑战组", content: "每个 Challenge 都有明确的学习目标、交付物清单、评分标准（四维评估体系：拿来主义 20% + 有效反馈 20% + 多次迭代 30% + 可复用性 30%）。Challenge 分为三级：L1 入门（C01-C04）、L2 进阶（C05-C08）、L3 高级（C09-C10）。" },
  { id: "d4", title: "Agent Manifest Schema", category: "Agent 设计", lastUpdated: "2026-07-08", author: "Agent 组", content: "每个 Agent 必须通过 Manifest 声明其身份（agent_id/agent_type）、能力（capabilities）、接口（interfaces）、权限（permissions）、信任关系（trusted_agents）、通道绑定（channel_bindings）。启动时通过 Zod Schema 校验，不合格不允许启动。" },
  { id: "d5", title: "飞书多维表结构", category: "数据设计", lastUpdated: "2026-07-09", author: "平台组", content: "系统使用 7 张飞书多维表：Students（学生身份）、Challenges（任务定义）、Submissions（提交记录）、Evaluations（评审结果）、PortfolioItems（作品集）、AuditLogs（审计日志）、InboxQueue（消息队列）。每张表都有精确的字段定义和代码读取位置。" },
  { id: "d6", title: "四维评估体系", category: "评估标准", lastUpdated: "2026-07-08", author: "挑战组", content: "评估不是「打分」，而是「给反馈、促成长」。四维框架：拿来主义（借鉴已有方案）、有效反馈（获取外部意见）、多次迭代（持续改进）、可复用性（产出能共享）。每维度四级：未达标/通过/良好/优秀。" },
];

// ============================================================
// 知识库（对齐 knowledge-base/schemas 7 种类型）
// ============================================================

export const knowledgeItems: KnowledgeItem[] = [
  { id: "k1", title: "什么是 NSEAP？", type: "FAQ", tags: ["入门", "概念"], summary: "NSEAP 是一个 AI Native 教育平台，基于认知细胞架构和四 Agent 协作模型。学生通过完成 10 个渐进式 Challenge 来学习 AI 开发，所有提交和评审通过 Agent 自动流转。", lastUpdated: "2026-07-08" },
  { id: "k2", title: "Vibe Coding 入门指南", type: "教材", tags: ["Vibe Coding", "AI 编程", "Cursor"], summary: "Vibe Coding 是一种 AI 辅助编程方法论——你描述意图，AI 生成代码。核心原则：你是「指挥家」不是「打字员」，你的价值在思路和判断。", lastUpdated: "2026-07-08" },
  { id: "k3", title: "如何写好提示词", type: "Prompt", tags: ["Prompt Engineering", "最佳实践"], summary: "系统化的提示词设计指南：从角色设定 → 任务描述 → 输出格式 → 约束条件 → 示例（Few-shot）。包含 10+ 个经过验证的提示词模板。", lastUpdated: "2026-07-08" },
  { id: "k4", title: "Agent 间信任关系设计", type: "最佳实践", tags: ["Agent", "Trusted Relationship", "安全"], summary: "Agent 之间通过 Trusted Relationship 管理权限。关系类型分 companion/task-agent/peer 三种，信任级别分 auto/require-approval/denied 三级。每对关系需声明权限范围。", lastUpdated: "2026-07-08" },
  { id: "k5", title: "Multi-Agent 协作开发", type: "案例", tags: ["Agent", "协作", "工作流"], summary: "30 分钟视频教程，演示如何使用多个 AI Agent 协作完成一个完整的 Challenge 开发流程：Teacher Companion 发布任务 → Student Companion 引导开发 → Submission Task Agent 提交 → Review Task Agent 评审。", lastUpdated: "2026-07-08" },
  { id: "k6", title: "飞书 Bot 接入指南", type: "最佳实践", tags: ["飞书", "Bot", "通知"], summary: "Agent 对人的通知统一走飞书 Bot。设置步骤：创建飞书应用 → 获取 App ID/Secret → 配置消息卡片模板 → 测试通知链路。Agent 之间的消息走 Message Envelope 协议，不经过飞书。", lastUpdated: "2026-07-09" },
  { id: "k7", title: "TypeScript + React 开发规范", type: "参考资料", tags: ["TypeScript", "React", "代码规范"], summary: "项目统一的代码风格和开发规范：组件设计模式、状态管理、文件命名约定、Git 提交格式（Conventional Commits）、Zod Schema 使用规范。", lastUpdated: "2026-07-08" },
  { id: "k8", title: "Audit Log 设计笔记", type: "Agent笔记", tags: ["审计", "Agent", "合规"], summary: "AuditLog 必须记录每一次状态变更：谁（agent_id）、做了什么（action）、对哪个资源（target_resource）、变更前后的状态（before_state/after_state）。Red 线：无审计不写操作。", lastUpdated: "2026-07-08" },
];
