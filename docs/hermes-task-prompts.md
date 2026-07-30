# NSEAP 修复任务提示词（交 Hermes 执行，张昊审查）

> 仓库：`/Users/zhanghao/elite20-merge/merged`（Next.js 15 + TS，App Router）
> 全局约束（每个任务都必须遵守）：
> 1. 只改任务卡列出的文件，新增文件须在卡内声明。
> 2. 改完必须 `npx tsc --noEmit` 零错误。
> 3. 不得删除或绕过现有审计日志（AuditTrail / audit-outbox）。
> 4. 所有错误响应保持 `{ ok: false, error: string }` 格式。
> 5. 不提交 .env*、不打印任何密钥到日志。
> 6. 每个任务卡末尾的"验收标准"必须逐条自测并在回复中贴出证据（命令+输出）。

---

## T01 · 权限基础设施：统一 RBAC 助手（先做，后续任务全依赖）

**背景**：现在各接口用 `principal.role !== "teacher"` 硬编码判断，admin 被误拒（如 /api/evaluations），学生 Agent（role="agent"，person="student-companion-<学号>"）绕过行级过滤。

**改动**：
1. 新建 `lib/server/rbac.ts`，导出：
   - `getBoundStudentId(principal): string | null` — role 为 "student" 返回 person；role 为 "agent" 且 person 匹配 `/^student-companion-(.+)$/` 返回捕获组；其余返回 null。
   - `isStaff(principal): boolean` — role ∈ {teacher, admin, ta}。
   - `isAdmin(principal): boolean` — role ∈ {admin, system}。
   - `can(principal, action): boolean` — 权限矩阵，action 至少含：`view_all_submissions`、`view_roster`、`publish_challenge`、`finalize_review`、`view_agents`、`manage_agents`。矩阵用常量对象定义，禁止在接口里再写角色字符串比较。
2. 不改任何路由（后续任务改）。

**验收**：单元自测脚本（可用 `npx tsx` 内联）验证 getBoundStudentId 对 student / student-companion-S001 / teacher / 无关 agent 四种输入的输出。

---

## T02 · 数据泄漏修复：/api/students、/api/portfolio、/api/github/check、/api/tasks/[id]

**背景**：四个接口零鉴权。students 还泄漏全员 `api_key` 与 `feishu_open_id`（等于全员账号接管）。github/check 可烧光 GITHUB_TOKEN 配额并探测 token 可见的私有仓库。

**改动**：
1. `app/api/students/route.ts`：未登录 401；`can(p,"view_roster")` 者看全部，否则只返回 `getBoundStudentId(p)` 匹配的自己；**响应中剥离 `api_key`、`feishu_open_id` 字段（对所有角色，包括教师）**。
2. `app/api/portfolio/route.ts`：未登录 401。已发布作品集对登录用户可见（作品集本就是展示用），但仅 staff 可见非 `published` 状态条目（查看 `lib/server/feishu.ts` 的 portfolio 字段确定状态字段名，若无状态字段则全部登录可见并在代码注释注明）。
3. `app/api/github/check/route.ts`：未登录 401；加基于 Redis 的限流：每 principal 每小时 30 次（复用 message-handler.ts 的 ratelimit key 模式，key 前缀 `ratelimit:ghcheck:`；Redis 不可用时放行）。
4. `app/api/tasks/[id]/route.ts`：未登录 401；`task.student_id` 不等于 `getBoundStudentId(p)` 且非 staff → 403。

**验收**：无 cookie curl 四个接口均 401；学生 session 请求 students 只见自己且无 api_key 字段。

---

## T03 · Agent 越权提交修复

**背景**：`app/api/submit/route.ts` 行级校验只针对 role==="student"，学生 Agent（role="agent"）可用 `input.studentId` 冒充任何学生提交。

**改动**：
1. `app/api/submit/route.ts`：用 `getBoundStudentId(principal)` 取绑定学号；若非 null 且 `input.studentId !== bound` → 403 + 现有的 identity_mismatch 审计（把 agent 通道也纳入）。staff 提交（bound 为 null 且 isStaff）放行。既非绑定学生也非 staff → 403。
2. `lib/server/workflow.ts` `submitChallengeProject`：新增可选参数 `enforcedStudentId?: string`，传入时若与 `input.studentId` 不一致直接返回失败并写审计（纵深防御，两层都校验）。submit 路由的同步回退路径传入该参数。

**验收**：用学生 A 的 api_key（x-api-key 头）POST /api/submit 提交 studentId=B → 403 且审计出现 identity_mismatch。

---

## T04 · AI 打分成熟化：rubric 注入 + 运行时校验 + 失败可观测

