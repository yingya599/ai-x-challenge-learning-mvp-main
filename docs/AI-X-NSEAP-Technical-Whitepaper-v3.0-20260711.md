# AI+X / Elite20 / NSEAP 教育任务系统技术架构白皮书

版本：v3.0
日期：2026-07-11
整理人：张浩（James）
上一版：v2.0（2026-07-10）——本版在其基础上，融合 IEEE P3394 身份/权限模型、Google A2A Task 状态机、Redis 消息总线，并补齐百人并发策略
适用范围：Elite20 二期建设、NSEAP 教育领域 Showcase、AI+X Challenge 学习系统、Companion Agent / Task Agent 对接开发

**本版与 v2.0 的根本区别：v2.0 是单 Agent + 同步流程的开发基线；v3.0 是多 Agent 异步协作的架构蓝图——引入 Service Principal 身份三元组、Relationship 五级授权、A2A Task 状态机、Redis 消息队列，并明确 Hermes（学生端）+ WorkBuddy（教师端）双 Companion 接入方案。**

---

## 0. 结论先行

本系统是一个多 Agent 异步协作的教育任务操作系统。核心链路：

```text
学生(Hermes) → 发消息 → Redis 消息队列 → handle_message → Task Pipeline
                                                      │
                                         submitted → validating
                                                      │
                                          ai_reviewing (DeepSeek)
                                                      │
                                          teacher_reviewing (WorkBuddy)
                                                      │
                                                   completed
                                                      │
                          ← 推送通知(student/teacher) ←┘
```

**当前实现基线（v2.0）→ v3.0 目标：**

| 维度 | v2.0 现状 | v3.0 目标 |
|---|---|---|
| Agent 身份 | agent_id 字符串 | Service Principal 三元组 `{person, org, role}` |
| 权限模型 | `isTrusted()` true/false | Relationship 五级 `owner/admin/peer/client/anonymous` |
| 通信方式 | 进程内函数调用 | Redis 消息队列 + 统一入口 `handle_message` |
| 任务追踪 | 同步一次性返回 | A2A Task 状态机（7 种状态，可查进度） |
| 消息总线 | 飞书 InboxQueue 表（未启用） | Redis（实时消息）+ 飞书 AuditLogs（历史审计） |
| 通知机制 | 无 | Push Notification（消息队列推送） |
| 双 Companion | WebApp fallback 替身 | Hermes（学生端）+ WorkBuddy（教师端）+ WebApp 三通道 |
| 百人并发 | ❌ 不支持 | 异步 Task + 缓存 + AI 队列 + Redis 去重 |

---

## 1. 系统定位

### 1.1 一句话定义

围绕"真实项目挑战"运行的多 Agent 异步教育操作系统：学生和教师各有一个 AI 助手（Companion Agent），通过 Redis 消息总线与后端 Task Agent 协作；管任务、管提交、管证据、管评审、管反馈、管作品集。

### 1.2 不是什么

- 不是传统 LMS（发作业-收文件-批改-结束）
- 不是单纯 WebApp（WebApp 只是多通道之一）
- 不是飞书表格管理器（飞书是永久数据库，Redis 是实时消息总线）
- 不是同步阻塞系统（提交立刻返回任务号，后台异步处理）

### 1.3 设计标准融合

本架构从两个国际标准中各取所长：

| 标准 | 全称 | 取什么 | 不取什么 |
|---|---|---|---|
| **IEEE P3394** | Standard for LLM Agent Interface | Service Principal 身份模型、Relationship 五级授权、Channel/Adapter 通道抽象、umf 统一入口 | 8 步 Adapter 全流程（过重）、5 分区 Session（过重）、Conformance Level（内部分级即可） |
| **Google A2A** | Agent2Agent Protocol | Task 状态机、Artifact 产出物、Push Notification 推送、contextId 任务分组 | JSON-RPC 传输层（用 Redis 替代）、SSE 流式（P3）、Agent Card（用 Manifest 替代） |

---

## 2. 总体架构

### 2.1 分层架构

