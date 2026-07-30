# AI+X / Elite20 / NSEAP 教育任务系统技术架构白皮书

版本：v3.2
日期：2026-07-12
整理人：张浩（James）
上一版：v3.1（2026-07-11）——本版为规范性澄清版：将"Agent 通道提交必须走 Redis"重述为传输层无关的总线强制约束（消除与 P3 换总线的字面冲突），并同步 P1b/P2 已交付事实
适用范围：Elite20 二期建设、NSEAP 教育领域 Showcase、AI+X Challenge 学习系统、Companion Agent / Task Agent 对接开发

**v3.2 变更清单（对照 v3.1）：**

| # | v3.1 问题 | v3.2 澄清/更新 |
|---|---|---|
| 澄清1 | §4.2/§8.2 字面写死"所有 Agent 通信扔 Redis Stream"，与 P3 换 Hermes/OpenClaw 总线字面冲突 | 新增 §5.0 总线强制约束（传输层无关）：约束对象是"必须经消息总线入队"，Redis 仅为当前实现；相关条文措辞统一 |
| 澄清2 | ADR-001 未明确"换传输层时强制约束是否随之失效" | ADR-001 增补：总线强制约束跨三阶段恒成立，任何阶段禁止 Agent 通道旁路直写 |
| 事实同步 | P1b/P2 交付后状态未回填 | Redis Stream、异步提交、限流、DLQ、Peer Review 分配+提交、Manifest 6/6 标记为 ✅ 已交付 |

**v3.1 修复清单（对照 v3.0 评审报告）：**

| # | v3.0 问题 | v3.1 修复 |
|---|---|---|
| 漏洞1 | Task 权威状态存 Redis（易失） | Task 权威状态落飞书，Redis 仅缓存/队列；队列改用 Redis Stream（§5.3） |
| 漏洞2 | Principal 自报身份，无认证绑定 | 服务端签发 token→Principal 映射，禁止客户端自报 role（§3.5） |
| 漏洞3 | Worker 常驻与 Vercel serverless 冲突 | 明确迁 Docker 常驻服务（ADR-009） |
| 漏洞4 | Redis+飞书双写无一致性方案 | Outbox 模式 + 补偿重试（ADR-008） |
| 矛盾1 | peer_only 在状态机中无路径 | 状态机增加 peer 分支（§4.2） |
| 矛盾2 | 新 Envelope 过不了旧 Zod 校验 | 新建 envelope-v2.schema.ts，不动 Team3 文件（§3.4） |
| 矛盾3 | A2A 7 态与主仓 11 态断裂 | 补双向映射表（§4.3） |
| 倒退1 | 飞书 Bot 通知边界消失 | 恢复为 §6.4，列入 P1a 最高优先级 |
| 倒退2 | require-approval 人工批准流消失 | Relationship 增加 approval 机制（§3.3） |
| 战略1 | P1 范围爆炸 | 拆分 P1a（班级可用）/ P1b（架构升级）（§12） |
| 战略2 | anonymous 10/小时误伤 | 改为 120/小时按 IP（§3.3） |

---

## 0. 结论先行

本系统是一个多 Agent 异步协作的教育任务操作系统。核心链路：

```text
学生(Hermes/WebApp) → Envelope → Redis Stream → handle_message → Task Pipeline
                                                    │
                                       submitted → validating → ai_reviewing
                                                    │
                                     ┌─ teacher_reviewing (WorkBuddy/教师)
                                     ├─ peer_reviewing (同伴)
                                     └─────────┬──────────┘
                                           completed
                                                    │
                        ← 飞书 Bot 通知人 / Redis 通知 Agent ←┘
```

**架构总原则（v3.1 确立，所有设计决策服从）：**

1. **飞书是唯一权威存储**（Task 状态、业务记录、审计）；Redis 只做队列、缓存、去重——Redis 全部数据丢失，系统必须能从飞书完整恢复。
2. **认证先于授权**：任何 Principal 必须来自服务端签发，客户端声明的身份一律不信。
3. **Agent 对 Agent 走消息，Agent 对人走飞书 Bot**（主仓通知边界原则，不可再丢）。
4. **先让班级跑起来（P1a），再做架构升级（P1b）**——v2.0 架构撑得住 100 人分散提交，架构升级不得阻塞试运行。

