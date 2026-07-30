# P1a 小班试运行验收结果 — 2026-07-12

> 操作人：Claude（受张浩委托实测）　验收人：张浩　环境：dev server :3333，真实飞书表，真实 GitHub API
> TEACHER_IDS=stu_zhanghao_001（张浩本人同时为学生与教师）

## 结果总览：**有条件通过**（唯一未验项为第 5 步真实通知接收，属环境权限问题，非代码问题）

### 第 1 步：学生登录（T9）✅
| # | 结果 |
|---|------|
| 1.2 | 不存在的学生 ID → `{"ok":false,"error":"学生ID不存在或未导入系统"}` ✅ |
| 1.3 | stu_zhanghao_001 + 张浩 → `{"ok":true,"role":"teacher"}` ✅ |
| 1.4 | 错误姓名 → `{"ok":false,"error":"姓名不匹配"}` ✅ |

### 第 2 步：查看 Challenge（T10/T14）✅
- `/api/challenges` 返回飞书真实数据（cha_demo_001，完整字段）✅

### 第 3 步：提交项目（T7/T8/T10）✅
- 提交成功：`sub_20260711164518_z2zce9`
- GitHub 真实检查：repoExists/readmeExists 均 true，latestCommitSha=6150546，score=100 ✅
- AI 初评五维：18/15/16/17/18 ✅
- auditTrail 完整（send_submission_request → verify_relationship → validate_student_identity → validate_challenge → verify_github_pointer → …）✅
- Evaluations 新增 `eval_20260711164520_qwe5ex`，Portfolio 新增 `pf_20260711164524_k5thh0` ✅

### 第 4 步：教师评审（T11）✅
- POST /api/evaluations accept/88 分 → `eval_20260711164554_szyo7y` ✅
- 飞书 Submissions 表实测：`状态=accepted`，`task_state=COMPLETED` ✅

### 第 5 步：通知验证（T8/T16）⚠️ 有条件通过
- 5.4 无 feishu_open_id → 通知降级，AuditLogs 中 `notify_failed` 共 6 条（含本次新增），T16 修复实测生效 ✅
- 5.1–5.3 真实接收 **未验**：bot 缺 `contact:user.id:readonly` 权限，无法由邮箱解析 open_id；
  待办：开通权限（https://open.feishu.cn/app/cli_aacd97da8ea49be2/auth?q=contact:user.id:readonly）
  或手动填入张浩的 open_id 后复测。

### 第 6 步：权限验证（T9/T10）✅
| # | 结果 |
|---|------|
| 6.1 | 学生身份（stu_demo_001）调评审 API → 403 ✅ |
| 6.3 | 学生看他人提交 → 403 "无权查看此提交" ✅ |
| 6.4 | 无 Cookie 访问 API → 401 ✅ |
| 6.5 | 篡改 session Cookie → HMAC 验签失败 401 ✅ |

### 第 7 步：数据一致性 ✅
- 7.1 task_state 列存在且被正确写入（COMPLETED）✅
- 7.2 无空 student_id 脏记录 ✅

## 遗留事项
1. **feishu_open_id 填充**：开通 contact 权限后跑脚本回填，复测第 5 步 5.1–5.3。
2. **portfolio 页面残留 mock**（`app/(app)/portfolio/page.tsx` 用 mockPortfolioItems 作初始值）——已列入 P1b 任务。
