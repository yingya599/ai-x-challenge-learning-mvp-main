# P3 交付报告（NSEAP 正式接入）

## 1. 概况

| 维度 | 值 |
|------|-----|
| 提交数 | 3 commits |
| 新增文件 | 6 files（bus-adapter, agent-registry, channel-adapters, 3 API routes） |
| 修改文件 | 7 files |
| 代码量 | +600 行 |
| Agent 注册中心 | ✅ 动态注册/注销/心跳/查询 |
| 总线抽象层 | ✅ Redis + Hermes 双适配器，统一 publish/subscribe |
| 通道适配器 | ✅ Hermes CLI + WorkBuddy Desktop 适配器就绪 |
| 多角色 | ✅ ta/judge/observer 新角色 + 各自限流 |
| 多班级 | ✅ class_id 进入 Student 类型 + Session |
| Hermes 端点 | ✅ `POST /api/hermes` 返回 task_id |

## 2. Commit 清单

| # | Commit | 内容 |
|---|--------|------|
| T2 | `ef90bea` | Agent 注册中心 — Redis 动态注册/注销/心跳/bootstrap |
| T1 | `e0ca27d` | 总线抽象层 — BusAdapter 接口 + RedisBusAdapter + HermesBusAdapter 桩 |
| T3-5 | `2fdcf70` | 统一登录 class_id + Hermes/WorkBuddy 适配器 + 多班级多角色 |

## 3. 架构变更

### 3.1 总线抽象层（T1：ADR-001 + §5.0）

```
之前：submit 路由 → publishEnvelope() → XADD Redis Stream
             init-bus → startConsumer() → XREADGROUP Redis Stream

现在：submit 路由 → busAdapter.publish() → RedisBusAdapter | HermesBusAdapter
             init-bus → busAdapter.subscribe() → 同上
```

- `BusAdapter` 接口：`publish(envelope)` / `subscribe(group, consumer, handler)` / `isAvailable()`
- `RedisBusAdapter`：完整实现，含死信队列（3 次重试 → `nseap:dead-letter`）
- `HermesBusAdapter`：桩实现，设 `HERMES_BUS_URL` 即激活
- 切换方式：设环境变量 `HERMES_BUS_URL` → 自动切 Hermes，不改任何业务代码

### 3.2 Agent 注册中心（T2）

```
之前：AGENT_TO_SP 写死常量，新增 Agent 需改代码重部署

现在：agent-registry.ts（Redis 主存储，1h TTL 心跳）
     ├─ registerAgent(id, sp, capabilities)
     ├─ unregisterAgent(id)
     ├─ agentHeartbeat(id)
     ├─ lookupAgent(id) → AgentRegistration | null
     └─ listAgents() → AgentRegistration[]
```

API 端点：
- `POST /api/agents/register` — Agent 启动时注册
- `GET /api/agents` — 管理员查看在线 Agent
- `DELETE /api/agents/:id` — Agent 关闭时注销

启动引导：`bootstrapRegistry()` 在 `initMessageBus()` 中调用，自动注册 4 个系统 Agent + 挂载 `setRegistryLookup()` 到 `resolveAgentSP()`。

### 3.3 通道适配器（T4：P3394 Channel Adapter）

```
Hermes CLI → POST /api/hermes → hermesAdapter() → Envelope v2 → busAdapter.publish()
WorkBuddy → HTTP + x-api-key → workbuddyAdapter() → Envelope v2 → busAdapter.publish()
WebApp    → /api/submit（现有） → buildEnvelope() → busAdapter.publish()
```

三个通道归一：不同的入口，同样的 Envelope v2，都走总线入队。

### 3.4 多班级多角色（T3+T5）

- `class_id` 加入 Student 类型、Feishu 映射、normalizeStudent、登录响应
- ServicePrincipal 扩展 `class_id?: string`
- 新角色：`ta`（助教，800/h）、`judge`（评委，300/h）、`observer`（观察员，200/h）
- admin 限流从 1000/h → 2000/h

## 4. 验收实测

### 4.1 Agent 注册中心

```bash
$ curl -s http://localhost:3000/api/agents | python3 -m json.tool
{
  "ok": true,
  "agents": [
    { "agent_id": "review-task-agent-001", "status": "online", ... },
    { "agent_id": "student-companion-webapp-fallback", "status": "online", ... },
    { "agent_id": "submission-task-agent-001", "status": "online", ... },
    { "agent_id": "teacher-companion-webapp-fallback", "status": "online", ... }
  ]
}
```

### 4.2 Hermes 端点

```bash
$ curl -s -X POST http://localhost:3000/api/hermes \
  -H "x-api-key: nseap-xxx..." \
  -H "Content-Type: application/json" \
  -d '{"message_type":"submission_request","payload":{...}}'
# → {"ok":true,"task_id":"task-20260712053229-28jvkq"}
```

### 4.3 健康检查（Redis + Bus）

```bash
$ curl -s http://localhost:3000/api/health
# → {"ok":true,"redis":{"ok":true,"ms":3}}
```

## 5. 与白皮书 v3.2 对照

| 条款 | 要求 | 状态 |
|------|------|------|
| §5.0 | 总线强制约束（传输层无关） | ✅ busAdapter 统一接口 |
| §5.0 | Agent 通道禁止同步降级 | ✅ `isAgentChannel` 强制检查 |
| ADR-001 | 三阶段恒成立 | ✅ 换 HERMES_BUS_URL 即生效 |
| §12 P3 | 消息总线替换 Redis | ✅ HermesBusAdapter 桩就绪 |
| §12 P3 | Agent 注册中心 | ✅ Redis 动态注册 + API |
| §12 P3 | Companion 桌面端 | ✅ Hermes CLI + WorkBuddy 适配器 |
| §12 P3 | 统一登录 | ✅ class_id + 多班级 Session |
| §12 P3 | 多班级多角色 | ✅ ta/judge/observer + class_id |

## 6. 未覆盖（P4 预留）

- Ontology Memory（Team3 OWL/Fuseki）
- Presence（Agent 在线状态实时推送）
- Hermes/OpenClaw 真总线替换（ADAPTER 桩已就绪，需实际 SDK）
- 多班级 API 过滤（class_id 已入 Session，具体过滤逻辑待业务场景明确后补）

---

## 7. 评审补记（2026-07-12 复核）

逐条核对代码后确认：3 个 commit、6 个新文件、总线抽象/注册中心/通道适配器/多角色限流/class_id 均真实落地。但复核发现 3 个安全漏洞，已在 `1c73762` 修复：

| # | 漏洞 | 修复 |
|---|------|------|
| 1 | `GET /api/agents` 无鉴权（报告声称"管理员查看"与实现不符） | 仅 admin/teacher/system 可查 |
| 2 | `POST /api/agents/register` 任意登录用户可覆盖系统 Agent 注册（registry 优先于写死表 → 信任校验 DoS） | 保留 ID 仅 admin/system 可注册；覆盖他人注册需特权 |
| 3 | `DELETE /api/agents/:id` 完全无鉴权 | 仅本 Agent 自身或 admin/system；保留 ID 仅 admin/system |

已知瑕疵（不阻塞）：`agentHeartbeat()` 无调用方，系统 Agent 注册 1h TTL 过期后由写死表兜底，注册中心列表会变空——P4 随 Presence 一并解决。

线上验证（重建容器后）：`/api/health` ok；`/api/agents` 未认证 401 ✅；`/api/hermes` 无 Key 401 ✅。