---

## 1. 系统定位

### 1.1 一句话定义

围绕"真实项目挑战"运行的多 Agent 异步教育操作系统：学生和教师各有 Companion Agent（Hermes/WorkBuddy），经消息总线与后端 Task Agent 协作；管任务、提交、证据、评审、反馈、作品集。

### 1.2 不是什么

- 不是传统 LMS；不是单纯 WebApp（WebApp 是三通道之一）
- 不是飞书表格管理器（飞书=权威数据库，Redis=易失基础设施）
- 不是同步阻塞系统（提交返回 task_id，后台异步处理）

### 1.3 设计标准融合

| 标准 | 取什么 | 不取什么 |
|---|---|---|
| IEEE P3394 | Service Principal 身份、Relationship 分级授权、Channel Adapter 通道归一 | 8 步 Adapter 全流程、5 分区 Session、Conformance Level |
| Google A2A | Task 状态机、Artifact、Push Notification、contextId | JSON-RPC 传输层、SSE 流式（P3）、Agent Card（用 Manifest） |
| Richard 7.6（上游，优先级最高） | 十条红线、Inbox 唯一入口、Trusted Relationship、11 态提交状态机、通知边界 | —（上游规范只能显性 deviation，不能静默偏离） |

---

## 2. 总体架构

### 2.1 分层架构

```text
┌─ 用户层：学生 / 教师 / 助教 / 评委
├─ 通道层：WebApp HTTP ✅ / Hermes CLI ❌P1b / WorkBuddy HTTP ❌P1b
├─ 认证层：登录 → 服务端签发 session → Principal 解析 ─────── ❌ P1a
├─ 消息总线层：Redis Stream（消费组+ACK+pending 重投） ────── ❌ P1b
├─ 统一入口层：handle_message（Principal→Relationship→路由） ─ ❌ P1b
├─ Task 工作流层：提交/发布/评审 Pipeline ────────────────── ✅（同步版）→ P1b 异步化
├─ Skill 层：飞书读写 / GitHub 检查 / DeepSeek 初评 ───────── ✅
├─ 数据层：飞书 7 表（权威） / Redis（队列+缓存，可全丢） ──── 🔶
└─ 审计层：AuditTrail → 飞书 AuditLogs（Outbox 补偿写） ───── ❌ P1a 最高优先级
```

### 2.2 四空间同步模型

| 空间 | 职责 | 状态 |
|---|---|---|
| GitHub Repo | 作品/版本证据 | ✅ |
| 飞书多维表 | **权威业务数据库 + Task 状态 + 审计**（7 张表） | ✅ 读写 |
| Redis | 队列/缓存/去重——**易失性基础设施，非数据空间** | ❌ P1b |
| Ontology Memory | 语义状态、能力画像 | ❌ P3 |

（v3.0 把 Redis 列为第四空间是错误分类——Redis 不承载需要同步的业务事实。四空间中的 Local Workspace 待 Companion 桌面端，P3。）

### 2.3 消息总线选型

Redis 承担实时消息（ADR-005），但 v3.1 明确三条纪律：

1. **用 Redis Stream 而非 List**：消费组 + ACK + pending 列表，worker 崩溃后消息可重投，不丢消息。
2. **消息处理的最后一步是把结果落飞书**，落库成功才 ACK；Redis 里的消息和 Task 缓存全部可丢——重启后从飞书 `task_state` 恢复。
3. 飞书 InboxQueue 表弃用（ADR-005），其原有两项职责的去向：离线排队 → Redis Stream pending；人工批准队列 → 飞书 PendingApprovals 视图（见 §3.3）。

---

## 3. Agent 架构（P3394 对齐）

### 3.1 Service Principal 三元组

```typescript
type ServicePrincipal = {
  person: string;   // "hermes-student-companion" | "zhanghao@elite20"
  org: string;      // "elite20" | "nseap"
  role: "student" | "teacher" | "agent" | "admin" | "system";
}
```

