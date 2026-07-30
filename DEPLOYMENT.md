# NSEAP 部署指南

## 快速部署（Docker）

### 前置条件

- Docker 24+
- Docker Compose v2+

### 部署步骤

```bash
# 1. 克隆项目
git clone https://github.com/nseap/nseap-platform.git
cd nseap-platform

# 2. 构建并启动
docker compose up -d --build

# 3. 访问
open http://localhost:3000
```

### 停止服务

```bash
docker compose down
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3000 |
| NODE_ENV | 运行环境 | production |

## 手动部署

### 前置条件

- Node.js 20+
- npm 10+

### 部署步骤

```bash
# 1. 安装依赖
npm ci

# 2. 构建
npm run build

# 3. 启动
npm run start
```

### PM2 进程管理

```bash
npm install -g pm2
pm2 start npm --name "nseap" -- start
pm2 save
pm2 startup
```

## CI/CD

项目使用 GitHub Actions 进行持续集成：

- 代码推送后自动运行 lint + build
- PR 提交时自动运行检查
- 合并到 main 分支后自动构建

## 系统要求

| 资源 | 最低 | 推荐 |
|------|------|------|
| CPU | 1 核 | 2 核 |
| 内存 | 512 MB | 1 GB |
| 磁盘 | 500 MB | 1 GB |
| 网络 | 公网或校内可达 | 公网可达 |
