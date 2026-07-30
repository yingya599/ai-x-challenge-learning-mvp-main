# Hermes 任务提示词：P1b 架构升级启动令（2026-07-12）

## 状态同步（先读）

- **P1a 已审查通过**。T14–T17 全部核实，小班试运行验收已实测：见 `docs/P1a-trial-run-result-20260712.md`。
- 验收结论：**有条件通过**。全链路（登录→Challenge→提交→GitHub 检查→AI 初评→教师终评→审计落库）真实跑通；权限五项全过；T16 通知审计修复实测生效（notify_failed 6 条落库）。
- 唯一未验：第 5 步通知**真实接收**（5.1–5.3），被飞书 bot 权限卡住，见下方 T17.5。
- 基线：本地 main，工作区干净，全部未 push。任务定义以 `docs/prompt-P1a-remainder-P1b-20260711.md` 第二部分（T18–T23）为准，本文只做启动令 + 增补，不重复正文。

## 增补任务（进 T18 之前先做）

### T17.5 P1a 遗留清账（一个 commit）
1. **portfolio 页去 mock**：`app/(app)/portfolio/page.tsx` 仍以 `mockPortfolioItems` 作 useState 初始值。改为空数组 + loading + "暂无数据"，走 `/api/portfolio` 真实数据，与 T14 三页同一风格。
2. **feishu_open_id 回填脚本**：写 `scripts/t17-backfill-open-id.py`（复用 t15 脚本的 env/token 骨架）：
   - 调 `POST /open-apis/contact/v3/users/batch_get_id`（需 `contact:user.id:readonly` 权限，用户负责在飞书后台开通；权限未开通时脚本要打印清晰的申请链接并退出，不算失败）；
   - 按 Students 表邮箱批量解析 open_id 并写回 `feishu_open_id` 列，幂等（已有值跳过）。
   - 权限开通且回填成功后，触发一次真实提交 + 教师终评，确认学生私聊、群公告至少各收到一条真实 Bot 消息，证据追加到交付报告（即补完 checklist 5.1–5.3）。若权限迟迟未开通，记录阻塞、继续 T18，不要等。

## 正式启动 P1b：T18 → T23

按 `prompt-P1a-remainder-P1b-20260711.md` 第二部分顺序执行，此处只强调验收红线：

- **T18**：`docker compose up` 一条命令起全栈；`/api/health` 返回 Redis 探活状态。
- **T19**：Envelope 走 Redis Stream（消费组 + ACK + pending 重投），`handle_message` 成为唯一入口；Envelope 格式不变（ADR-001）。
- **T20**：`POST /api/submit` 立即返回 `task_id`；`GET /api/tasks/:id` Redis 缓存→飞书回源；前端加任务状态时间线。权威存储仍是飞书（决策一）。
- **T21**：`isTrusted()` 全量替换为 Service Principal + 五级 Relationship（trust_level: auto/require_approval），启用 `envelope-v2.schema.ts`；**不动 Team3 文件**。
- **T22**：读缓存进 Redis；AI Queue max 4 并发 + 429 指数退避 + 降级评语；去重 Map 迁 Redis。
- **T23 验收三件套**：
  1. FLUSHALL 后从飞书完整恢复，业务零丢失；
  2. 50 人并发提交压测通过（脚本入 `scripts/`）；
  3. 全量回归 P1a curl 用例 + 本次试运行 checklist 第 1/2/3/4/6/7 步。

## 工作规则（不变，重申）

1. 每个 T 独立 commit，commit message 带 T 编号。
2. 自己实测出证据（curl 输出/日志/飞书表实查）才能声称完成，证据追加进交付报告。
3. 白皮书 v3.1（§3.4、§3.5、§4、§5.3、ADR-008/009）与代码冲突时以白皮书为准；白皮书自身矛盾则停下记录并询问审查者，不擅自改基线文档。
4. 全程**不 push**。
5. T23 完成后停下，写 P1b 交付报告，等审查。