同一 person 不同 role 解析出不同 Principal → 匹配不同 Relationship → 不同权限。

### 3.2 Relationship 五级授权

```typescript
type Relationship = {
  from: ServicePrincipal;
  to: ServicePrincipal;
  type: "owner" | "administrator" | "peer" | "client" | "anonymous";
  capabilities: string[];
  allowed_channels: string[];
  rate_limit?: string;
  approval?: "auto" | "require-approval" | "denied";  // v3.1 恢复主仓机制
};
```

| 关系 | 谁 | 能干什么 | 频率限制 |
|---|---|---|---|
| owner | Task Agent 自身 | 完全控制 | 无 |
| administrator | WorkBuddy/教师 | 发布、终评、查所有提交 | 1000/小时 |
| peer | 同组学生 Agent | 同伴评审、查同组提交 | 500/小时 |
| client | Hermes/学生 | 提交、查自己数据 | 100/小时 |
| anonymous | 未认证 | 看公开 Challenge 列表 | **120/小时按 IP**（v3.0 的 10/小时连正常浏览都不够） |

限流执行点：`handle_message` 入口，计数器存 Redis `ratelimit:{principal}:{hour}`。

### 3.3 require-approval 机制（v3.1 恢复，对齐主仓 Inbox 设计）

`approval: "require-approval"` 的消息不直接执行：写入飞书 Submissions/Challenges 对应记录并置 `task_state=pending_approval`，飞书 Bot 通知管理员，管理员在飞书多维表视图中批准/拒绝后流程继续。**不新建表，用权威表的状态字段承载**（表已够用，避免复活 InboxQueue）。

### 3.4 消息协议 Envelope v2

```json
{
  "message_id": "msg-<uid>", "request_id": "req-<uid>",
  "from": { "person": "...", "org": "...", "role": "..." },
  "to":   { "person": "...", "org": "...", "role": "..." },
  "message_type": "submission_request | challenge_publish | review_request | manual_review_adjustment | ...",
  "context_id": "ctx-<uid>", "task_id": "task-<uid>",
  "timestamp": "ISO8601", "payload": {},
  "signature": "<服务端签发 token 的 HMAC，P1a 起必填>",
  "audit_trace_pointer": "audit-<uid>"
}
```

**实现纪律（解决 v3.0 矛盾 2）**：新建 `lib/schemas/envelope-v2.schema.ts` 定义上述结构（Zod）；**Team3 的 `zod-from-schemas.ts` 保持只读不动**。过渡期 `buildEnvelope()` 同时产出 v1 兼容字段（from_agent/to_agent 字符串 = `person`），保证旧校验路径不破。message_type 枚举在 v2 schema 中扩展 `manual_review_adjustment`、`task_query`。

### 3.5 认证与 Principal 绑定（v3.1 新增，修复漏洞 2）

**授权模型的地基。没有本节，五级 Relationship 毫无意义。**

```text
登录（P1a：学号+姓名匹配名单；P3：NSEAP 统一认证）
→ 服务端查 Students 表核对身份
→ 签发 session token（HttpOnly Cookie / Bearer），token 内含服务端确定的 Principal
→ 此后所有请求：服务端从 token 解析 Principal
→ 客户端消息体里的 from 字段仅作声明，必须与 token 解析结果一致，不一致直接拒绝并审计
```

三条铁律：
1. **role 永远由服务端根据名单/配置赋予**，客户端无法自报 admin/teacher；
2. Agent 通道（Hermes/WorkBuddy）使用预共享 API Key → 服务端映射到对应 agent Principal，Key 只在服务端环境变量；
3. Envelope 的 `signature` 字段 P1a 起必填：`HMAC(token_secret, message_id + timestamp)`，防转发伪造。

### 3.6 Agent 注册表

