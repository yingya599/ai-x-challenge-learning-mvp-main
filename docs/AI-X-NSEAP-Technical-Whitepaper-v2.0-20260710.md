# AI+X / Elite20 / NSEAP 教育任务系统技术架构白皮书

版本：v2.1
日期：2026-07-10
整理人：张浩（James）
上一版：v1.0（2026-07-08）——本版取其精华重写，新增：实现状态标注、接口契约、红线合规矩阵、验收标准、偏差记录（ADR）
适用范围：Elite20 二期建设、NSEAP 教育领域 Showcase、AI+X Challenge 学习系统、Companion Agent / Task Agent 对接开发

**本版与 v1.0 的根本区别：v1.0 是愿景文档，v2.0 是开发基线。每个模块都标注实现状态（✅ 已实现并验证 / 🔶 部分实现或降级 / ❌ 未实现），后续开发严格按本文档的缺口清单推进。**

---

## 0. 结论先行

本系统是一个 Agent-native 的教育任务操作系统，不是交作业网页。核心链路：

```text
教师发布 Challenge → 学生完成真实项目 → GitHub 留作品证据 → AAR 留过程证据
→ AI/教师/同伴评审 → 反馈回流 → 作品集与能力画像沉淀
```

当前实现基线（代码仓库 `a976xw7td/ai-x-challenge-learning-mvp`，main 分支，commit `aaf6cc0`）：

- ✅ 三方合并完成：吴嘉宇前端壳 + MVP 真实后端 + Team3 Zod 校验层
- ✅ 提交全链路真实可跑：Envelope → 信任校验 → 幂等 → 身份/Challenge/GitHub 校验 → AI 初评 → 写飞书 → 全程审计
- ✅ 教师发布 Challenge 链路（API 层）
- ✅ 3 个 Agent Manifest 实例化并启动时强校验
- 🔶 前端半接线：提交/作品集/Challenge 列表走真实数据，教师控制台/Dashboard/详情页仍为 mock
- ❌ 登录认证、Ontology Memory、Hermes 消息总线、Peer Review 实际分配

---

## 1. 系统定位

### 1.1 一句话定义

围绕"真实项目挑战"运行的 AI 教育操作系统：管任务、管提交、管证据、管评审、管反馈、管作品集，并给 Agent 提供身份、权限、记忆和工具。

### 1.2 不是什么

- 不是传统 LMS（发作业-收文件-批改-结束）
- 不是单纯 WebApp（WebApp 只是 Companion Agent 到位前的兜底入口）
- 不是飞书表格管理器（飞书是 MVP 期运营数据库，未来迁移）

### 1.3 上游规范

本系统必须符合 Richard 7.6 三份指导文件：

| 文件 | 核心要求 |
|---|---|
| AGENT_CN.md / CLAUDE.md v0.3 | 十条架构红线（见 §9 合规矩阵） |
| Elite_Education_MVP_PRD v0.3 | 两大 User Story + 数据模型 + 验收标准 |
| Agent-inbox 补充稿 | Inbox 为 Agent 唯一入口、Trusted Relationship、Presence |

---

## 2. 总体架构

### 2.1 分层架构（标注实现状态）

```text
┌─ 用户层：学生 / 教师 / 助教 / 评委 ──────────────────────── ✅
├─ 前台入口层：WebApp（吴嘉宇壳，12 页面）─────────────────── ✅
│              Companion Agent 桌面端 ──────────────────────── ❌ P3
├─ NSEAP 平台层：登录认证 / 名单 / 权限 / Agent 注册 ───────── ❌ P2-P3
├─ Agent 层：身份 / Manifest / Trusted Relationship ─────────── ✅（进程内）
│            Hermes / OpenClaw 消息总线 ────────────────────── 🔶 降级（ADR-001）
├─ 工作流层：提交状态机 / 发布工作流 / 评审路由 ─────────────── ✅ / ✅ / 🔶 骨架
├─ Skill 层：飞书读写 / GitHub 检查 / DeepSeek 初评 ─────────── ✅
└─ 数据层：飞书 7 表 ✅ / GitHub ✅ / Ontology Memory ❌ / 本地 Workspace ❌
```

