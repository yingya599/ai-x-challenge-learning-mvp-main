# NSEAP 冒烟测试 Checklist — commit 8f9a8b8

> 环境：腾讯云 49.233.169.16（Docker 80:3000）。SSH 上去按顺序跑，预计 10 分钟。
> 前置：先 `docker ps` 确认 app 和 redis 容器名，下文用 `<app>` / `<redis>` 代指。

## 0. 部署与启动
- [ ] `git pull && docker build/compose` 部署最新 commit，确认镜像里是 8f9a8b8：
      `docker exec <app> cat .next/BUILD_ID` 或看部署日志
- [ ] `docker logs <app> 2>&1 | grep -E "\[bus\]"` 能看到两个 consumer 启动，无 crashed
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost/` → 200

## 1. Manifest / owner（§2.1）—— 启动即验证
- [ ] 启动日志**没有** `Manifest ... missing required "owner"` 报错
      （parse 在 import 时执行，能起来基本就过了）

## 2. 提交流程 + Ontology Memory（§3.3）
- [ ] 用测试学生账号登录，提交一个 Challenge（GitHub 链接随便一个真实 repo）
- [ ] 页面返回提交成功
- [ ] **memory 已写入**：
      `docker exec <redis> redis-cli HGETALL nseap:memory:student:<student_id>`
      期望：`learning_state=submitted`、`active_challenge_id`、`last_submission` 有值
- [ ] **TTL 生效**：
      `docker exec <redis> redis-cli TTL nseap:memory:student:<student_id>`
      期望：≈604800（7天）
- [ ] 飞书 Submission 表出现新记录（source of truth 没被绕过）

## 3. 路由三跳落盘（§8.1）
- [ ] `docker logs <app> 2>&1 | grep "Route trace persisted"`
      期望：`... (3 hops)` —— 3 跳，不是 1 或 2
- [ ] **等 ≥5 秒**（flush 定时器），去飞书 AuditLogs 表查最新记录：
      action=`route_trace`，after_state 里 route 数组含
      origin → forward → deliver，protocol 均为 `redis-stream/v1`
- [ ] 日志里**没有** `Route schema violation` warning

## 4. 教师评审 → memory 更新
- [ ] 教师账号对刚才的提交做终评
- [ ] 再查 `HGETALL nseap:memory:student:<student_id>`：
      `learning_state=reviewed`、`last_feedback` 有值、`updated_at` 变新

## 5. 懒重建（飞书 → Redis）
- [ ] `docker exec <redis> redis-cli DEL nseap:memory:student:<student_id>`
- [ ] 触发一次读（任何调 getStudentMemory 的路径；没有读接口的话跳过此项）
- [ ] 重查 HGETALL：`rebuilt_from_feishu_at` 有值，数据和飞书一致
- [ ] 重建期间无 `Rebuild failed` 日志

## 6. 降级行为（可选但建议）
- [ ] `docker stop <redis>` → 提交接口返回 503（总线铁律）
- [ ] app 日志只有 warn（`memory update skipped` 之类），**进程不崩**
- [ ] `docker start <redis>` → 30 秒内自动重连，再提交一次全流程恢复

## 7. 回归兜底
- [ ] 学生作品集页面正常显示
- [ ] 飞书群通知照常发出
- [ ] `docker logs <app> 2>&1 | grep -iE "unhandled|FAILED to flush"` 无输出

## 全绿后
- [ ] 打 tag：`git tag smoke-pass-$(date +%Y%m%d) && git push --tags`

---

> 提醒：
> - 第 3 步的"等 ≥5 秒"是关键——这次修的就是 flush 定时器，如果 AuditLogs 表迟迟没有 route_trace，说明定时器没跑起来
> - 第 5 步如果目前没有代码路径调 getStudentMemory（写是接了，读还没有消费方），会无法触发——那也是有用发现：下一轮该给 Companion Agent 加读记忆的场景