| Principal.person | role | Manifest | 状态 |
|---|---|---|---|
| student-companion-webapp-fallback | agent | ✅ | WebApp 兜底（保留） |
| teacher-companion-webapp-fallback | agent | ❌ 补 | WebApp 兜底（保留） |
| hermes-student-companion | agent | ❌ P1b | 学生端 Companion |
| workbuddy-teacher-companion | agent | ❌ P1b | 教师端 Companion |
| submission-task-agent-001 | system | ✅ | 唯一写入者（红线） |
| review-task-agent-001 | system | ✅ | AI 初评执行器 |

---

## 4. 核心工作流（A2A Task 化）

### 4.1 学生提交（异步链路，P1b 后形态）

```text
1  通道层收请求 → 认证层解析 Principal（§3.5）
2  构造 Envelope v2 → XADD 入 Redis Stream → 立即返回 task_id
3  worker 消费：匹配 Relationship（client）→ 创建 Task
4  写飞书 Submissions：task_state=submitted → validating（每次流转都先落飞书再 ACK）
5  校验身份/Challenge active/GitHub 指针 → 失败: task_state=rejected，飞书 Bot 通知学生原因
6  AI 初评（经 AI Queue）→ ai_reviewing → Artifact 挂 Evaluation
7  按 review_mode 路由（见 4.2）
8  终态 completed / returned_for_revision → 飞书 Bot 私聊学生结果
9  全程 AuditTrail → Outbox → 飞书 AuditLogs（ADR-008）
```

P1a 期间提交仍走 v2.0 同步链路（撑得住班级规模），仅补齐 task_state 落库与 Bot 通知，为 P1b 异步化铺底。

### 4.2 Task 状态机（v3.1 修复 peer 分支）

```text
                    ┌─ 校验失败 ──────────▶ REJECTED（终止，Bot 通知学生）
                    │
SUBMITTED → VALIDATING → AI_REVIEWING ─┬─ teacher_only ──▶ TEACHER_REVIEWING ─┐
                                       ├─ peer_only ─────▶ PEER_REVIEWING ────┼─▶ COMPLETED
                                       └─ teacher_and_peer ▶ 两者并行 ─────────┘      │
                                          （教师终评优先级最高，教师未终评不得 COMPLETED）│
                                                            TEACHER_REVIEWING ──▶ RETURNED_FOR_REVISION（打回，可重新提交进入新 Task，context_id 不变）
系统异常（AI 超时/飞书写失败重试耗尽）──▶ FAILED（运维介入，Bot 通知管理员）
```

### 4.3 A2A 8 态 ↔ 主仓 11 态映射表（v3.1 修复矛盾 3）

Task 状态是运行时视图；飞书 Submissions.status 继续使用主仓/Team3 Zod 的 11 态枚举（上游规范不动）。映射：

| A2A Task 状态 | 主仓 SubmissionStatus | 说明 |
|---|---|---|
| SUBMITTED | submitted | |
| VALIDATING | validating | |
| REJECTED | needs_revision | 校验失败，学生修正后重新提交 |
| AI_REVIEWING | checked → pending_review → under_review | AI 队列中=pending_review，调用中=under_review |
| PEER_REVIEWING | under_review | peer 是 under_review 的子场景，routing_status 区分 |
| TEACHER_REVIEWING | reviewed → pending_teacher_review | AI 完成=reviewed，等教师=pending_teacher_review |
| COMPLETED | accepted | |
| RETURNED_FOR_REVISION | needs_teacher_revision | |
| FAILED | （无对应，仅 task_state 字段记录） | 系统异常非业务状态 |

实现：Submissions 表加两列——`task_state`（A2A 态，运行时权威）+ 既有 `status`（11 态，上游合规）。两者由同一状态机函数原子更新。

### 4.4 教师发布 / 评审路由 / 反馈回流

发布：认证（administrator）→ 字段校验（缺项逐个返回）→ 写飞书 → **飞书 Bot 群公告** → Redis 通知各学生 Agent。
评审路由：见 4.2 状态机，`manual_review_adjustment` 消息承载教师终评（对齐主仓协议名）。
反馈回流：终态时双路通知——**人走飞书 Bot（私聊学生/教师），Agent 走 Redis**（§6.4 通知边界）。

