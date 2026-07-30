# NSEAP Admin 控制台配置

## 必需配置

1. Admins 表至少包含 `admin_id`、`姓名`、`角色`；它是管理员身份的权威名单。
2. 设置一次性的 `ADMIN_BOOTSTRAP_TOKEN`，用于首次绑定密码和 TOTP。
3. Teachers 表建议增加字段：`feishu_open_id`、`teacher_agent_id`。
4. 新建 SystemConfig 表，字段为 `key`、`ciphertext`、`nonce`、`tag`、`key_version`、
   `hint`、`updated_at`、`updated_by`，并设置 `FEISHU_SYSTEM_CONFIG_TABLE_ID`。
5. 设置随机且仅服务器可见的 `ADMIN_CONFIG_MASTER_KEY`，建议使用 32 字节以上随机值。

## 首次登录

1. 打开 `/admin-login`，选择“首次使用？初始化管理员认证”。
2. 输入 Admins 表中的 `admin_id`、姓名、至少 12 位密码和 `ADMIN_BOOTSTRAP_TOKEN`。
3. 将只显示一次的 TOTP 密钥添加到 Microsoft Authenticator、Google Authenticator 或 1Password。
4. 返回登录，输入管理员 ID、密码和验证器生成的 6 位动态码。
5. 所有管理员完成初始化后，从部署环境删除 `ADMIN_BOOTSTRAP_TOKEN`。

## 权限与安全

- Admin 只能通过 ID、密码和 TOTP 登录；原 ID + 姓名登录拒绝 Admin。
- 密码使用 scrypt 哈希，TOTP 密钥使用 AES-256-GCM 加密后保存在 Redis。
- 密钥使用 AES-256-GCM 加密；浏览器与 API 永不返回密钥明文。
- 密钥轮换、用户停用、审批、死信重放要求登录后十分钟内完成。
- 所有危险操作必须填写原因并写入管理员审计。
- 停用是软删除；系统禁止停用最后一个有效 Admin。

## 当前存储说明

密钥密文存入飞书 SystemConfig 表，并以服务器环境变量为读取兜底。加密格式为
`ciphertext / nonce / tag / key_version / hint / updated_at / updated_by`；主密钥不进入飞书。

## 飞书应用权限

至少启用身份认证、获取用户 open_id，以及目标多维表格的记录读取和写入权限。
生产发布前使用 `/admin` → “开发诊断”确认所有表、Redis、AI、GitHub 与通知状态。
