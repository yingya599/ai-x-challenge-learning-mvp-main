# NSEAP Challenge 系统 + 教师端重构 提示词

> 仓库：`/Users/zhanghao/elite20-merge/merged`（Next.js 15 + TS，App Router）
> 全局约束：
> 1. 只改任务卡列出的文件，新增文件须在卡内声明。
> 2. 改完必须 `npx tsc --noEmit` 零错误。
> 3. 不得删除或绕过现有审计日志（AuditTrail / audit-outbox）。
> 4. 所有错误响应保持 `{ ok: false, error: string }` 格式。
> 5. 不提交 .env*、不打印任何密钥到日志。

---

## C01 · GitHub Challenge 仓库体系

**背景**：现在 Challenge 内容（说明、交付物、评分标准）散落在飞书表字段里，学生看不到完整详情。需要建立 GitHub 仓库体系统一管理。

**改动**：
1. 用 gh CLI 创建主仓库 `nseap-elite20-challenges`（org: a976xw7td），设为公开。
2. 主仓库结构：
   ```
   README.md           ← 平台介绍（NSEAP 是什么、Elite20 项目背景）
   challenges.md       ← 挑战清单表格（编号、名称、难度、一句话、仓库链接）
   ```
3. 创建约 10 个独立子仓库，命名格式 `challenge-{编号}-{英文简称}`，每个结构：
   ```
   README.md           ← 挑战说明、背景、目标
   REQUIREMENTS.md     ← 交付物清单、验收标准
   RUBRIC.md           ← 评分标准（五个维度各多少分）
   ```
4. 挑战内容参照飞书 Challenge 表已有数据（`elite20-builder-program-nseap` 设计仓库的 Challenge Library）。
5. 主仓库 challenges.md 更新为表格，每行一个挑战，链接到对应子仓库。

**验收**：主仓库和子仓库均可在浏览器打开，challenges.md 表格链接可点击跳转。

---

## C02 · 飞书 Challenge 表 + API 扩展

**背景**：前端只取了 `title` 和 `brief`，rubric/deliverables/github_repo 等字段都没传过来。

**改动**：
1. 飞书 Challenge 表加字段 `github_repo`（类型=1 文本）。用已有的 `scripts/ensure-feishu-fields.py` 风格或飞书 API 直接加。已经在表里的 Challenge 填上对应仓库 URL。
2. `lib/server/types.ts` Challenge 类型加 `github_repo?: string`。
3. `lib/server/feishu.ts` normalizeChallenge 加 `github_repo` 映射（中文名 "GitHub仓库"）。
4. `lib/api.ts` fetchChallenges 的返回类型扩展：加 `deliverables`、`rubric`、`deadline`、`skills`、`github_repo`、`brief`、`objective`、`learning_objectives`、`required_deliverables`。
5. `lib/data.ts` mock Challenge 也同步加这些字段（mock 数据随便填，保证离线能跑）。

**验收**：curl `/api/challenges` 返回的 JSON 里每个 challenge 包含 deliverables、rubric、github_repo 等字段。

---

## C03 · 学生端 Challenge 详情页

**背景**：`app/(app)/challenges/[id]/page.tsx` 现在只显示标题+一句话，没有交付物、评分标准、GitHub 链接。

**改动**：
1. 详情页从 `/api/challenges` 获取完整数据（不只用 id/title/description）。
2. 页面布局：
   - **顶部**：挑战标题 + 状态标签 + 难度标签
   - **目标区**：objective / learning_objectives 渲染
   - **交付物区**：deliverables / required_deliverables 渲染成列表
   - **评分标准区**：rubric 渲染（文本或格式化展示）
   - **技能标签**：skills 以 tag 形式展示
   - **截止时间**：deadline 显示
   - **GitHub 按钮**：只有一个 GitHub 图标（用 lucide-react 的 Github 图标），点击跳转到 github_repo URL。hover 显示 tooltip "在 GitHub 查看"
   - **提交按钮**：保留现有的"提交 Challenge"按钮
3. 如果数据来自飞书实时返回则用实时数据，飞书不可用时 fallback 到 lib/data.ts mock。

**验收**：打开 `/challenges/c01`（或任意存在的 ID）能看到完整的挑战说明+交付物+评分标准+GitHub 图标按钮。

---

## C04 · 教师端挑战概览表

**背景**：教师控制台现在只有一个"全班提交大列表"，所有 Challenge 混在一起。需要加一个按 Challenge 分组的总览。

**改动**：
1. `app/(app)/teacher/page.tsx`：在统计卡片下方、筛选区域上方，新增"挑战概览"区域。
2. 从 `/api/challenges` 取所有挑战，结合提交数据计算每个 Challenge 的统计：
   - 已提交人数 / 总学生人数
   - 待评审数
   - 平均分
3. 表格布局：
   ```
   | 挑战名称 | 已提交/总人数 | 待评审 | 平均分 | 操作 |
   |----------|:----------:|:-----:|:-----:|------|
   | C01 xxx  |   15/20    |   3   |  82   | 查看 |
   ```
4. 点击"查看"→ 筛选下方提交列表（只显示该 Challenge 的提交）。状态筛选按钮保留。
5. 默认显示"全部挑战"（不筛选）。点某个挑战后该行高亮。
6. 如果 challenges 为空（飞书不可用），用 mock 数据兜底。

**验收**：教师登录后看到挑战概览表，点某个挑战后下方提交列表自动过滤。

---

## C05 · 教师端批改弹窗优化

**背景**：现有批改弹窗只有"确认"和"打回"两个按钮，没有备注框和分数输入。需要让弹窗更实用。

**改动**：
1. 保留现有的 review modal（`/teacher/page.tsx` 里的 reviewTarget 状态）。
2. 优化弹窗内容：
   - 显示学生 GitHub 仓库链接（可点击跳转）
   - 显示 AI 初评分数（如果有）
   - 分数输入框（0-100，默认 80）
   - 评语输入框（textarea，必填，提示"对学生作品的评价..."）
   - 两个按钮："确认通过 ✓"（绿色）和"退回修改 ✗"（红色），都调用现有的 `handleReview`
   - 底部"取消"按钮
3. 代码已有 review modal 雏形，只需补充 GitHub 链接和 AI 评分展示。

**验收**：点提交列表某行的"批改"按钮→弹出弹窗→可以看到学生仓库链接和 AI 评分→输入分数和评语→点通过/退回→弹窗关闭→提交列表刷新。

---

## C06 · 导出 Excel

**背景**：教师需要下载全班成绩表。

**改动**：
1. 教师控制台顶部或挑战概览区加一个"导出 Excel"按钮（lucide-react Download 图标）。
2. 点击后生成 Excel（.xlsx 或 .csv），包含：
   - 列：学生姓名、学生ID、挑战名称、GitHub 仓库、提交时间、AI 评分、最终评分、状态
3. 实现方式：纯前端生成 CSV（用 Blob + URL.createObjectURL），不需要后端 API。
4. CSV 文件名：`nseap-submissions-{日期}.csv`。

**验收**：点击导出→浏览器下载 CSV 文件→用 Excel/WPS 打开能看到完整的提交数据。

---

## 执行顺序

```
C01（GitHub 仓库）→ 可先做，独立
C02（API 扩展）→ C03 依赖 C02
C03（学生详情页）→ 依赖 C02
C04（教师概览）→ 依赖 C02
C05（批改弹窗）→ 依赖 C04（共用提交列表）
C06（导出 Excel）→ 不依赖其他，可并行
```

建议顺序：C01 → C02 → C03 + C04 + C06 并行 → C05
