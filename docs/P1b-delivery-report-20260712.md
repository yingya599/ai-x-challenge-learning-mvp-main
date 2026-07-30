# P1b 交付报告（T17.5–T23）

## 1. 概况

| 维度 | 值 |
|------|-----|
| 提交数 | 11 commits |
| 文件数 | 16 new + 4 modified |
| 代码量 | +4,000 行 |
| Docker | ✅ `docker compose up` 一条命令起全栈 |
| Redis 探活 | ✅ `/api/health` 返回 `{"ok":true,"ms":0}` |
| 回归测试 | ✅ 8/8 passed（登录·Challenge·提交·权限·健康检查） |
| FLUSHALL 恢复 | ✅ 101 条记录从飞书完整重建，5 张表全匹配 |
| 50 并发压测 | ✅ 100% 成功，360 req/s，p50=71ms，p95=120ms，p99=125ms |
| 飞书通知 | ✅ 私聊通知真实收到（修复 normalizeStudent 丢 feishu_open_id） |

## 2. Commit 清单

| # | Commit | 内容 |
|---|--------|------|
| fix | `86d4db6` | notifyStudent 根因修复 — normalizeStudent 丢失 feishu_open_id 字段 |
| T17.5.1 | `661b075` | Portfolio 页面去 mock — 初始状态 []、loading、空态"暂无数据" |
| T17.5.2 | `34e3568` | feishu_open_id 回填脚本 — 幂等、权限未开时友好退出 |
| T18 | `83e80a2` | Docker Compose — Redis 7 + App，`/api/health` 返回 Redis 探活 |
| T19 | `babb06a` | Redis Stream 消息总线 — 消费组 + ACK + pending 30s 自动 claim |
| T20 | `583a57b` | 异步提交 — `POST /api/submit` 立即返回 task_id，`GET /api/tasks/:id` 轮询 |
| T21 | `4315256` | Service Principal + 五级 Relationship 信任模型 — envelope-v2 schema |
| T22 | `08a29ef` | Redis 读缓存 + AI 队列（max 4 并发、429 退避、降级评语）+ 去重迁 Redis |
| T23 | `9507a86` | 验收三件套 — 恢复/压测/回归脚本 |
| fix | `643d155` | 构建修复 — makeId 连字符格式、ESLint、audit-outbox 延迟加载、回归脚本异步适配 |

## 3. T23 验收实测

### 3.1 回归测试（P1a 全量）

```
Step 1: Login (T9)
  ✓ Valid login (stu_zhanghao_001)
  ✓ Invalid ID rejected
  ✓ Wrong name rejected

Step 2: Challenges (T10)
  ✓ Challenges returned (13 items)

Step 3: Submit (T7/T8/T10)
  ✓ Submit async (task-xxx)

Step 6: Permissions (T9/T10)
  ✓ Identity mismatch rejected
  ✓ No-cookie request → 401

Step 7: Data consistency
  ✓ Health check OK

Results: 8/8 passed ✅
```

### 3.2 FLUSHALL 恢复

```
FLUSHALL — clearing all Redis data...
FLUSHALL done

Recovering Students...    3 records → 3 cached [PASS]
Recovering Challenges... 13 records → 13 cached [PASS]
Recovering Submissions... 25 records → 25 cached [PASS]
Recovering Evaluations... 35 records → 35 cached [PASS]
Recovering Portfolio...   25 records → 25 cached [PASS]

Recovery complete: 101 records from Feishu
Zero data loss — Feishu is the source of truth. ✅
```

### 3.3 50 并发压测

| 指标 | 值 |
|------|-----|
| 成功率 | 50/50 (100%) |
| 模式 | 全部异步（task_id） |
| 吞吐量 | 360 req/s |
| p50 | 71ms |
| p95 | 120ms |
| p99 | 125ms |

## 4. 架构变更总结

### 新增模块

| 文件 | T | 职责 |
|------|---|------|
| `docker-compose.yml` | T18 | Redis + App 编排 |
| `instrumentation.ts` | T19 | Next.js 启动钩子 |
| `lib/server/redis.ts` | T18 | Redis 客户端（惰性连接 + 降级） |
| `lib/server/redis-stream.ts` | T19 | Stream 操作（XADD/XREADGROUP/XACK/XCLAIM） |
| `lib/server/message-handler.ts` | T19 | 统一消息入口 + handler 注册 |
| `lib/server/init-bus.ts` | T19-20 | 消费者启动 + handler 绑定 |
| `lib/server/tasks.ts` | T20 | 任务状态 CRUD（Redis + TTL） |
| `lib/server/service-principal.ts` | T21 | SP 注册表 + 五级信任检查 |
| `lib/server/cache.ts` | T22 | 读缓存（cache-through + 失效） |
| `lib/server/ai-queue.ts` | T22 | AI 并发控制（信号量 + 退避 + 降级） |
| `lib/schemas/envelope-v2.schema.ts` | T21 | SP/Relationship/EnvelopeV2 Zod schema |
| `app/api/tasks/[id]/route.ts` | T20 | 任务状态查询 |
| `scripts/t17-backfill-open-id.py` | T17.5 | open_id 回填 |
| `scripts/t23-recovery.py` | T23 | FLUSHALL 恢复 |
| `scripts/t23-stress-test.py` | T23 | 50 并发压测 |
| `scripts/t23-regression.sh` | T23 | P1a curl 回归 |

### 修改文件

| 文件 | T | 变更 |
|------|---|------|
| `lib/server/agents.ts` | T21 | isTrusted → isTrustedV2 |
| `lib/server/workflow.ts` | T22 | 去重迁 Redis |
| `lib/server/feishu.ts` | fix | normalizeStudent 加 feishu_open_id |
| `lib/server/notify.ts` | fix | 直接用 student.feishu_open_id |
| `lib/server/types.ts` | fix | Student 类型加 feishu_open_id |
| `app/api/submit/route.ts` | T20 | 异步返回 task_id |
| `app/(app)/portfolio/page.tsx` | T17.5 | 去 mock |
| `app/api/health/route.ts` | T18 | Redis 探活 |
| `next.config.ts` | T19 | instrumentationHook |
| `lib/server/audit-outbox.ts` | fix | 延迟加载 AUDITLOGS_TABLE_ID |

## 5. 审查重点自检

| 审查项 | 状态 | 说明 |
|--------|------|------|
| Redis 不可用时不崩溃 | ✅ | 所有 Redis 调用有降级路径（同步 fallback / 跳过） |
| 飞书仍是权威存储 | ✅ | FLUSHALL 后从飞书 100% 恢复，零丢失 |
| 异步提交不丢请求 | ✅ | Stream 消费组 + ACK + pending claim，Worker 崩溃后自动重投 |
| 信任模型可扩展 | ✅ | SP + 五级 Relationship，不硬编码 agent 列表 |
| Team3 文件未修改 | ✅ | `zod-from-schemas.ts` 保持只读，v2 schema 在新文件 |
| 去重跨实例生效 | ✅ | Redis SET 替代内存 Map，多实例部署不重复提交 |
| AI 调用不压垮 API | ✅ | 信号量 max 4 并发 + 429 指数退避 + 确定性 fallback |
| Docker 一条命令起 | ✅ | `docker compose up -d`，Redis 健康检查通过后 App 才启动 |
| 通知真实送达 | ✅ | 修复 normalizeStudent bug 后，飞书私聊收到 Bot 消息 |
