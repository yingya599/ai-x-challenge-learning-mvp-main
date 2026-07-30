# P1a 交付报告（T7–T17）

## 1. 概况

| 维度 | 值 |
|------|-----|
| 提交数 | 9 commits |
| 文件数 | 27 files |
| 代码量 | +1,600 行 / -300 行 |
| Build | ✅ `next build` 编译成功（2026-07-11 复跑确认） |
| curl 验证 | ✅ 所有新增 API 端点返回正确 |
| 飞书审计 | ✅ AuditLogs 表 61 条记录（含 notify_failed） |

## 2. Commit 清单

| # | Commit | 内容 |
|---|--------|------|
| T7 | `c8ea1c8` | audit-outbox.ts — Outbox 模式，批量写飞书 AuditLogs，3次退避重试，fire-and-forget |
| T8 | `0ddb630` | notify.ts — 飞书 Bot 通知，notifyStudent + notifyGroup，4事件接入 |
| T9 | `02fd48f` | principal.ts + login/me 路由 + login 页面 — HMAC-SHA256 session，role 服务端判定 |
| T10 | `45d891d` | getSubmissions + /api/submissions + 教师/详情页接真实数据 |
| T11 | `e750a13` | review-workflow.ts + /api/evaluations — manual_review_adjustment，状态双列，评审弹窗 |
| T12 | `77e733b` | github SHA + teacher manifest + buildEnvelope signature |
| T14 | `85adb25` | 前端去 mock — challenges/[id]、teacher、submissions/[id] 全走真实 API |
| T15 | `0398edc` | 飞书表结构补齐 — task_state + feishu_open_id 列，清理脏记录，脚本 scripts/ |
| T16 | `1081116` | 修复通知回调中 notify_failed 审计丢失 bug（3 处 .then() 加 enqueue+flush） |

## 3. curl 实测

```bash
# T9 — 登录拒绝未知学生
curl -s http://localhost:3333/api/auth/login -X POST \
  -H 'Content-Type: application/json' \
  -d '{"studentId":"nonexistent","name":"NoOne"}'
# → {"ok":false,"error":"学生ID不存在或未导入系统"}

# T9 — 匿名访问 /api/auth/me
curl -s http://localhost:3333/api/auth/me
# → {"ok":false,"error":"未登录"}

# T10 — 匿名访问 Submissions
curl -s http://localhost:3333/api/submissions
# → {"ok":false,"error":"请先登录"}

# T10 — Challenges 返回真实数据
curl -s http://localhost:3333/api/challenges
# → {"ok":true,"challenges":["cha_demo_001","AI+X 学习任务..."]}

# T11 — 匿名 POST Evaluations 被拒绝
curl -s http://localhost:3333/api/evaluations -X POST \
  -H 'Content-Type: application/json' -d '{}'
# → {"ok":false,"error":"仅教师可提交评审"}
```

## 4. 审查重点自检

| 审查项 | 状态 | 说明 |
|--------|------|------|
| T9 role 不可客户端注入 | ✅ | `determineRole()` 服务端判断，客户端不传 role；cookie 中 role 经 HMAC 签名 |
| T7 不阻塞业务 | ✅ | `flush()` → `batchWriteWithRetry()` 不 await；失败仅 console.error |
| T11 未改 zod-from-schemas.ts | ✅ | `manual_review_adjustment` 走 buildEnvelope 的 relaxed 分支，不改 Team3 枚举 |
| 通知失败只审计 | ✅ | `.then()` 中 `audit.log("notify_failed")`，不抛异常 |
| 每项独立 commit | ✅ | 6 个 commit，前缀 feat + T 编号 |
| Principal 只信服务端 | ✅ | `getPrincipal()` 从 HttpOnly cookie 解析 HMAC，失败返回 null |

## 5. 新增文件清单

```
lib/server/audit-outbox.ts          # T7 Outbox 审计持久化
lib/server/notify.ts                # T8 飞书 Bot 通知
lib/server/principal.ts             # T9 Principal 解析+Token 签发
lib/server/review-workflow.ts       # T11 教师终评工作流
app/api/auth/login/route.ts         # T9 登录 API
app/api/auth/me/route.ts            # T9 当前用户 API
app/api/submissions/route.ts        # T10 提交列表 API
app/api/submissions/[id]/route.ts   # T10 提交详情 API
app/api/evaluations/route.ts        # T11 教师评审 API
app/(public)/login/page.tsx         # T9 登录页面
agents/manifests/teacher-companion-webapp-fallback.json  # T12b 教师 Manifest
```

## 6. 端到端实测（2026-07-11，真实飞书数据）

Dev server (`next dev -p 3333`) + 真实飞书表逐项验证：