```text
┌─ 用户层：学生 / 教师 / 助教 / 评委 ──────────────────────── ✅
├─ 通道层：Hermes CLI / WorkBuddy HTTP / WebApp HTTP ───── 🔶 P1-P2
│         │                  │                │
│         └──────────────────┼────────────────┘
│                            │
├─ 消息总线层：Redis 消息队列 ─────────────────────────────── ❌ P1（替代飞书 InboxQueue）
│                            │
├─ 统一入口层：handle_message ────────────────────────────── 🔶 重构中
│              ├─ ❶ 解析 Service Principal（P3394）
│              ├─ ❷ 匹配 Relationship（P3394）
│              └─ ❸ 路由到 Task Pipeline（A2A）
│                            │
├─ Task 工作流层：提交 Pipeline / 发布 Pipeline / 评审 Pipeline ─ ✅→🔶 重构
├─ Skill 层：飞书读写 / GitHub 检查 / DeepSeek 初评 ─────────── ✅
├─ 数据层：飞书 7 表（永久存储） / Redis（实时状态+缓存+去重） ── 🔶 重构
└─ 审计层：AuditTrail → 飞书 AuditLogs 表 ──────────────────── 🔶 P1
```

### 2.2 四空间同步模型

| 空间 | 职责 | 状态 |
|---|---|---|
| GitHub Repo | 作品证据、版本证据、README/AAR/代码 | ✅ 指针校验已接 |
| 飞书多维表 | 永久业务数据库（7 张表）+ 审计日志 | ✅ 真实读写 |
| Redis | 实时消息队列 + Task 状态缓存 + 去重缓存 | ❌ P1 引入 |
| Ontology Memory | 语义状态、能力画像、长期记忆 | ❌ P3 |

### 2.3 消息总线：飞书 InboxQueue → Redis

| | v2.0 飞书 InboxQueue（未启用） | v3.0 Redis |
|---|---|---|
| 速度 | API 调用，0.2 秒/次 | 内存读写，微秒级 |
| 堆积处理 | 表有 50 万行上限，查询慢 | 无堆积问题，处理完就删 |
| 并发 | 飞书 API 频率限制 | 万级并发 |
| 离线消息 | ✅ 天然支持（消息在表里等你上线） | ⚠️ 需额外持久化队列 |
| 用途 | 历史审计归档（AuditLogs） | 实时消息传递 |

**策略：Redis 管实时消息（处理完即删），飞书 AuditLogs 管历史审计（永久保存）。**

---

## 3. Agent 架构（融合 P3394）

### 3.1 Agent 身份：从字符串 → Service Principal 三元组

**v2.0：**
```typescript
"student-companion-webapp-fallback"  // 只是一个 agent_id 字符串
```

**v3.0：**
```typescript
type ServicePrincipal = {
  person: string;   // "hermes-student-companion" | "zhanghao@elite20"
  org: string;      // "elite20" | "nseap"
  role: string;     // "student" | "teacher" | "agent" | "admin" | "system"
}
```

**实际效果：**

| Principal | 说明 |
|---|---|
| `{person:"hermes", org:"nseap", role:"agent"}` | Hermes 代学生发言 |
| `{person:"workbuddy", org:"nseap", role:"agent"}` | WorkBuddy 代教师发言 |
| `{person:"zhanghao", org:"elite20", role:"student"}` | 张浩以学生身份操作 |
| `{person:"zhanghao", org:"elite20", role:"admin"}` | 张浩以管理员身份操作 |
| `{person:"submission-task-agent-001", org:"nseap", role:"system"}` | 后端唯一写入者 |

**同一个人（person），不同角色（role），解析出不同的 Principal → 匹配不同的 Relationship → 获得不同的权限。**

### 3.2 授权模型：从 isTrusted() → Relationship 五级

**v2.0：**
```typescript
isTrusted(from, to) → true/false  // 只能判断"信不信任"
```

**v3.0（P3394 五级关系）：**

```typescript
type RelationshipType = "owner" | "administrator" | "peer" | "client" | "anonymous";

type Relationship = {
  from: ServicePrincipal;
  to: ServicePrincipal;
  type: RelationshipType;
  capabilities: string[];       // 能调哪些能力
  allowed_channels: string[];   // 能从哪些通道进来
  rate_limit?: string;          // 频率限制
};
```

**五级关系定义：**