**背景**：`lib/server/ai.ts` prompt 写死五维各 20 分，AI 返回 JSON 直接 `as AiEvaluation` 强转（undefined 分数事故根因）；catch 静默返回 76 分 fallback，线上配置坏了无人知晓。对标 Gradescope：评分必须 rubric 驱动、结构化、可追溯。

**改动**（只改 `lib/server/ai.ts`，如需类型改 `lib/server/types.ts`）：
1. `evaluateSubmission` 读取 `input.challenge` 中的 rubric 字段（先查看 feishu.ts 的 challenge normalize 确认字段名；若挑战无 rubric，用现有五维作为默认 rubric），把 rubric 文本注入 system prompt，明确要求各维度分数区间与总分=各维之和。
2. 用 zod（项目已有依赖，见 lib/schemas）定义 `AiEvaluationSchema`：五个分项 0–20 整数、scoreTotal 0–100、strengths/weaknesses/suggestions/feedback 非空字符串。`callAiJson` 结果 safeParse，失败则重试 1 次，再失败走 fallback。
3. 校验通过后强制 `scoreTotal = 各分项之和`（不信任模型加法）。
4. 所有 fallback 路径 `console.error("[ai] fallback:", 原因)`，并在返回对象 `fallbackReason` 字段注明（types.ts 给 AiEvaluation 加可选字段）。

**验收**：mock 一个返回缺字段 JSON 的场景（临时脚本调 schema）证明 safeParse 拦截；tsc 通过。

---

## T05 · 互评封闭化 + 分数校验（对标 Moodle Workshop）

**背景**：`app/api/evaluations/route.ts` 允许任何学生"unsolicited peer review"任意提交，可刷分；score 无范围/NaN 校验；admin 在 GET/POST 被 403。

**改动**（`app/api/evaluations/route.ts`、`lib/server/review-workflow.ts`）：
1. 删除 unsolicited peer review 分支：没有分配 placeholder 的学生提交互评 → 403 "你未被分配评审此提交"。
2. 所有 score 入口统一校验：`Number.isFinite(n) && n >= 0 && n <= 100`，否则 400。teacherFinalizeReview 内部同样校验（纵深）。
3. 角色判断全部换成 T01 的 `can()`/`isStaff()`：admin 可读全部评审、可执行 teacher 最终评审。
4. GET 的 N+1 修复：不要对每个 submission_id 调 getSubmissionById（每次全表扫），改为调用一次 `feishu.getSubmissions()` 建 Map 后查表。

**验收**：未分配学生 POST peer 评审 → 403；score=9999 → 400；admin session GET → 200。

---

## T06 · 飞书 Teachers / Admins 表 + 角色解析重构

**背景**：教师身份靠 TEACHER_IDS 环境变量；`determineRole` 读 `student["role"]` 是死代码（normalizeStudent 未映射 role 字段）。

**改动**：
1. 新建 `scripts/setup-teachers-admins-tables.py`（模仿 scripts/t15-feishu-setup.py 的幂等风格）：创建 `Teachers` 表（teacher_id, name, email, role, api_key_hash, class_id, status）与 `Admins` 表（admin_id, name, email, role, api_key_hash, status），把表 ID 追加写入 .env.local（已存在则跳过），并打印到 stdout。
2. `lib/server/feishu.ts`：新增 `getTeachers()` / `getAdmins()` / `getTeacherById()` / `getAdminById()`，字段 normalize 与 Students 同风格；表 ID 环境变量 `FEISHU_TEACHERS_TABLE_ID` / `FEISHU_ADMINS_TABLE_ID`。
3. `lib/server/principal.ts` `determineRole` 重写：依次查 Admins → Teachers → Students 决定角色（需要变 async；调用方同步修改）；TEACHER_IDS 保留为兜底并打 deprecation warning。
4. 给 Students normalize 补上 `role` 字段映射（若表里有）。

**验收**：脚本跑两遍第二遍全部 "already exists"；.env.local 出现两个新表 ID。

---

## T07 · 登录体系重构：通用登录 + 会话过期 + 登出

**背景**：登录页只认学生；无登出；session token 无 exp（cookie 被盗永久有效）；HMAC 比较非常量时间。对标：所有成熟产品会话必有过期+登出+吊销。

**改动**：
1. `app/api/auth/login/route.ts`：改为通用登录——先查 Admins，再 Teachers，再 Students（用 T06 的函数）；按命中的表定角色。**登录响应不再返回 api_key**（#17）。
2. `lib/server/principal.ts`：signToken payload 加 `iat`/`exp`（24h）；verifyToken 校验 exp，HMAC 比较改 `crypto.timingSafeEqual`。
3. 新建 `app/api/auth/logout/route.ts`：POST，清除 nseap_session cookie，返回 `{ok:true}`。
4. cookie secure 逻辑：`process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production"`。
5. 登录成功响应加 `redirect` 字段：student→`/dashboard`，teacher→`/teacher`，admin→`/teacher`（暂用教师台）；`app/(public)/login` 页面按该字段跳转（原来写死跳提交页的地方一并改）。