---

## 5. 数据模型

### 5.1 飞书 7 张表（权威存储）

| 表 | 职责 | 状态 |
|---|---|---|
| Students | 名单（登录匹配依据） | ✅ 读 |
| Challenges | Challenge 记录 | ✅ 读写 |
| Submissions | 提交记录 + `task_state` + 11 态 `status` + Agent 扩展字段 | ✅ 写，P1a 加列 |
| Evaluations | AI 初评 + 教师终评（evaluator_type 区分） | ✅ 写 |
| PortfolioItems | 作品集 | ✅ 读写 |
| AuditLogs | 审计持久化（Outbox 目标） | ❌ P1a 最高优先级 |
| InboxQueue | **弃用**（ADR-005，职责去向见 §2.3） | — |

### 5.2 Redis 数据结构（易失，可全丢）

| Key | 用途 | TTL | 丢失后果 |
|---|---|---|---|
| `stream:inbox` | 消息队列（Stream，消费组+ACK） | ACK 后删 | 未 ACK 消息重投；已 ACK 的已落飞书 |
| `task:{id}` | Task 状态缓存（加速查询） | 24h | 回源飞书 task_state |
| `cache:student/challenge:{id}` | 读缓存 | 1h | 回源飞书 |
| `dedupe:{sid}:{cid}:{repo}` | 提交去重 | 60s | 60s 内可能重复提交，被飞书侧 request_id 查重兜底 |
| `ratelimit:{principal}:{hour}` | 限流计数 | 1h | 限流暂失，无业务影响 |
| `outbox:audit` | 审计补偿队列（Stream） | 刷库后删 | 见 ADR-008 |

**验收标准：`redis-cli FLUSHALL` 后系统功能完整可用（仅性能下降 + 进行中任务重投）。**

---

## 6. 通信架构

### 6.1 原则

所有 Agent 间通信：必须经消息总线入队 / 从总线消费（当前实现为 Redis Stream，见 §5.0）。没有谁直接调谁；后端 submission-task-agent 是唯一写飞书业务记录者。

#### §5.0 总线强制约束（v3.2 新增，传输层无关）

> **规范原文（对齐 AGENT_CN.md §8.2）：Companion Agent（Hermes/WorkBuddy 及一切以 agent 身份认证的通道）提交作业、提交评审等业务消息，必须构造 Envelope v2 并经消息总线入队，由 worker 消费处理；禁止 Agent 通道以 HTTP 同步方式旁路直写业务表。**

三点澄清：

1. **约束对象是"总线"，不是"Redis"。** Redis Stream 只是 P1b–P2 阶段的总线实现；P3 替换为 Hermes/OpenClaw 时，本约束原样成立，只换 XADD/XREADGROUP 对应的入队/消费原语（ADR-001）。因此"提交作业必须走 Redis"与 P3 规划**不冲突**——冲突的只是把 Redis 写死进规范措辞，本版予以修正。
2. **WebApp fallback 通道例外且不旁路。** 浏览器人类用户（student/teacher Principal）经 /api/submit 提交，属于 P3394 Channel Adapter 归一后的人类通道；其请求同样进入统一 handle_message 管线，不构成对总线约束的违反。
3. **实现落点。** submit/evaluations 路由在 Principal 解析后判定 role=agent 即强制入队（Redis 不可用时拒绝并给出指引，不做同步降级）——该行为是本约束的执行，而非对 Redis 的依赖承诺。

### 6.2 三通道归一

Hermes CLI / WorkBuddy HTTP / WebApp HTTP → 各自 Adapter → 统一 Envelope v2 → `handle_message`。通道不同，消息归一（P3394 Channel Adapter）。

### 6.3 消息可靠性

- 生产：XADD 持久化到 Stream（Redis 开 AOF everysec）
- 消费：消费组读取 → 处理 → **结果落飞书成功后才 XACK**
- 崩溃恢复：XAUTOCLAIM 认领超时 pending 消息重投（幂等由 request_id 保证）
- 毒消息：重投 3 次仍失败 → 移入 `stream:dead-letter` + Bot 告警管理员