| 关系 | 谁 | 能干什么 | 频率限制 |
|---|---|---|---|
| owner | Task Agent 自身 | 完全控制 | 无限制 |
| administrator | 教师 Agent（WorkBuddy） | 发布 Challenge、终评、查所有提交 | 1000/小时 |
| peer | 同组学生 Agent | 同伴评审、查同组提交 | 500/小时 |
| client | 学生 Agent（Hermes） | 提交、查自己作品集、查 Challenge | 100/小时 |
| anonymous | 未认证 | 看公开 Challenge 列表 | 10/小时 |

### 3.3 Trusted Relationship 图

```text
hermes-student-companion ──client──▶ submission-task-agent-001
workbuddy-teacher-companion ──administrator──▶ submission-task-agent-001
submission-task-agent-001 ──owner──▶ review-task-agent-001
peer-review-agent ──peer──▶ review-task-agent-001
```

### 3.4 消息协议（Envelope，P3394 UMF 对齐）

```json
{
  "message_id": "msg-<uid>",
  "request_id": "req-<uid>",
  "from": {
    "person": "hermes-student-companion",
    "org": "nseap",
    "role": "agent"
  },
  "to": {
    "person": "submission-task-agent-001",
    "org": "nseap",
    "role": "system"
  },
  "message_type": "submission_request | challenge_publish | review_request | teacher_review | ...",
  "context_id": "ctx-<uid>",
  "task_id": "task-<uid>",
  "timestamp": "ISO8601",
  "payload": { },
  "audit_trace_pointer": "audit-<uid>"
}
```

**开发红线：禁止手拼消息对象。禁止无 from/to 的调用路径。禁止绕过 handle_message 直接调 Task Pipeline。**

---

## 4. 核心工作流（融合 A2A Task 状态机）

### 4.1 学生提交流程（A2A Task 化）

**v3.0 完整链路（异步）：**

```text
1. Hermes 构造 Envelope → 扔入 Redis 消息队列
2. Hermes 告诉学生："已提交，任务号 task-001，稍后通知你"
3. handle_message 从 Redis 取消息
4. 解析 Principal → 匹配 Relationship → client ✅
5. 创建 Task #task-001, state = submitted
6. 校验学生身份/Challenge 状态/GitHub → state = validating
7. AI 初评（DeepSeek）→ state = ai_reviewing
   结果挂为 Artifact: {score: 85, feedback: "项目结构清晰"}
8. 路由教师终评 → state = teacher_reviewing
9. 推送通知到 Redis → WorkBuddy 收到："task-001 待审"
10. WorkBuddy 通知老师 → 老师终评 → 结果写回 Redis
11. handle_message 收到终评 → state = completed
    挂 Artifact: {teacher_score: 90, feedback: "做得很好"}
12. 推送通知到 Redis → Hermes 收到 → 告诉学生
```

**Task 状态机：**

```text
                       ┌─ 校验失败 → REJECTED（终止）
                       │
SUBMITTED ──→ VALIDATING ──→ AI_REVIEWING ──→ TEACHER_REVIEWING
  已接收          校验中         AI 批改中           等待教师终评
                                           │
                             ┌─────────────┼─────────────┐
                             │             │             │
                        COMPLETED    RETURNED_FOR     FAILED
                          完成         _REVISION       失败
                                      打回修改
```

**Task 数据结构：**

```typescript
type Task = {
  task_id: string;
  context_id: string;          // 同一 Challenge 的所有提交共用
  state: TaskState;
  artifacts: Artifact[];       // AI 初评结果、教师终评结果
  history: TaskEvent[];        // 每次状态变更
  created_by: ServicePrincipal;
  assigned_to?: ServicePrincipal;
};
```

### 4.2 教师发布 Challenge

```text
1. WorkBuddy 构造 Envelope → 扔入 Redis
2. handle_message → 解析 Principal → administrator ✅
3. 字段校验 → 缺字段逐项返回
4. 写飞书 Challenges 表
5. 推送通知到 Redis → 所有学生 Agent 收到
```

### 4.3 评审路由

| review_mode | 行为 |
|---|---|
| teacher_only | AI 初评 → teacher_reviewing → WorkBuddy 终评 → completed |
| peer_only | AI 初评 → 分配给同组学生 Agent → peer review → completed |
| teacher_and_peer | AI 初评 → 同时路由教师和同伴 → 教师终评优先级最高 |

### 4.4 反馈回流

