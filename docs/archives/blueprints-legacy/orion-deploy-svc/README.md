# orion-deploy-svc

Orion Platform 部署管理服务，负责管理应用部署、环境配置和金丝雀分析。

## 概述

从 `orion-platform-service` 中提取的独立部署管理服务。

### 核心功能

- 创建、查询、列表部署
- 部署回滚
- 环境管理（增删改查、配置更新）
- 金丝雀分析（与 orion-monitor-svc 集成）

### 服务依赖

| 服务 | 用途 | 环境变量 |
|------|------|----------|
| orion-pipeline-svc | 触发部署流水线 | `PIPELINE_SERVICE_URL` |
| orion-monitor-svc | 部署后监控与指标 | `MONITOR_SERVICE_URL` |
| orion-platform-core | 租户、项目验证 | `PLATFORM_CORE_URL` |

## API 端点

### Deployments

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/v1/deployments` | 创建部署 |
| `GET` | `/api/v1/deployments` | 列表部署 |
| `GET` | `/api/v1/deployments/:id` | 获取部署详情 |
| `POST` | `/api/v1/deployments/:id/rollback` | 回滚部署 |

### Environments

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/v1/environments` | 列表环境 |
| `POST` | `/api/v1/environments` | 创建环境 |
| `GET` | `/api/v1/environments/:id` | 获取环境详情 |
| `POST` | `/api/v1/environments/:id/config` | 更新环境配置 |

### 健康检查

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/health` | 服务健康检查 |
| `GET` | `/ready` | 服务就绪检查 |

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 设置环境变量
cp .env.example .env

# 启动依赖服务（PostgreSQL, Redis）
docker compose up -d redis postgres

# 启动开发服务器
npm run dev
```

### Docker

```bash
# 构建镜像
docker compose build

# 启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f deploy-svc
```

## 项目结构

```
src/
  app.ts                    # Fastify 应用入口
  routes/
    deploy.ts               # 部署相关路由
    environment.ts          # 环境相关路由
  services/
    DeployService.ts        # 部署核心业务逻辑
    EnvironmentService.ts   # 环境管理业务逻辑
    CanaryAnalysisService.ts # 金丝雀分析业务逻辑
  types/
    deploy.ts               # 类型定义
  middleware/               # 自定义中间件（待实现）
```

## 技术栈

- **Runtime:** Node.js >= 20
- **Framework:** Fastify 5.x
- **Language:** TypeScript 5.x
- **Database:** PostgreSQL 16 (待接入 ORM)
- **Cache:** Redis 7 (待接入)
- **Container:** Docker + Docker Compose