### 2.2 四空间同步模型

| 空间 | 职责 | 状态 |
|---|---|---|
| GitHub Repo | 作品证据、版本证据、README/AAR/代码 | ✅ 指针校验已接 |
| 飞书多维表 | 流程状态与轻量业务数据库（7 张表） | ✅ 真实读写 |
| 本地 Workspace | 学生创作与 Agent 执行上下文 | ❌ 待 Companion Agent |
| Ontology Memory | 语义状态、能力画像、长期记忆 | ❌ Team3 OWL 已有设计，未接运行时 |

---

## 3. Agent 架构

### 3.1 Agent 身份注册表（当前实现）

代码位置：`lib/server/agents.ts` + `agents/manifests/*.json`

| agent_id | 类型 | Manifest | 说明 |
|---|---|---|---|
| `student-companion-webapp-fallback` | student-companion | ✅ 已实例化 | WebApp 兜底模式的学生侧身份（白皮书 §7.4 第一阶段） |
| `teacher-companion-webapp-fallback` | teacher-companion | ❌ **缺 Manifest** | T5 引入，需补第 4 个 manifest |
| `submission-task-agent-001` | submission-task | ✅ 已实例化 | 提交中枢，admin_identity_mode=teacher_delegated |
| `review-task-agent-001` | review-task | ✅ 已实例化 | AI 初评执行器 |
| Peer Review Agent | peer-review | ❌ | P2 |

Manifest 在模块 import 时经 Zod `*ManifestSchema.parse()` 强校验，违反 RED-001/002 refine 规则会导致构建失败。

### 3.2 Trusted Relationship 图（Agent-inbox 补充稿落地）

```text
student-companion-webapp-fallback ──submission_request──▶ submission-task-agent-001
teacher-companion-webapp-fallback ──challenge_publish───▶ submission-task-agent-001
submission-task-agent-001 ─────────review_request───────▶ review-task-agent-001
```

- ✅ 静态关系图 + `isTrusted()` 入口校验（每个工作流第一步）
- ❌ 未实现：`expiration`/`last_verified` 运行时检查、Presence（ONLINE/OFFLINE 排队）、动态下发（未来由 NSEAP 平台管理）

### 3.3 消息协议

所有 Agent 间消息必须经 `buildEnvelope()` 构造并通过 `MessageEnvelopeSchema` 校验（P3394 兼容格式）：

```json
{
  "message_id": "msg-<uid>", "request_id": "req-<uid>",
  "from_agent": "...", "to_agent": "...",
  "message_type": "submission_request | challenge_publish | review_request | peer_review_request | ...",
  "timestamp": "ISO8601", "payload": {...},
  "audit_trace_pointer": "audit-<uid>"
}
```

**开发红线：禁止手拼消息对象，禁止无 from/to 的调用路径。**

### 3.4 审计模型

- 每次状态变更调用 `AuditTrail.log()`，经 `AuditLogSchema` 校验
- 失败路径同样留痕（`workflow_failed` + error_trace）
- API 响应携带完整 `auditTrail` 数组
- ❌ **缺口：审计只在响应/控制台，未持久化到飞书 AuditLogs 表（tbl31l2XhXDMOB7K，表已建）**

### 3.5 通知边界原则（主仓 agent-collaboration-flow.md 核心设计决策）

**Agent 对 Agent 用协议（Message Envelope + Inbox/Outbox），Agent 对人统一走飞书 Bot。**
触达到人的最后一公里（发布公告、评审完成私聊、待复核提醒、提交异常提醒）复用飞书 Bot / 卡片消息，不自建推送。当前状态：❌ 飞书 Bot 通知完全未实现（主仓将其列为 P0 项）。

