# NSEAP 项目交接提示词

> 给下一个会话（Codex / Hermes），无上下文也能接手

---

## 一、我们在做什么

**NSEAP 智能教育平台** — Elite20 Builder Program 的核心交付物。

- 学生/教师/管理员三端 Web 平台（Next.js 15 + TypeScript）
- 10 个 Challenge，每个有独立 GitHub 仓库
- Companion Agent 接入（学生用 AI 助手提交作业）
- 飞书深度集成（数据存多维表，Bot 发通知）
- 云端已部署：`http://49.233.169.16`

**当前阶段**：准备给东方国信王总的 PPT 演示。Richard（项目负责人）会发大纲，我们提前整理了素材。

---

## 二、已完成的任务

### 2.1 安全修复（T01-T09）
- RBAC 权限体系（`lib/server/rbac.ts`）
- 4 个 API 零鉴权漏洞修复
- Agent 越权提交修复
- AI 评分 zod 校验 + rubric 注入
- 互评封闭化 + 分数校验
- 教师/管理员飞书表 + 异步角色解析
- Session 过期 + timingSafeEqual + 登出
- API Key 哈希存储 + 轮换 + 立即失效
- 前端角色化 + 中间件路由守卫

### 2.2 Challenge 系统（C01-C06）
- 11 个 GitHub 仓库（1 主仓 + 10 子仓）
- Challenge API 完整字段（deliverables/rubric/github_repo）
- 学生详情页（目标+交付物+评分标准+GitHub 图标）
- 教师挑战概览表（按挑战分组统计）
- 教师提交列表 + 筛选
- 批改弹窗（GitHub 链接+AI 评分显示+打分评语）
- 导出 Excel 按钮

### 2.3 飞书 Bot 绑定
- Students 表加 `飞书AppID` + `飞书AppSecret` 字段
- 个人中心加绑定 UI
- `notify.ts` 支持学生自有 Bot 发通知

### 2.4 演示准备
- 两份 PPT 素材文档在桌面：`NSEAP_PPT素材_已完成.md` + `NSEAP_PPT素材_待做.md`

---

## 三、当前状态

### 3.1 代码位置
```
~/elite20-merge/merged/          ← 平台代码（122 文件）
~/elite20-builder-program-nseap/ ← 设计文档仓库
~/Downloads/重构AI+X/chat-logs/Richard资料合集/7.14/ ← Richard 最新资料
```

### 3.2 GitHub 仓库
```
ai-x-challenge-learning-mvp       ← 主平台代码
nseap-elite20-challenges          ← 挑战主仓库
challenge-01 ~ challenge-10       ← 10 个独立挑战仓库
```

### 3.3 云端
| 项 | 值 |
|----|-----|
| IP | 49.233.169.16 |
| SSH | `ssh ubuntu@49.233.169.16` |
| 路径 | `/home/ubuntu/nseap` |
| 部署 | `sudo docker compose down && sudo docker compose up -d --build app` |

### 3.4 启动命令
```bash
cd ~/elite20-merge/merged
npx next dev -p 3000    # 本地运行
npx tsc --noEmit        # 类型检查
```

### 3.5 飞书表（9 张）
Students / Challenges / Submissions / Evaluations / PortfolioItems / AuditLogs / InboxQueue / Teachers / Admins

### 3.6 登录方式
| 身份 | ID | 姓名 |
|------|-----|------|
| 教师 | 2023108600143 | 张麻子 |
| 管理员 | 2023108600143 | 张麻子 |
| 开发用 | stu_zhanghao_001 | 张浩 |

---

## 四、目前卡在哪里

**没有卡住**。全流程可跑。

唯一待确认：Richard 还没发 PPT 大纲，所以 PPT 还没开始做——素材已经准备好了。

---

## 五、下一步计划

### 5.1 等 Richard 发大纲 → 做 PPT
素材在桌面：`NSEAP_PPT素材_已完成.md`

### 5.2 课程内容接入 LMS
现在 LMS 页面是空的。Richard 资料 `7.14/Elite20_Contents/Lectures/curriculum/` 里有 5 周课程大纲，需要结构化存到 LMS 页面。

### 5.3 Ontology 知识图谱
Richard 提的核心方向。把课程→知识点→Challenge→学生作品串成知识图谱。

### 5.4 Richard 7.14 资料整合
| 资料 | 放哪里 | 优先级 |
|------|--------|:------:|
| 5 周课程大纲 | LMS 页面 | 🔴 |
| KSTAR 评估框架 | 教师端 | 🟡 |
| 教师操作手册 | 教师端 | 🟡 |
| 学生执行手册 | LMS | 🟡 |

---

## 六、最近 commit 记录

```
f0008f6 fix: skip ESLint during Docker build
4fe241a feat: per-student Feishu Bot binding + notify with own bot
da72b54 fix: challenge detail page uses real API data, sidebar links to C01
9ea63ed feat: C01-C06 Challenge system + teacher console overhaul
6fc78bf fix: teacher login via TEACHER_IDS + Feishu Teachers/Admins tables
```

---

## 七、Codex 接手后第一件事

1. `cd ~/elite20-merge/merged && npx next dev -p 3000` 拉起来
2. 浏览器打开 `http://localhost:3000`，看能不能跑
3. 读桌面上的 `NSEAP_PPT素材_已完成.md` 了解现状
4. 等 Richard 大纲 → 开始做 PPT