### 6.4 通知边界（主仓核心决策，v3.1 恢复，不可再丢）

**Agent 对 Agent 走协议（Envelope/Stream），Agent 对人统一走飞书 Bot。**

| 事件 | 通知人（飞书 Bot） | 通知 Agent（Redis） |
|---|---|---|
| Challenge 发布 | 课程群公告 | challenge_available 消息 |
| 提交成功/校验失败 | 私聊学生 | status_update |
| AI 初评完成/待复核 | 私聊教师 | review_result |
| 终评完成/打回 | 私聊学生 | feedback |
| 系统异常/死信 | 私聊管理员 | — |

**关键理由：现阶段学生全部经 WebApp（无 Hermes），若通知只走 Agent 通道，等于没有通知。** 飞书 Bot 通知列入 P1a 第一位。

---

## 7. 百人并发策略

| 瓶颈 | 解法 | 阶段 |
|---|---|---|
| 同步阻塞 | Task 异步化（返回 task_id） | P1b |
| 飞书读频率 | Redis 缓存 Student/Challenge | P1b |
| DeepSeek 60 次/分限频 | AI Queue **max 4 并发**（留余量）+ 429 指数退避 + 降级 fallback 评语 | P1b |
| 去重单机 | Redis dedupe 多实例共享 | P1b |
| 飞书写频率 | Evaluation/Audit 批量攒写（Outbox） | P1a（audit）/P1b |

容量预估：P1a 同步架构支撑"100 人 30 分钟分散提交"（实测口径待压测确认）；10 人以上同时突发需 P1b 异步架构。**班级试运行按分散场景组织（错峰提交），不被 P1b 阻塞。**

---

## 8. WebApp 前端

| 页面 | 现状 | 目标（阶段） |
|---|---|---|
| /submit、/portfolio | ✅ 真实 | 维持 |
| /teacher | 🔶 发布真/列表 mock | P1a 全真 |
| /challenges/[id] | ❌ mock（与 /submit 不同源） | P1a 同源真实 |
| /submissions/[id] | ❌ mock | P1a 真实 + Task 时间线 |
| /dashboard、/lms、/profile | ❌ mock | P1b 真实 |
| / (Landing) | 静态页 | 维持静态（营销页无"真实数据"概念） |

接线原则不变：一律经 `lib/api.ts`，mock 兜底，禁止页面直接 fetch。

---

## 9. API 契约

| 接口 | 方法 | 说明 | 阶段 |
|---|---|---|---|
| /api/health | GET | 就绪检查（P1b 增加 Redis 探活） | ✅ |
| /api/challenges | GET/POST | 列表 / 教师发布 | ✅ |
| /api/submit | POST | P1a：同步返回结果+task_state；P1b：返回 task_id 异步 | 🔶 |
| /api/github/check | POST | 仓库检查 | ✅ |
| /api/portfolio、/api/students | GET | 列表 | ✅ |
| /api/auth/login | POST | 学号+姓名 → 名单匹配 → 签发 session | ❌ P1a |
| /api/submissions | GET | 列表+详情（按 Principal 过滤：学生只见自己） | ❌ P1a |
| /api/evaluations | POST | 教师终评（manual_review_adjustment） | ❌ P1a |
| /api/tasks/:id | GET | Task 状态查询（Redis 缓存→飞书回源） | ❌ P1b |

---

## 10. 安全与权限

| 原则 | 状态 |
|---|---|
| 前端不暴露密钥 | ✅ |
| 学生不能写 Submission Record | ✅ 唯一写入口 + Relationship |
| **认证先于授权**：Principal 服务端签发，role 不可自报 | ❌ P1a（§3.5，本版最高安全优先级） |
| 状态变更全审计 + 持久化 | ❌ P1a（ADR-008） |
| 行级权限：学生只见自己/教师见授权班级 | ❌ P1a（随登录落地） |
| Peer 只见被分配提交 | ❌ P2 |
| 消息防伪造（signature） | ❌ P1a |