```text
Task 推进到 completed/rejected 时：
→ 写推送通知到 Redis
→ Hermes/WorkBuddy 各自收到通知
→ Hermes 告诉学生最终结果
→ WorkBuddy 告诉老师已完成
```

---

## 5. 数据模型

### 5.1 飞书 7 张表（永久存储）

| 表 | 职责 | 状态 |
|---|---|---|
| Students | 学生名单 | ✅ 读 |
| Challenges | 已发布 Challenge | ✅ 读写 |
| Submissions | 提交记录（含 Agent 扩展字段） | ✅ 写 |
| Evaluations | AI 初评 + 教师终评 | ✅ 写 |
| PortfolioItems | 作品集 | ✅ 读写 |
| AuditLogs | **审计日志持久化** | ❌→🔶 P1 最高优先级 |
| InboxQueue | v2.0 设计为消息队列表；v3.0 **弃用**，改为 Redis | ❌ 弃用 |

### 5.2 Redis 数据结构（实时状态）

| Key 模式 | 用途 | TTL |
|---|---|---|
| `task:{task_id}` | Task 当前状态+Artifacts | 任务完成后 24h |
| `inbox:{principal_id}` | 消息队列（每人的收件箱） | 处理完即删 |
| `cache:student:{id}` | 学生信息缓存 | 1 小时 |
| `cache:challenge:{id}` | Challenge 信息缓存 | 1 小时 |
| `dedupe:{studentId}:{challengeId}:{repo}` | 去重标记 | 60 秒 |

### 5.3 数据流向

```
实时消息：Redis 队列（处理完就删，不堆积）
  ↓ 完成/失败后
永久记录：飞书 Submissions/Evaluations/AuditLogs（归档保存）
```

---

## 6. 通信架构

### 6.1 通信方式

**所有人只做两件事：往 Redis 队列扔消息、从 Redis 队列取消息。**

没有谁直接调谁。后端是唯一能写飞书记录的。Hermes 和 WorkBuddy 都只能发消息请求它干。

### 6.2 三种角色通信流

```
学生提交流程：
  Hermes ──扔消息──▶ Redis ──取消息──▶ handle_message
                                          │
                                    Task Pipeline
                                          │
  WorkBuddy ◀──推送── Redis ◀── 完成/通知 ─┘

教师发布流程：
  WorkBuddy ──扔消息──▶ Redis ──取消息──▶ handle_message
                                              │
                                        飞书 Challenges 表
                                              │
  Hermes ◀──推送── Redis ◀──────────── 通知 ─┘
```

### 6.3 消息格式（Envelope，统一不变）

不管从 Hermes CLI、WorkBuddy HTTP、还是 WebApp 进来，都先洗成统一的 Envelope 格式，再进 handle_message。这是 P3394 Channel Adapter 思想的核心——**通道不同，消息归一。**

---

## 7. 百人并发策略

### 7.1 压力分析

100 个学生同时提交：每 18 秒一个（分散）或 10 人同时（突发）。

| 瓶颈 | 问题 | 解法 |
|---|---|---|
| 同步阻塞 | 每人等 5 秒，队列堆积 | **Task 异步化**：提交立刻返回 task_id |
| 飞书 API 频率 | 每次提交查 5-6 次飞书 | **Redis 缓存**：Student/Challenge 信息缓存 |
| AI 调用排队 | DeepSeek 限频 60 次/分钟 | **AI Queue**：控制并发数，排队处理 |
| 去重单机 | 多实例部署不共享 | **Redis 去重**：所有实例共享 |
| 飞书写入 | 高频写入被限流 | **批量写**：Evaluation 攒批写入 |

### 7.2 并发架构

```text
Redis Queue ──▶ Worker 1 ──▶ AI Queue (max 5 并发) ──▶ DeepSeek
            ├──▶ Worker 2 ──┤
            └──▶ Worker 3 ──┘
                    │
                    ▼
              飞书写入队列 (max 10 并发) ──▶ 飞书 API
```

### 7.3 容量预估

| 场景 | v2.0 | v3.0 |
|---|---|---|
| 10 人同时提交 | ✅ 勉强 | ✅ 无压力 |
| 50 人同时提交 | ❌ 超时 | ✅ 排队处理 |
| 100 人同时提交 | ❌ 必崩 | ✅ 排队处理 |
| 100 人 30 分钟分散 | ⚠️ 偶发超时 | ✅ 无压力 |