### 3.6 Submission 状态机（主仓定义，与 Zod SubmissionStatus 枚举一一对应）

```text
draft → submitted → validating → ├─ needs_revision（校验失败，通知学生）
                                 └─ checked → pending_review → under_review
                                   → reviewed → pending_teacher_review
                                   → ├─ accepted（教师确认，manual_review_adjustment 消息）
                                     └─ needs_teacher_revision（教师打回）
```

当前实现只用到 checked / needs_revision 两态 🔶；教师复核段（pending_teacher_review 之后）完全缺失 ❌。

---

## 4. 核心工作流

### 4.1 学生提交（✅ 已实现，代码 `lib/server/workflow.ts`）

```text
1 构造 submission_request Envelope（学生侧身份）
2 Inbox 信任校验 isTrusted()
3 幂等检查（60s 窗口，仅防成功后重放，失败不占窗口）
4 必填项校验 → 学生身份校验 → Challenge 状态校验（published/active 才放行）
5 GitHub 指针校验（仓库/README/最近提交）
6 按 review_mode 路由（见 4.3）→ AI 初评（DeepSeek）
7 唯一写入 Submission Record（含 8 个 Agent 扩展字段，表缺列时降级并审计）
8 写 Evaluation + Portfolio 记录
9 全程审计，返回 auditTrail
```

### 4.2 教师发布 Challenge（✅ API 层已实现，代码 `lib/server/challenge-workflow.ts`）

```text
1 字段校验：缺 title/deadline/deliverables/rubric 逐项返回 missingFields（AGENT_CN §4.4）
2 构造 challenge_publish Envelope（教师侧身份）
3 信任校验 → 写飞书 Challenges 表（status=published）→ 审计
```

❌ 缺口：不生成飞书群公告、不同步 GitHub Challenge 文件、不更新 Ontology Memory（PRD §7.1 步骤 6-10）。

### 4.3 评审路由（🔶 骨架）

| review_mode | 当前行为 | 缺口 |
|---|---|---|
| teacher_only | ✅ AI 初评 + 写 Evaluation | 教师最终确认流缺失 |
| peer_only | 🔶 写 routing_status=routed_to_peer + 审计 | peer 实际分配待 P2 |
| teacher_and_peer | 🔶 routing_status=routed_to_both | 同上；教师优先级仲裁缺失 |

### 4.4 反馈回流（❌ 未实现）

PRD §7.2 步骤 14-17：评审结果回传 → 状态更新 → 通知学生。当前无通知机制（无飞书 Bot 推送）。

---

## 5. 数据模型

### 5.1 飞书 7 张表（app_id: cli_aacd97da8ea49be2）

| 表 | table_id | 状态 |
|---|---|---|
| Students | tblZNoZuykeoSLZL | ✅ 读 |
| Challenges | tbl63XxcXrFa1Wob | ✅ 读写 |
| Submissions | tblk0W13dUdeJCqr | ✅ 写（含 Agent 扩展字段） |
| Evaluations | tbljVBBaMPeJ7biJ | ✅ 写 |
| PortfolioItems | tblJQGf5W3og3gux | ✅ 读写 |
| AuditLogs | tbl31l2XhXDMOB7K | ❌ 表已建，代码未写入 |
| InboxQueue | tbllCuyN67TyCBcm | ❌ 表已建，代码未使用（P1-3 启用，字段设计见主仓 agents/inbox/README.md） |

### 5.2 Submission Record Agent 扩展字段（已写入）

`submitted_by_agent_id / processed_by_agent_id / admin_identity_mode / submission_request_id / audit_log_pointer / review_mode / routing_status / github_branch / github_commit`

⚠️ 已知问题：`github_commit` 当前写入的是最近提交时间戳而非 commit SHA（`github.ts` 待补抓 SHA）。