**部署约束：P1a 的登录+行级权限落地前，系统不得开放公网长期使用。**

---

## 11. 红线合规矩阵

| # | 红线（Richard AGENT_CN §12） | 状态 | 说明 |
|---|---|---|---|
| 1 | Agent 有身份 | ✅→加强 | Principal 三元组 + 服务端签发（P1a） |
| 2 | Agent 有通道 | 🔶 | 三通道 Adapter；飞书 Bot 绑定 P1a |
| 3 | Agent 有 Manifest | 🔶 4/6 | 补 teacher-fallback（P1a）、Hermes/WorkBuddy（P1b） |
| 4 | 权限边界 | ✅→加强 | 五级 Relationship + 行级过滤（P1a） |
| 5 | 可审计 | 🔶→✅ | Outbox 持久化（P1a） |
| 6 | 提交必经 Submission Task Agent | ✅ | 不变 |
| 7 | 四空间同步 | 🔶 | GitHub+飞书 ✅；Workspace/Ontology P3 |
| 8 | Hermes/OpenClaw 通信层 | 🔶 | ADR-001：Redis 过渡（P1b）→ 真总线（P3），Envelope 不变 |
| 9 | P3394-compatible | ✅ | Principal/Relationship/Envelope v2 |
| 10 | Agent-native | 🔶→✅ | P1b 异步消息链成型 |
| 上游 | 11 态提交状态机 | ✅ | §4.3 映射表，飞书 status 列不偏离 |
| 上游 | 通知边界（Bot 对人） | ✅ | §6.4 恢复 |

---

## 12. 路线图（v3.1 拆分 P1）

### P0 已完成 ✅

三方合并、提交/发布双链路、Manifest×3、Envelope+信任校验、审计（响应级）、幂等。

### P1a 班级可用（先行，目标一~两周，不引入 Redis）

1. **飞书 Bot 通知**：提交成功/失败私聊学生、待复核私聊教师、发布群公告（§6.4）
2. **审计持久化**：Outbox 攒批写 AuditLogs 表（ADR-008；P1a 期 Outbox 用进程内队列+重试即可）
3. **登录 + 行级权限**：/api/auth/login 名单匹配签发 session → Principal；/api/submissions 按身份过滤（§3.5）
4. **GET /api/submissions + 教师控制台/提交详情/Challenge 详情接真数据**（消除真假割裂）
5. **教师终评**：POST /api/evaluations（manual_review_adjustment）+ 状态机流转 + task_state/status 双列落库（§4.3）
6. 补遗：github_commit 抓真实 SHA、teacher-fallback Manifest、Envelope signature
7. **验收：一个真实小班（≤30 人，错峰提交）完整走通 发布→提交→AI 初评→教师终评→通知回流，全程审计可查**

### P1b 架构升级（P1a 验收后启动）

8. **部署迁移**：Vercel → Docker 常驻服务（ADR-009，吴嘉宇 Dockerfile 为基）+ Redis（AOF everysec）
9. Redis Stream 消息队列 + handle_message 统一入口 + worker 消费组
10. /api/submit 异步化（返回 task_id）+ /api/tasks/:id + 前端 Task 时间线
11. Service Principal/Relationship 全量替换 isTrusted()（envelope-v2 schema）
12. 缓存层 + AI Queue（max 4 + 退避）+ Redis 去重替换内存 Map
13. **验收：FLUSHALL 恢复测试通过；50 人同时提交压测通过**

### P2 Agent-native 深化（v3.2 状态回填）

- ✅ 已交付：Hermes/WorkBuddy Manifest 接入（6/6）、Peer Review 实际分配 + 提交 API + Web 评审出口（仪表盘"待我评审"+ 提交详情页表单）、require-approval 流、限流（按角色）、死信队列
- ⏳ 未交付：Presence、Ontology Memory（Team3 OWL/Fuseki）

### P3 NSEAP 正式接入

Hermes/OpenClaw 总线替换 Redis（只换传输层）、Companion 桌面端、平台统一登录、Agent 注册中心、多班级多角色。

---

## 13. 架构决策记录（ADR）