---

## 8. WebApp 前端

### 8.1 页面清单与数据真实性

| 页面 | 路由 | v2.0 状态 | v3.0 目标 |
|---|---|---|---|
| 提交流程 | /submit | ✅ 真实 | ✅ |
| 作品集 | /portfolio | ✅ 真实 | ✅ |
| Landing | / | ❌ mock | ✅ 真实 |
| Dashboard | /dashboard | ❌ mock | ✅ 真实（学生看自己进度/教师看班级统计） |
| LMS | /lms | ❌ mock | ✅ 真实 |
| Challenge 详情 | /challenges/[id] | ❌ mock | ✅ 真实 |
| 教师控制台 | /teacher | 🔶 半真 | ✅ 全真实 |
| 提交详情 | /submissions/[id] | ❌ mock | ✅ 真实（含 Task 状态时间线） |
| 个人中心 | /profile | ❌ mock | ✅ 真实 |

### 8.2 接线原则

`lib/api.ts` 客户端适配层：真实 API 优先，失败回落 mock，页面永不白屏。后续页面接线一律走此层，禁止页面直接 fetch。

---

## 9. API 契约

| 接口 | 方法 | 说明 | 状态 |
|---|---|---|---|
| /api/health | GET | 环境变量就绪检查 | ✅ |
| /api/challenges | GET | 已发布 Challenge 列表 | ✅ |
| /api/challenges | POST | 教师发布 | ✅ |
| /api/submit | POST | 学生提交（**v3.0: 返回 task_id，异步处理**） | 🔶 改造 |
| /api/github/check | POST | GitHub 仓库健康检查 | ✅ |
| /api/portfolio | GET | 作品集列表 | ✅ |
| /api/students | GET | 学生列表 | ✅ |
| /api/tasks/:id | GET | **🆕 查询 Task 状态和进度** | ❌ P1 |
| /api/submissions | GET | 提交列表+详情 | ❌ P1 |
| /api/evaluations | POST | 教师终评 | ❌ P1 |
| /api/auth/login | POST | **🆕 简单身份选择** | ❌ P1 |

响应格式统一：`{ ok: true, ...data }` / `{ ok: false, error, ... }`。

---

## 10. 安全与权限

| 原则 | v2.0 | v3.0 |
|---|---|---|
| 前端不暴露密钥 | ✅ | ✅ |
| 学生不能直接写 Submission Record | ✅ 唯一写入口 | ✅ 唯一写入口 + Relationship 校验 |
| 所有状态变更有审计 | ✅（未持久化） | ✅ Redis + 飞书 AuditLogs 双写 |
| 学生只能看自己的提交 | ❌ 无登录 | 🔶 Relationship 校验（P1） |
| 教师只看授权班级 | ❌ | 🔶 Relationship 校验（P1） |
| Peer 只看被分配提交 | ❌ | 🔶 Peer Relationship（P2） |

---

## 11. 红线合规矩阵（P3394 对齐）

| # | 红线 | v2.0 | v3.0 |
|---|---|---|---|
| 1 | Agent 必须有身份 | ✅ | ✅ Service Principal 三元组 |
| 2 | Agent 必须有通道 | 🔶 | 🔶 Redis/HTTP/CLI 多通道 |
| 3 | Agent 必须有 Manifest | 🔶 3/4 | 🔶 补全 teacher + Hermes + WorkBuddy |
| 4 | 权限边界 | ✅ | ✅ Relationship 五级 |
| 5 | 可审计 | 🔶 | 🔶 Redis + AuditLogs 持久化 |
| 6 | 提交必经 Submission Task Agent | ✅ | ✅ |
| 7 | 四空间同步 | 🔶 | 🔶 GitHub+飞书+Redis ✅，Ontology ❌ |
| 8 | 消息总线 | 🔶 ADR-001 | ✅ Redis（P1）→ Hermes（P3） |
| 9 | P3394-compatible | ✅ | ✅ Service Principal + Relationship + Envelope |
| 10 | Agent-native 而非表单 | 🔶 | 🔶 多 Agent 异步协作，消息链完整 |

---

## 12. 路线图

### P0 已完成 ✅

