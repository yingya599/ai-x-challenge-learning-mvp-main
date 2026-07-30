# NSEAP Learning Platform

AI+X Elite20 Builder Program 教学任务平台 —— **提交 → AI 初评 → 教师终审 → 通知** 的完整闭环框架。

平台定位是**纯框架**：课程内容（挑战定义、知识库、文档）全部外置在飞书多维表和 GitHub 内容仓库中。换一套飞书表 + 一个内容 JSON，就能承载另一门课，代码零改动。

## 核心功能

### 三种角色
| 角色 | 入口 | 能力 |
|---|---|---|
| 学生 | `/dashboard` | 浏览挑战、提交 GitHub 仓库、查看评分反馈、作品集、同伴评审 |
| 教师 | `/teacher` | 发布挑战（结构化交付物 + 评分维度）、查看全部提交、终审（accept/return） |
| 管理员 | 教师全部能力 | + 系统级配置 |

### 提交评分流水线（三层校验）
1. **GitHub 指针校验** —— 仓库存在性、可访问性、README、最新 commit（结果快照写入提交记录）
2. **交付物完整性检查** —— 挑战定义 `required_deliverables`（支持 `*通配符*`），缺件直接拦截返回，不消耗 AI 调用
3. **AI 初评** —— 读取 README 全文 + 文件列表 + commit 历史，按挑战的 `rubric_dimensions` 动态维度打分（内置 4 套挑战类型模板），产出分数 + 结构化反馈

之后按 `review_mode` 路由：教师终审 / 同伴评审（自动分配 N 人）/ 混合。全程飞书 Bot 通知学生和班级群。

### Agent 化架构
- **身份层**：每个操作主体都是 Agent（`student-companion-*` / `submission-task-agent-001` / `review-task-agent-001`），消息带 from/to Envelope（Zod 运行时校验）
- **架构红线**：学生侧永远不能直接写 Submission Record，唯一写入方是 Submission Task Agent
- **审计**：每次状态变更强制写 Audit Log（飞书表），API 响应携带完整 auditTrail
- **消息总线**：Agent 通道经 Redis Stream 异步处理（webapp 通道可同步降级）；外部 Agent 用 API Key 接入

### 内容外置
- 挑战定义：飞书 Challenges 表（标题 / 交付物 / rubric / 截止时间 / 状态）
- 知识库与文档：`/api/platform-content` 从 `PLATFORM_CONTENT_URL` 远程拉取（5 分钟缓存），支持 GitHub raw content

## 技术栈

Next.js 15 (App Router) · React 19 · TypeScript · 飞书多维表（数据层）· 飞书 Bot（通知）· Redis Stream（消息总线）· DeepSeek（AI 评分）

## 运行

```bash
npm install
cp .env.example .env.local   # 填入飞书 / GitHub / AI / Redis 凭证
docker-compose up -d          # Redis（可选，不起则 webapp 通道同步处理）
npm run dev
```

登录：学号/工号 + 姓名，与飞书 Students / Teachers / Admins 表匹配后按角色跳转。

## 部署形态

每个班级一套独立实例（独立飞书表 + 独立 Redis），不做多租户。

## 目录速览

```
app/(app)/          # 学生端 + 教师端页面
app/api/            # REST API（auth / challenges / submit / submissions / evaluations / agents / tasks ...）
lib/server/         # 服务端核心：workflow（提交状态机）/ ai（评分）/ feishu / rbac / redis-stream / notify
lib/schemas/        # Zod 运行时校验（Message Envelope / Submission Record / Audit Log）
```
