# Orion Microservices Orchestrator

一个 orchestrator monorepo，用于统一管理 9 个 Orion 微服务。通过 Docker Compose 编排所有服务，提供统一的开发、构建和部署体验。

## 架构概览

```
                    ┌─────────────────────────────────┐
                    │         API Gateway              │
                    │      orion-gateway :3000         │
                    │     (Express + http-proxy)       │
                    └────────────┬────────────────────┘
                                 │ 路由分发
          ┌──────────┬───────────┼───────────┬──────────┐
          │          │           │           │          │
    ┌─────┴────┐ ┌───┴────┐ ┌───┴────┐ ┌───┴────┐ ┌───┴────┐
    │ Platform │ │Pipeline│ │ Deploy │ │ Ticket │ │Monitor │
    │  :3001   │ │ :3002  │ │ :3003  │ │ :3004  │ │ :3005  │
    └─────┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘
          │          │           │           │          │
    ┌─────┴────┐ ┌───┴────┐ ┌───┴────┐
    │Intelli   │ │ Agent  │ │Knowledge│
    │  :3006   │ │ :3007  │ │  :3008  │
    └──────────┘ └────────┘ └────────┘

    共享基础设施
    ┌──────────────────────────────────────────────────┐
    │ PostgreSQL (6 DB) │ Redis │ NATS JetStream       │
    └──────────────────────────────────────────────────┘
```

## 服务清单

| 服务名称 | 端口 | 技术栈 | 数据库 | 说明 |
|----------|------|--------|--------|------|
| orion-gateway | 3000 | Node.js/Express | 无 | API 聚合网关，统一入口 |
| orion-platform-core | 3001 | Node.js/TypeScript | platform_db | 租户、项目、配置管理 |
| orion-pipeline-svc | 3002 | Node.js/TypeScript | pipeline_db | CI/CD 流水线管理 |
| orion-deploy-svc | 3003 | Node.js/TypeScript | deploy_db | 部署管理和发布 |
| orion-ticket-svc | 3004 | Node.js/TypeScript | ticket_db | 工单管理系统 |
| orion-monitor-svc | 3005 | Node.js/TypeScript | monitor_db | 监控和自愈 |
| orion-intelligence-svc | 3006 | Python/FastAPI | intelligence_db | AI 智能分析 |
| orion-agent-svc | 3007 | Node.js/TypeScript | 无 | Runner 管理 |
| orion-knowledge-svc | 3008 | Node.js/TypeScript | 无 | 知识库管理 |

## 共享基础设施

| 组件 | 端口 | 说明 |
|------|------|------|
| PostgreSQL | 5432 | 6 个独立数据库实例 |
| Redis | 6379 | 缓存和会话管理 |
| NATS JetStream | 4222 | 事件总线和消息流 |
| NATS Management | 8222 | NATS 监控端口 |

## 快速开始

### 环境准备

```bash
# 克隆仓库
git clone <repo-url>
cd orion-microservices

# 复制环境变量
cp .env.example .env

# 启动所有服务
./scripts/start.sh

# 查看服务状态
docker compose ps
```

### 开发模式

```bash
# 启动开发环境（包含热重载）
./scripts/dev.sh

# 单独启动某个服务
docker compose up orion-gateway orion-platform-core

# 查看日志
docker compose logs -f orion-gateway
```

### 停止服务

```bash
# 停止所有服务
./scripts/stop.sh

# 停止并清理数据卷
./scripts/stop.sh --clean
```

## 项目结构

```
orion-microservices/
├── docker-compose.yml          # 生产环境编排
├── docker-compose.dev.yml      # 开发环境覆盖
├── .env.example                # 环境变量模板
├── README.md                   # 本文档
├── scripts/
│   ├── start.sh                # 启动脚本
│   ├── stop.sh                 # 停止脚本
│   ├── dev.sh                  # 开发模式启动
│   └── build.sh                # 构建脚本
├── docs/
│   ├── architecture.md         # 架构文档
│   ├── deployment.md           # 部署指南
│   └── api-gateway.md          # 网关路由配置
└── orion-*/                    # 各微服务代码（同级目录引用）
```

## 环境变量

关键环境变量，详见 `.env.example`：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `COMPOSE_PROJECT_NAME` | Docker Compose 项目名称 | orion |
| `POSTGRES_USER` | PostgreSQL 用户名 | orion |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | orion_secret |
| `REDIS_PASSWORD` | Redis 密码 | redis_secret |
| `NATS_TOKEN` | NATS 认证令牌 | nats_secret |
| `NODE_ENV` | Node.js 运行环境 | production |
| `JWT_SECRET` | JWT 签名密钥 | change-me-in-production |

## 服务间通信

- **同步通信**: REST API 通过内部网络 `orion-internal`
- **异步通信**: NATS JetStream 事件总线
- **缓存**: Redis 共享实例，通过 key 前缀隔离

## API 路由

网关将所有外部请求路由到对应服务：

| 路径前缀 | 目标服务 | 端口 |
|----------|----------|------|
| `/api/platform/*` | orion-platform-core | 3001 |
| `/api/pipeline/*` | orion-pipeline-svc | 3002 |
| `/api/deploy/*` | orion-deploy-svc | 3003 |
| `/api/ticket/*` | orion-ticket-svc | 3004 |
| `/api/monitor/*` | orion-monitor-svc | 3005 |
| `/api/intelligence/*` | orion-intelligence-svc | 3006 |
| `/api/agent/*` | orion-agent-svc | 3007 |
| `/api/knowledge/*` | orion-knowledge-svc | 3008 |

## License

Proprietary