演示闭环、三方合并、提交/发布双链路、Manifest、审计、幂等。

### P1 班级试运行（下一批开发，按优先级）

1. **Task 状态机**：`lib/server/task.ts`，A2A 风格生命周期
2. **Service Principal + Relationship**：升级 `agents.ts`，替换 isTrusted()
3. **Redis 消息队列**：安装 Redis，实现消息收发，替换进程内调用
4. **handle_message 统一入口**：所有通道归一
5. **审计持久化**：AuditTrail 写入飞书 AuditLogs 表
6. **GET /api/submissions + GET /api/tasks/:id** → 前端接真实数据
7. **Challenge 详情页接真实数据**
8. **教师终评接口**：POST /api/evaluations + 状态流转
9. **简单登录/身份选择** + 学生名单导入
10. **缓存层**：Student/Challenge Redis 缓存

### P2 Agent-native 深化

11. **AI Queue**：DeepSeek 调用队列 + 并发控制 + 降级策略
12. **Hermes Manifest**：学生端 Companion 正式接入
13. **WorkBuddy Manifest**：教师端 Companion 正式接入
14. **Peer Review 实际分配**
15. **Ontology Memory 接入**

### P3 NSEAP 正式接入

16. **Hermes/OpenClaw 消息路由**替换 Redis（Envelope 格式不变，只换传输层）
17. Companion Agent 桌面端
18. 平台统一登录 + Agent 注册中心
19. 多班级多角色

---

## 13. 架构决策记录（ADR）

### ADR-001 Hermes/OpenClaw 降级（有效，v2.0 延续）

v2.0：进程内函数调用模拟总线。v3.0：**Redis 消息队列替代进程内调用**。Envelope 格式不变，P3 接入真实总线时只换传输层。

### ADR-002 WebApp 兜底身份（v3.0 扩展）

v2.0：WebApp 以 `*-webapp-fallback` 身份代学生/教师。v3.0：**新增 Hermes 和 WorkBuddy 作为正式 Companion 通道**，WebApp fallback 保留为第三通道。

### ADR-003 飞书字段降级（有效，不变）

### ADR-004 幂等语义（v3.0 升级）

v2.0：60s 内存窗口，单实例。v3.0：**Redis 去重缓存，多实例共享**。

### ADR-005 Redis 消息总线（新增）

选用 Redis 作为 v3.0 消息总线（替代飞书 InboxQueue 表）。理由：微秒级延迟、无堆积问题、天然支持 Pub/Sub、与云厂商托管方案完全兼容。飞书 InboxQueue 表弃用，飞书 AuditLogs 表承担历史审计职责。

### ADR-006 Task 状态机（新增）

选用 A2A Task 生命周期（submitted→validating→ai_reviewing→teacher_reviewing→completed/rejected），替代同步一次性返回。理由：支持异步处理、进度可查、支持 Hermes/WorkBuddy 离线在线切换。

### ADR-007 Service Principal + Relationship（新增）

选用 P3394 身份三元组 `{person, org, role}` 和五级 Relationship，替代 agent_id 字符串 + isTrusted()。理由：同一人多角色可区分、权限粒度从 bool 升级为结构化、天然支持双 Companion 场景。

---

## 14. 开发守则（所有 Coding Agent 必读）

1. 不得绕过 `submitChallengeProject` / `publishChallenge` 新增任何写记录路径
2. 每个新状态变更必须 `audit.log()`
3. 新消息一律 `buildEnvelope()`，新 Agent 交互先加 Relationship
4. 不修改 `lib/schemas/zod-from-schemas.ts`
5. 响应格式统一 `{ ok, ... }`
6. 页面取数一律经 `lib/api.ts`，保持 mock 兜底
7. 每项改动跑 `npx next build` + curl 实测后提交
8. 错误提示面向用户可理解，不裸抛技术异常
9. **🆕 所有 Agent 间通信走 Redis 消息队列，禁止进程内直接调函数**
10. **🆕 Redis 消息处理完即删；永久数据存飞书表**
11. **🆕 所有消息必须携带 Service Principal (person, org, role)，Receiver 必须先匹配 Relationship 再执行**

---

*本白皮书是 NSEAP 教育任务系统 v3.0 的架构基线。后续所有开发、Code Review、架构评审均以此为准。*