### ADR-001 消息总线渐进替换（v3.2 增补）
进程内调用（P1a）→ Redis Stream（P1b，✅ 已交付）→ Hermes/OpenClaw（P3）。Envelope 格式三阶段不变，只换传输层。
**v3.2 增补：§5.0 总线强制约束跨三阶段恒成立——任何阶段 Agent 通道不得旁路直写业务表；换传输层改变的是入队/消费原语，不改变约束本身。**

### ADR-002 三通道并存（更新）
WebApp fallback 身份保留为兜底通道；Hermes（学生）/WorkBuddy（教师）P1b 起为正式 Companion 通道。

### ADR-003 飞书字段降级（不变）
仅 FieldNameNotFound 类错误降级基础字段写入并审计 `agent_fields_dropped`；其余错误抛出。

### ADR-004 幂等（更新）
P1a：内存 60s 窗口（失败即释放）+ 飞书 request_id 查重兜底；P1b：迁 Redis 多实例共享。

### ADR-005 Redis 替代 InboxQueue 表（更新）
职责交接明确：实时排队 → Redis Stream；离线消息 → Stream pending + XAUTOCLAIM；人工批准 → 权威表 pending_approval 状态 + Bot 通知（§3.3）；历史审计 → AuditLogs 表。

### ADR-006 Task 状态机（更新）
A2A 8 态为运行时视图，**权威状态落飞书 Submissions.task_state 列**；与主仓 11 态 status 列并存，映射见 §4.3。Redis task:{id} 仅为查询缓存。

### ADR-007 Principal + Relationship（更新）
采用 P3394 三元组与五级关系，**前提是 §3.5 认证绑定**：无服务端签发即无 Principal。恢复 require-approval（主仓 Inbox 要求）。

### ADR-008 双写一致性：Outbox 模式（新增）
业务写飞书（权威）成功 = 事务成功；审计与通知进 Outbox 队列异步刷飞书，失败指数退避重试 ≥3 次，仍失败入死信 + Bot 告警管理员。**禁止**业务写与审计写捆绑为同步双写（任一失败会导致状态不一致或重复写入）。

### ADR-009 部署形态：Vercel → Docker 常驻（新增）
P1b 的 Redis worker 需要常驻进程，与 Vercel serverless 不兼容。决策：P1a 可继续 Vercel/本机；P1b 起整体迁 Docker（Next.js standalone + Redis 同 compose，吴嘉宇 PR#5 已含 Dockerfile/docker-compose 基础）。替代方案 Upstash QStash（保持 serverless）评估后放弃：改造 handle_message 语义成本更高。

---

## 14. 暂不覆盖（显性声明）

监控告警体系（P1b 仅 Bot 告警死信）、自动化测试策略（当前 curl 冒烟）、Redis 哨兵/集群（单实例+AOF 起步）、多租户、申诉流程、v2→v3 历史数据迁移（现库数据量小，加列即可无需迁移脚本）。

---

## 15. 开发守则（所有 Coding Agent 必读）

1. 不得绕过 `submitChallengeProject` / `publishChallenge` 新增写记录路径
2. 每个新状态变更必须 `audit.log()`（终态前必经 Outbox 落库）
3. 新消息一律 `buildEnvelope()`；新 Agent 交互先注册 Relationship
4. 不修改 `lib/schemas/zod-from-schemas.ts`；Envelope v2 用新文件 `envelope-v2.schema.ts`
5. 响应格式统一 `{ ok, ... }`；页面取数一律经 `lib/api.ts`（mock 兜底）
6. **飞书是权威：任何状态先落飞书再 ACK/返回；Redis 数据必须可全丢**
7. **Principal 只信服务端解析结果，永不信客户端声明的 role**
8. **通知人走飞书 Bot，通知 Agent 走消息**——不得只做一半
9. 每项改动 `npx next build` + curl 实测后提交；错误提示面向用户可理解

---

*本白皮书 v3.1 是 NSEAP 教育任务系统的架构基线。后续所有开发、Code Review、架构评审均以此为准；v3.0 作废。*
