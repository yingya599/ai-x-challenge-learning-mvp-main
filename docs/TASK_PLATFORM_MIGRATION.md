# 任务管理平台飞书迁移说明

本次迁移不删除旧 Challenge、Submission 或 Evaluation。应用在新表未配置时会用历史数据生成只读任务视图，便于先验收页面。

## 安全执行顺序

1. 确认 `.env.local` 中已有飞书应用和原表 ID。
2. 运行 `python scripts/migrate-task-platform.py` 查看 dry-run 计划。
3. 确认新增字段和 Tasks 新表无误后，运行 `python scripts/migrate-task-platform.py --apply`。
4. 脚本在修改前把现有表字段和记录保存到 `docs/migration-snapshots/<时间>/`。
5. 将脚本输出的 `FEISHU_TASKS_TABLE_ID` 写入本地 `.env.local`。
6. 重启本地服务并验收领导、带教、实习生三种身份。

## 角色迁移

- 旧 `teacher` 在代码中自动按 `mentor`（带教）兼容。
- 需要全局业务视角的账号，在 Teachers 表的角色字段填写 `leader`。
- 在 Students 表填写 `带教ID`。带教接口始终严格按该字段过滤，不再回退显示整个班级。
- `admin` 保留系统配置权限，不应作为日常业务领导账号使用。

## 回退

回退代码时，新字段和新表可以保留，不影响旧页面；不要删除历史表。若迁移中断，先查看快照和脚本输出，再重新执行 dry-run。
