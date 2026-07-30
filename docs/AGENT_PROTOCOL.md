# NSEAP Agent Protocol v1.0

> 本文件定义外部 AI Agent（Hermes CLI、WorkBuddy、Claude Code、Codex、Raymond 等）与 NSEAP 后端通信的完整协议。所有 Agent 间消息强制经 Redis Stream 总线入队（§5.0），不直接写业务表。

## 1. 获取凭证

学生登录 `{server}/login` → 个人中心 → 下载 `NSEAP-config-{学号}.json`。

## 2. 认证

所有请求携带 HTTP 头：

```
x-api-key: {api_key}
```

失败返回 `401 Unauthorized`。

## 3. 消息格式

### 3.1 提交作业

```
POST {server}/api/hermes
```

**请求体：**

```json
{
  "message_type": "submission_request",
  "to_agent": "submission-task-agent-001",
  "payload": {
    "studentId": "stu_zhanghao_001",
    "challengeId": "cha_demo_001",
    "projectTitle": "我的项目",
    "projectSummary": "项目简介",
    "githubRepoUrl": "https://github.com/user/repo",
    "aarText": "AAR 复盘内容",
    "selfEvaluationText": "自评内容",
    "isPublic": true
  }
}
```

**成功响应（HTTP 200）：**

```json
{
  "ok": true,
  "task_id": "task-20260712123416-d46tnt"
}
```

**失败响应（HTTP 503）：**

```json
{
  "ok": false,
  "error": "消息总线不可用"
}
```

**处理流程：** 消息 → Envelope v2 → Redis Stream 入队 → consumer → Submission Task Agent → 飞书写入 → 飞书 Bot 通知。

### 3.2 健康检查

```
GET {server}/api/health
```

### 3.3 Agent 列表

```
GET {server}/api/agents
```

## 4. 传输层

当前实现：Redis Stream（P1b–P2）。P3 迁至 Hermes/OpenClaw 协议。消息信封格式（Envelope v2）跨阶段不变，只换传输层（ADR-001）。

## 5. 约束

- Agent 通道（x-api-key 认证）提交必须经消息总线入队，Redis 不可用时返回 503，不做同步降级。
- 禁止 Agent 通道直接写飞书业务表。
- 所有消息含 from_agent、to_agent、audit_trace_pointer，可追溯。