### 5.3 运行时校验层

`lib/schemas/zod-from-schemas.ts`（Team3 产出，**只读文件，不得修改**）：SubmissionRecord / ChallengeRecord / MessageEnvelope / AgentManifest / AuditLog / TrustedRelationship 等 28 个导出。所有新数据结构优先复用此文件；不够用时在调用处扩展。

---

## 6. WebApp 前端

### 6.1 页面清单与数据真实性（严格标注）

| 页面 | 路由 | 数据 |
|---|---|---|
| 提交流程 | /submit | ✅ Challenge 列表、GitHub 检查、提交全真实 |
| 作品集 | /portfolio | ✅ 真实（飞书 Portfolio 表），断链时回落 mock |
| Landing | / | ❌ 全 mock |
| Dashboard | /dashboard | ❌ 全 mock |
| LMS | /lms | ❌ 课程 mock |
| Challenge 详情 | /challenges/[id] | ❌ mock（与 /submit 的真实列表不同源，存在割裂） |
| 教师控制台 | /teacher | 🔶 发布表单真实（POST /api/challenges），列表 mock |
| 提交详情 | /submissions/[id] | ❌ mock |
| 个人中心/知识库/文档/GitHub 页 | — | ❌ 全 mock |

### 6.2 接线原则

`lib/api.ts` 客户端适配层：真实 API 优先，失败回落 mock，页面永不白屏。后续页面接线一律走此层，禁止页面直接 fetch。

---

## 7. API 契约（当前已实现）

| 接口 | 方法 | 说明 |
|---|---|---|
| /api/health | GET | 环境变量就绪检查 |
| /api/challenges | GET | 已发布 Challenge 列表 |
| /api/challenges | POST | 教师发布（缺字段返回 400 + missingFields） |
| /api/submit | POST | 学生提交（返回 auditTrail） |
| /api/github/check | POST | GitHub 仓库健康检查 |
| /api/portfolio | GET | 作品集列表 |
| /api/students | GET | 学生列表 |

响应格式统一：`{ ok: true, ...data }` / `{ ok: false, error, ... }`。

❌ 缺失接口：GET /api/submissions（列表+详情）、GET /api/evaluations、POST /api/evaluations（教师终评）、名单导入、登录。

---

## 8. 安全与权限

| 原则 | 状态 |
|---|---|
| 前端不暴露密钥（全部 env） | ✅ |
| 学生侧不能写最终 Submission Record | ✅ 唯一写入口 + Manifest refine 强制 |
| 所有状态变更有审计 | ✅（未持久化 ❌） |
| 学生只能看自己的提交 | ❌ 无登录，无行级权限 |
| 教师只看授权班级 | ❌ 同上 |
| Peer 只看被分配提交 | ❌ P2 |

**⚠️ 部署约束：在登录认证落地前，本系统不得开放公网长期使用（v1.0 §17.2 同样警告，仍然有效）。**

---

## 9. 红线合规矩阵（AGENT_CN §12 十条）

| # | 红线 | 状态 | 证据/缺口 |
|---|---|---|---|
| 1 | Agent 必须有身份 | ✅ | agents.ts 4 身份 + Envelope 强制 from/to |
| 2 | Agent 必须有通道 | 🔶 | channel_bindings=web；飞书 Bot ID 绑定缺失 |
| 3 | Agent 必须有 Manifest | 🔶 | 3/4 已实例化，teacher 兜底身份缺 |
| 4 | 权限边界 | ✅ | 唯一写入口 + RED-002 refine |
| 5 | 可审计 | 🔶 | 全程留痕 ✅，持久化到 AuditLogs 表 ❌ |
| 6 | 提交必经 Submission Task Agent | ✅ | workflow.ts 状态机 |
| 7 | 四空间同步 | 🔶 | GitHub+飞书 ✅，Workspace+Ontology ❌ |
| 8 | Hermes/OpenClaw 通信层 | 🔶 | ADR-001 显性降级（见 §11） |
| 9 | P3394-compatible | ✅ | 全 schema-first |
| 10 | Agent-native 而非表单 | 🔶 | 消息链已成型，Agent 仍为进程内角色 |

