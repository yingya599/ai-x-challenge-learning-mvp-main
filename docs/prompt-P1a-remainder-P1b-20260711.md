# Hermes 任务提示词：P1a 收尾 + P1b 架构升级（2026-07-11）

> 交给 Hermes 执行。执行完由审查者（另一会话）验收，验收通过前**禁止 push**。

## 项目上下文

- 仓库：`~/elite20-merge/merged/`（Next.js 15 + TS），GitHub `a976xw7td/ai-x-challenge-learning-mvp`，本地 main 分支领先远端 9 个 commit（未 push）。
- 架构权威基线：`docs/AI-X-NSEAP-Technical-Whitepaper-v3.1-20260711.md`（以**已提交版本**为准）。路线图见 §12，红线见 §10。
- `.env.local` 已配好飞书凭证（app QRNww0zLRi7w9wkQihpc16yNndc，表 ID 全在 env）。`TEACHER_IDS=stu_zhanghao_001` 为测试值。
- 实测报告：`docs/P1a-delivery-report-20260711.md` §6 —— T7–T12 已端到端实测通过（含 1 个已修复的 T7 字段映射 bug）。
- 红线（每条改动都要遵守）：role 只能服务端判定；审计 fire-and-forget 不阻塞业务；不改 Team3 的 `zod-from-schemas.ts`；通知失败只审计不抛错；**每个任务独立 commit**（前缀 `feat(T{n})`/`fix(T{n})`）。

## 第一部分：P1a 收尾（先做，全部完成才进 P1b）

### T14 前端去 mock（白皮书 §12 P1a 第 4 项遗留）
现状：
- `app/(app)/challenges/[id]/page.tsx` 仍全量用 `@/lib/data` mock（第 18 行），与 `/submit`（已走 `/api/challenges` 真数据）不同源。
- `app/(app)/teacher/page.tsx` 第 75–104 行：真实数据与 mock **合并展示**，mock 提交会混进教师控制台。
- `app/(app)/submissions/[id]/page.tsx` 第 45–76 行：API 查不到时回落 mock。

要求：三个页面全部改为**只**用真实 API（`/api/challenges`、`/api/submissions`、`/api/submissions/[id]`），删除 mock 引入与 fallback 分支；空态给正常的"暂无数据"UI，不得静默显示假数据。`/dashboard`、`/lms`、`/profile`、`/portfolio` 的 mock 属 P1b/P2，本任务不动。

### T15 飞书表结构补齐（环境操作，用飞书 OpenAPI 完成并留脚本）
1. Submissions 表（`tblk0W13dUdeJCqr`）**加 `task_state` 文本列**——当前缺列导致 T11 走 fallback（审计里有 `task_state_field_missing`）。加列后回归一次教师评审，确认双列（status + task_state）都落库、fallback 审计不再出现。
2. 清理 Submissions 表中 `student_id` 为空的脏记录（先打印记录内容确认无有效信息再删）。
3. Students 表（`tblZNoZuykeoSLZL`）确认/补充 `feishu_open_id` 列；为至少一名真实学生填入真实 open_id。
4. 脚本放 `scripts/`，可重复执行（幂等）。

### T16 T8 通知真实链路补测
用 T15.3 的真实 open_id 触发一次提交/评审，确认：学生私聊收到 Bot 消息、教师待复核私聊、群公告三条通道至少各验证一次；失败场景仍只产生 `notify_failed` 审计。把实测截图/日志摘录追加到交付报告。

### T17 P1a 验收准备
- `TEACHER_IDS` 改为正式教师名单（与张浩确认名单后写入 `.env.local`，文档注明 key 含义）。
- 按白皮书 §12 P1a 第 7 项写一份《小班试运行 checklist》（docs/），覆盖 发布→提交→AI 初评→教师终评→通知回流→审计可查 全链路的操作步骤与预期结果。
- `npx next build` 零错误；更新 `docs/P1a-delivery-report-20260711.md`。

## 第二部分：P1b 架构升级（P1a 验收后启动，对应白皮书 §12 第 8–13 项）

> 每项开工前先读白皮书对应章节（§3.4、§3.5、§4、§5.3、ADR-008/009），有冲突以白皮书为准；白皮书自身矛盾则停下来问审查者。

### T18 部署迁移（ADR-009）
Vercel/本机 → Docker 常驻：Next.js standalone 输出 + Redis（AOF everysec）同 docker-compose。以吴嘉宇 PR#5 的 Dockerfile 为基。交付：`docker compose up` 一条命令起全栈，`/api/health` 增加 Redis 探活。

### T19 Redis Stream 消息总线 + handle_message 统一入口
- Envelope 入 Redis Stream（消费组 + ACK + pending 重投）；worker 常驻消费。
- `handle_message`：Principal 解析 → Relationship 校验 → 路由到 Task Pipeline，作为唯一入口（§5.3）。
- Envelope 格式不变（ADR-001，只换传输层）。

### T20 /api/submit 异步化
POST 立即返回 `task_id`；新增 `GET /api/tasks/:id`（Redis 缓存 → 飞书回源）；前端提交页/详情页加 Task 状态时间线。权威状态仍在飞书 Submissions（决策一），Redis 只缓存。

### T21 信任模型全量替换
`isTrusted()` → Service Principal + 五级 Relationship（含 trust_level: auto/require_approval），启用 `envelope-v2.schema.ts`，**仍不动 Team3 文件**。

### T22 缓存 + 限流 + 去重
Student/Challenge 读缓存进 Redis；AI Queue max 4 并发 + 429 指数退避 + 降级 fallback 评语；内存去重 Map 迁 Redis（多实例共享）。

### T23 P1b 验收
1. **FLUSHALL 恢复测试**：清空 Redis 后系统从飞书完整恢复，业务不丢。
2. **50 人并发提交压测**通过（写压测脚本入 `scripts/`）。
3. 全量回归 P1a 的 curl 用例（交付报告 §3/§6）。

## 通用工作方式

- 每个 T 独立 commit，完成后在交付报告追加实测证据（curl/日志/飞书表截查）。
- 自己实测过才能声称完成；发现白皮书与代码矛盾，停下来记录并询问，不擅自改基线文档。
- 全程不 push；P1a 收尾完成后先停，等审查通过再进 P1b。