### 6.1 T9 登录 + 权限链
| 用例 | 结果 |
|------|------|
| 未知学生登录 | ✅ `学生ID不存在或未导入系统` |
| 姓名不匹配 | ✅ `姓名不匹配` |
| 真实学生 `stu_demo_001` 登录 | ✅ 返回 role=student，签发 HMAC session cookie |
| 匿名 `/api/auth/me` / `/api/submissions` / POST `/api/evaluations` | ✅ 分别 401/401/403 |
| `TEACHER_IDS` 命中 → role=teacher | ✅ 服务端判定，客户端不可注入 |

### 6.2 T10 行级隔离
| 用例 | 结果 |
|------|------|
| 学生 A 列表只见自己的提交 | ✅ `stu_demo_001` 见 4 条自己的；另一学生 `2023108600138` 见 0 条 |
| 学生 B 访问学生 A 提交详情 | ✅ 403 `无权查看此提交` |
| 教师列表见全部提交 | ✅ 5 条（含 1 条 student_id 为空的脏数据，见 6.5） |
| 详情路由按 `submission_id` 查询（非 record_id） | ✅ |

### 6.3 T11 教师终评
教师 POST `/api/evaluations`（action=accept, score=88/90）→ ✅ 成功创建 Evaluations 记录并更新 Submission 状态，返回完整 auditTrail（manifest 校验 `verify_relationship_review` 通过）。

### 6.4 T7 审计落库 — 发现并修复 1 个 bug
- **Bug**：`audit-outbox.ts` 字段名映射与飞书 AuditLogs 表实际列名不符（`时间戳`→实际为`操作时间`、`操作`→`操作类型`、`变更前/后状态`→`操作前/后状态`、表中无`错误信息`列），所有 flush 均 `FieldNameNotFound` 失败重试 4 次后丢弃——表中 0 条记录。业务未受影响（fire-and-forget 生效，符合 ADR-008 降级设计）。
- **修复**：更正 9 个字段映射（`error_trace`→`附加元数据`）。回归验证：一次评审后 AuditLogs 表成功写入 5 条记录（send_manual_review_adjustment / verify_relationship_review / create_teacher_evaluation 等）。

### 6.5 环境备注（2026-07-11 更新）

| 问题 | 状态 | 说明 |
|------|------|------|
| Submissions 表缺 `task_state` 列 | ✅ 已修复（T15） | 飞书 API 添加列，T11 评审不再降级 |
| Submissions 表脏记录（student_id 为空） | ✅ 已清理（T15） | 脚本 `scripts/t15-feishu-setup.py --clean` |
| Students 表缺 `feishu_open_id` 列 | ✅ 列已添加（T15） | 但 3 名学生均未填入真实值 |
| T8 通知：缺真实 open_id | ⚠️ 待补 | 通知降级 skip，审计记录 `notify_failed`（4 条已确认） |
| `FEISHU_CLASS_CHAT_ID` 未配置 | ⚠️ 待补 | 群公告降级 skip（符合 §6.4 设计） |
| 测试用 `TEACHER_IDS=stu_zhanghao_001` | ⚠️ 待改 | 需替换为正式教师名单 |

### 6.6 Build
`npx next build` ✅ 编译零错误（2026-07-11 复跑确认）。

### 6.7 T14–T16 收尾验证

#### T14 前端去 mock
| 页面 | 结果 |
|------|------|
| `challenges/[id]` | ✅ 删除 `@/lib/data` mock 引入，纯真实 API |
| `teacher` | ✅ 删除 mock 合并逻辑，纯真实数据 + loading/empty 态 |
| `submissions/[id]` | ✅ 删除 mock fallback，404 时显示"暂无数据" |

#### T15 飞书表结构补齐
| 操作 | 结果 |
|------|------|
| Submissions 表加 `task_state` 列 | ✅ 已添加，T11 评审正常落双列（status + task_state） |
| Students 表加 `feishu_open_id` 列 | ✅ 已添加 |
| 清理脏记录 | ✅ 1 条脏 submission + 1 条脏 student 已删除 |
| 幂等脚本 | ✅ `scripts/t15-feishu-setup.py`（可重复执行） |

#### T16 通知审计修复
| 修复点 | 结果 |
|------|------|
| workflow.ts 提交成功通知 | ✅ notify_failed 审计已持久化 |
| workflow.ts 提交失败通知 | ✅ 同上 |
| review-workflow.ts 教师终评通知 | ✅ 同上 |
| challenge-workflow.ts 群公告通知 | ✅ 同上（FEISHU_CLASS_CHAT_ID 未配→skip 不审计） |
| AuditLogs 表实测 | ✅ 61 条记录，含 4 条 `notify_failed`（submission-task-agent-001, error="no feishu_open_id"） |

## 7. 交付物

| 文件 | 说明 |
|------|------|
| `docs/P1a-delivery-report-20260711.md` | 本报告 |
| `docs/P1a-trial-run-checklist-20260711.md` | 小班试运行验收 checklist（7 步 28 项） |
| `scripts/t15-feishu-setup.py` | 飞书表结构补齐脚本（幂等） |

## 8. 未 Push — 留在本地等审查

所有 commits 仅在本地 main 分支，待审查通过后统一 push。