---

## 10. 路线图（开发按此执行）

### P0 已完成 ✅

演示闭环、三方合并、提交/发布双链路、Manifest、审计、幂等。

### P1 班级试运行（下一批开发，按优先级；已按主仓 MVP 落地顺序校准）

1. **飞书 Bot 通知**（主仓列为 P0）：提交成功/失败、评审完成私聊学生，待复核提醒教师——通知边界原则 §3.5
2. **审计持久化**：AuditTrail 写入飞书 AuditLogs 表（表已建，写入即可）
3. **InboxQueue 表模拟 Inbox**（主仓列为 P0）：消息先落 tbllCuyN67TyCBcm 再处理，按主仓 inbox/README 的 14 字段设计
4. **GET /api/submissions 列表+详情** → 教师控制台/Dashboard/提交详情页接真实数据（消除真假数据割裂）
5. **Challenge 详情页接真实数据**（与 /submit 同源）
6. **教师复核链路**：`manual_review_adjustment` 消息 + 完整状态机流转（reviewed→pending_teacher_review→accepted/needs_teacher_revision），对齐 §3.6
7. **github_commit 补抓真实 SHA**；补 teacher 兜底 Manifest
8. **简单登录/身份选择** + 学生名单导入

### P2 Agent-native 深化

Inbox 完整化（Presence/Offline Queue/Retry/签名验证）、Peer Review 实际分配、Presence、Trusted Relationship 动态化 + expiration 检查、Ontology Memory 接入（Team3 OWL/Fuseki）、GitHub Challenge 文件同步。

### P3 NSEAP 正式接入

平台统一登录、Agent 注册中心、Hermes/OpenClaw 消息路由替换进程内调用（Envelope 格式已兼容，仅换传输层）、Companion Agent 桌面端、多班级多角色。

---

## 11. 架构决策记录（ADR）

### ADR-001 Hermes/OpenClaw 降级（有效）

MVP 阶段 Agent 间通信以进程内函数调用模拟总线路由；Envelope 结构完全按 P3394 兼容格式构造并 Zod 强校验。P3 接入真实总线时只替换传输层，业务逻辑不变。**任何新工作流必须继续经 buildEnvelope + isTrusted，保持可替换性。**

### ADR-002 WebApp 兜底身份（有效）

Companion Agent 到位前，WebApp 以 `*-webapp-fallback` 身份代学生/教师发起请求（PRD §7.4 第一阶段授权）。Agent 字段照常落库，未来 Companion 接管时仅替换 from_agent。

### ADR-003 飞书字段降级（有效）

Agent 扩展列在表中缺失时，仅当错误为字段不存在（1254045/FieldNameNotFound）才降级为基础字段写入并记 `agent_fields_dropped` 审计；其他错误一律抛出防止重复写。

### ADR-004 幂等语义（有效）

幂等仅防"成功提交后的重放"（60s 内存窗口）；失败的提交立即释放幂等 key，不阻塞修正重试。多实例部署时需迁移 Redis。

---

## 12. 开发守则（所有 Coding Agent 必读）

1. 不得绕过 `submitChallengeProject` / `publishChallenge` 新增任何写记录路径
2. 每个新状态变更必须 `audit.log()`
3. 新消息一律 `buildEnvelope()`，新 Agent 交互先加 Trusted Relationship
4. 不修改 `lib/schemas/zod-from-schemas.ts`
5. 响应格式统一 `{ ok, ... }`
6. 页面取数一律经 `lib/api.ts`，保持 mock 兜底
7. 每项改动跑 `npx next build` + curl 实测后提交
8. 错误提示面向用户可理解，不裸抛技术异常