**验收**：登录响应无 api_key 字段且含 redirect；篡改 cookie 中 exp 后请求 /api/auth/me → 401；POST /api/auth/logout 后 /api/auth/me → 401。

---

## T08 · API Key 生命周期（对标 GitHub PAT）

**背景**：key 用 Math.random 生成、明文存飞书（任何能看 Bitable 的人全拿走）、永不过期、/api/auth/me 每次返回。

**改动**：
1. `lib/server/agent-auth.ts`：`generateApiKey` 改用 `crypto.randomBytes`；新增 `hashApiKey(key)`（sha256 hex）。
2. 存储改为哈希：Students 表新字段 `api_key_hash`（写个幂等迁移脚本 `scripts/migrate-api-key-hash.py`：读现有明文 api_key → 写入 hash 字段；明文字段暂保留但代码不再读）。`resolveStudentApiKey` 改为比对 hash。
3. 新建 `app/api/auth/api-key/route.ts`：
   - POST（需登录）：生成新 key，存 hash + `api_key_rotated_at`，**明文只在本次响应返回一次**。
   - 旧 key 宽限：`api_key_hash_prev` 字段保留上一个 hash，`api_key_rotated_at` 超 30 天后 resolve 时不再接受 prev。
4. `/api/auth/me` 与登录响应不再返回 api_key；`app/(app)/profile/page.tsx` 改为"重新生成 API Key"按钮调 POST 接口并一次性展示。
5. resolveStudentApiKey 加 60s 内存缓存（Map<hash, principal>）避免每请求全表扫。

**验收**：登录/me 响应无 key；POST api-key 返回明文一次；用新 key 走 x-api-key 调 /api/submissions 成功、旧 key（模拟 rotated_at 31 天前）失败。

---

## T09 · 前端角色化 + 路由守卫

**背景**：侧边栏不分角色（#12）、Header 写死 "Builder"（#13）、无 middleware（#14）、首页不判断登录（#15）。

**改动**：
1. 新建 `middleware.ts`（项目根）：`/(app)` 组下所有路径（dashboard、submit、submissions、teacher、profile、portfolio、challenges、lms、github、knowledge、docs）检查 nseap_session cookie 存在性（middleware 为 edge，不做 HMAC 验证也可，但若 SESSION_SECRET 可用则验证），缺失→ redirect `/login?next=<path>`。`/api/*`、`/login`、`/`、静态资源放行。
2. `components/Sidebar.tsx`：navItems 加 `roles` 字段，按 `/api/auth/me` 的 role 过滤；teacher 菜单学生不可见。
3. `components/Header.tsx`：调 `/api/auth/me` 显示真实 name（加载中显示占位而非 Builder）；加"登出"按钮调 POST /api/auth/logout 后跳 /login。
4. `app/(public)/page.tsx`：已登录（me 返回 200）显示"进入控制台"按钮（按角色跳 dashboard/teacher），未登录显示"登录"。

**验收**：无 cookie 访问 /dashboard 被 302 到 /login；学生登录后侧边栏无教师菜单；Header 显示真实姓名。

---

## T10 ·（后置，需产品确认后再做）GitHub OAuth 登录

**背景**：学号+姓名登录在花名册可被猜测的前提下等于无认证。成熟产品（GitHub Classroom）用 GitHub OAuth，而我们学生本来就提交 GitHub 仓库，天然契合。
**先出设计不写码**：OAuth 流程、Students 表 github_username 绑定与首登匹配策略、与现有 session 的融合、降级路径（无 GitHub 账号的学生用邮箱验证码）。产出 `docs/oauth-design.md` 供审查。

---

## 附：小修集（可合并成一个任务）

- `lib/server/workflow.ts` allocatePeers 的 `sort(() => Math.random()-0.5)` 改 Fisher-Yates。
- Evaluations 增加 `status` 字段（pending/completed）替代"feedback 是否为空"判断（需建字段+读写两侧改，注意兼容存量数据：无 status 的旧记录按 feedback 判断）。
- `app/api/submit/route.ts` 等处 `enqueue(audit.entries); flush();` → `await flush()`。
- `.gitignore` 加 `tsconfig.tsbuildinfo`。
- `/api/challenges` GET 确认 rubric/内部字段是否应对未登录可见，如含评分答案性内容则登录可见。

## 执行顺序与依赖

```
T01 → T02, T03, T05（依赖 rbac）
T06 → T07 → T08, T09
T04、附录小修集 无依赖，可并行
T10 设计先行
```
