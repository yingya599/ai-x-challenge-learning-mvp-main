# P2 交付报告（Agent-native 深化）

## 1. 概况

| 维度 | 值 |
|------|-----|
| 提交数 | 12 commits |
| 文件变更 | 22 files, +1,264 / -708 行 |
| Agent 数量 | 4 → 7（新增 3 个） |
| Manifest | 6/6 齐全 |
| Challenge 表字段 | 9 → 21（标准要求 17） |
| Submission 表字段 | 18 → 35（标准要求 35，全覆盖） |
| Docker 回归 | ✅ 8/8 passed |
| AGENT_CN.md 合规 | ✅ §2.2 每人独立 Agent、§8.2 强制 Stream、§7 表字段 |

## 2. Commit 清单

| # | Commit | 内容 |
|---|--------|------|
| P2-1 | `2f3b742` | 前端去 mock — dashboard/lms/profile 接真实数据 + 提交时间线 |
| P2-2 | `0a7a43d` | 同学互评 — 同班随机选 3 人 + 飞书通知 + 评审记录 |
| P2-2 | `715a5e9` | 同伴评审 API — `POST /api/evaluations` 支持 `evaluator_type=peer` + 去重 |
| P2-3/4 | `0e5b804` | 限流（按角色 100-1000/h）+ 死信队列（3 次重试） + require-approval |
| P2-5 | `8eefb9e` | Hermes + WorkBuddy Manifest（6/6 全部 Zod 校验通过） |
| fix | `5d7bab2` | 审查修复 — 限流按角色、同伴评审去重 |
| agent | `44d9f3f` | 张浩专属 Agent + WorkBuddy/Hermes 正式接入 SP 信任系统 |
| fix | `fc9a674` | Agent 通道强制走 Redis Stream（AGENT_CN.md §8.2） |
| fix | `d56e7c3` | 工程质量 — fromAgent 不再写死 + notify await 保证不丢消息 |
| feat | `7e7bddf` | 每人自动发钥匙 — 登录时生成 + 飞书存储 + 个人中心显示 |
| fix | `9f98bbc` | /api/auth/me 补返回 name + api_key |
| feat | `5b41af9` | AGENT_CN.md §7 表字段合规 — 56 个新字段映射 + 写入 |

## 3. 功能验收

### 3.1 前端去 mock

| 页面 | 之前 | 之后 |
|------|------|------|
| 仪表盘 | 硬编码假数据 | 真实学生数/Challenge 数/提交数/完成率 |
| LMS 学习管理 | 硬编码课程 | 真实 Challenge 列表 + 搜索 |
| 个人中心 | 假学生数据 | 真实姓名/提交记录/作品集/API Key |
| 提交详情 | 无进度展示 | 5 步时间线（已提交→校验→AI初评→教师评审→完成） |

### 3.2 同学互评

```
提交 (peer_only) → 同班随机选 3 人 → 创建评审记录 → 飞书通知
                                                      ↓
                                              同伴提交评审 (evaluator_type=peer)
                                                      ↓
                                              去重检查 → 写入 Evaluations 表
```

### 3.3 Agent 体系

```
7 个 Agent 全部有身份证 + 信任关系 + 认证方式

student-companion-webapp-fallback     Cookie 登录
teacher-companion-webapp-fallback     Cookie 登录
submission-task-agent-001             内部系统
review-task-agent-001                 内部系统
student-companion-hermes              API Key (env)
teacher-companion-workbuddy           API Key (env)
student-companion-zhanghao-001        API Key (飞书自动生成)
```

**API Key 流程：**
1. 学生登录 → 系统自动生成钥匙 → 存飞书 `API Key` 列
2. 个人中心 → 显示/隐藏/复制/下载配置文件
3. Agent 请求带 `x-api-key` 头 → 查 env + Students 表 → 解析 SP

### 3.4 基础设施

| 功能 | 实现 |
|------|------|
| 限流 | `handle_message` 入口，Redis 计数器，admin/teacher=1000，agent=500，student=100 |
| 死信 | 消费重试 3 次后 `XADD nseap:dead-letter` + `XACK`，保留 envelope + error |
| require-approval | `needsApproval()` 检查，基础设施就绪（管理员 UI 待 P3） |
| Agent 通道强制 Stream | Agent 角色请求必须 XADD，Redis 不可用返回 503 |

## 4. AGENT_CN.md 合规对照

| 条款 | 要求 | 状态 |
|------|------|------|
| §2.1 | Agent 必须有一组最低属性 | ✅ 7 个 Agent 全部具备 |
| §2.2 | 每个学生独立 Companion Agent | ✅ 登录自动生成 `student-companion-{id}` |
| §2.2 | 绑定 Feishu Bot ID | ✅ manifest 中声明 |
| §2.4 | 学生不可直接写 Submission Record | ✅ 必经 Submission Task Agent |
| §7.1 | Challenge 表 17 个必须字段 | ✅ 21 字段（覆盖 17 个） |
| §7.2 | Submission 表 35 个必须字段 | ✅ 35 字段全覆盖 |
| §8.1 | 消息包含必需要素 | ✅ message_id/from/to/timestamp/payload/audit trace |
| §8.2 | 禁止绕过通信层 | ✅ Agent 通道强制 Redis Stream |
| §8.2 | 禁止无身份消息 | ✅ 所有消息经 buildEnvelope + isTrusted |
| §8.2 | 禁止无 audit trace | ✅ 每步 aud...OKEN |

## 5. 审查自检

| 项 | 状态 | 说明 |
|----|------|------|
| Agent 身份不写死 | ✅ | `fromAgent` 从调用方传入 |
| 通知不丢 | ✅ | `await notifyStudent` 后才返回 |
| Agent 通道不绕过 Stream | ✅ | `isAgentChannel` 强制检查 |
| 每人有独立身份 | ✅ | 登录时自动生成 SP + API Key |
| 钥匙安全 | ✅ | 默认隐藏、可复制、可下载 |
| 互评不重复 | ✅ | `evaluator_id` 去重 |
| 限流按角色 | ✅ | `ROLE_RATE_LIMITS` 字典 |
| 表字段齐全 | ✅ | 飞书列 + 代码读/写全部对齐 |
