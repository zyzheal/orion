# Orion 微服务架构文档

## 1. 架构概述

Orion 采用微服务架构，由 9 个独立服务组成，通过 orchestrator monorepo 统一管理。架构遵循以下设计原则：

- **单一职责**: 每个服务只负责一个业务领域
- **独立部署**: 每个服务可以独立构建、测试和部署
- **数据隔离**: 每个服务拥有独立的 PostgreSQL 数据库
- **事件驱动**: 通过 NATS JetStream 实现异步通信
- **统一入口**: 所有外部请求通过 API Gateway 路由

## 2. 架构图

```
                         外部客户端
                              │
                              ▼
                    ┌─────────────────────┐
                    │   API Gateway       │  :3000
                    │   (统一路由/认证)    │
                    └─────────┬───────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌───────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐
    │  Platform Core │ │   Pipeline   │ │    Deploy    │
    │    :3001       │ │    :3002     │ │    :3003     │
    │  (租户/项目)   │ │  (CI/CD)    │ │  (部署管理)   │
    └───────┬───────┘ └──────┬───────┘ └──────┬───────┘
            │                │                │
    ┌───────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐
    │    Ticket     │ │   Monitor    │ │ Intelligence │
    │    :3004      │ │    :3005     │ │    :3006     │
    │  (工单管理)   │ │ (监控自愈)   │ │  (AI 分析)   │
    └───────┬───────┘ └──────┬───────┘ └──────┬───────┘
            │                │                │
    ┌───────┴───────┐ ┌──────┴───────┐
    │    Agent      │ │  Knowledge   │
    │    :3007      │ │    :3008     │
    │ (Runner 管理) │ │ (知识库)     │
    └───────────────┘ └──────────────┘


              共享基础设施层
    ┌──────────────────────────────────┐
    │  PostgreSQL  │  Redis  │  NATS   │
    │  (6 个独立 DB) │  (缓存)  │ (事件总线) │
    └──────────────────────────────────┘
```

## 3. 服务详细说明

### 3.1 orion-gateway (端口 3000)

API 网关，所有外部流量的统一入口。

**职责**:
- 请求路由和负载均衡
- JWT 认证和授权
- 请求限流和防抖
- CORS 处理
- 请求日志和指标采集

**技术栈**: Node.js + Express + http-proxy-middleware

### 3.2 orion-platform-core (端口 3001)

平台核心服务，管理租户、项目和全局配置。

**职责**:
- 多租户管理 (创建/激活/停用)
- 项目管理和配额
- 全局配置管理
- 用户认证和权限
- 服务发现注册

**技术栈**: Node.js + TypeScript + Prisma

**数据库**: platform_db

### 3.3 orion-pipeline-svc (端口 3002)

CI/CD 流水线服务。

**职责**:
- 流水线定义和模板管理
- 构建任务调度
- 制品管理
- 流水线状态跟踪

**技术栈**: Node.js + TypeScript + Prisma

**数据库**: pipeline_db

### 3.4 orion-deploy-svc (端口 3003)

部署管理服务。

**职责**:
- 环境管理 (dev/staging/prod)
- 部署策略 (滚动/蓝绿/金丝雀)
- 发布历史记录
- 回滚管理

**技术栈**: Node.js + TypeScript + Prisma

**数据库**: deploy_db

### 3.5 orion-ticket-svc (端口 3004)

工单管理服务。

**职责**:
- 工单创建和生命周期管理
- 审批流程
- SLA 跟踪
- 通知管理

**技术栈**: Node.js + TypeScript + Prisma

**数据库**: ticket_db

### 3.6 orion-monitor-svc (端口 3005)

监控和自愈服务。

**职责**:
- 健康检查监控
- 告警规则和通知
- 自动自愈策略
- 指标聚合和可视化

**技术栈**: Node.js + TypeScript

**数据库**: monitor_db

### 3.7 orion-intelligence-svc (端口 3006)

AI 智能分析服务。

**职责**:
- 日志分析和异常检测
- 智能告警关联
- 预测性维护
- 推荐和优化建议

**技术栈**: Python + FastAPI

**数据库**: intelligence_db

### 3.8 orion-agent-svc (端口 3007)

Runner 管理服务。

**职责**:
- Runner 注册和心跳
- 任务分发
- Runner 健康监控
- 并发控制

**技术栈**: Node.js + TypeScript

**数据库**: 无 (使用 Redis 存储状态)

### 3.9 orion-knowledge-svc (端口 3008)

知识库服务。

**职责**:
- 文档存储和检索
- 全文搜索
- 版本控制
- 标签和分类

**技术栈**: Node.js + TypeScript

**数据库**: 无 (使用 Redis 存储索引)

## 4. 数据库设计

### 4.1 数据库隔离策略

每个服务拥有独立的 PostgreSQL 数据库，通过数据库名隔离：

| 服务 | 数据库名 | 说明 |
|------|----------|------|
| platform-core | platform_db | 租户、项目、用户、配置 |
| pipeline-svc | pipeline_db | 流水线、构建记录、制品 |
| deploy-svc | deploy_db | 环境、部署记录、发布 |
| ticket-svc | ticket_db | 工单、审批、SLA |
| monitor-svc | monitor_db | 指标、告警、自愈策略 |
| intelligence-svc | intelligence_db | AI 模型、分析结果 |

### 4.2 Redis 使用策略

通过 Redis database 编号隔离各服务数据：

| 服务 | DB 编号 | 用途 |
|------|---------|------|
| platform-core | 0 | 会话、缓存 |
| pipeline-svc | 1 | 构建缓存、锁 |
| deploy-svc | 2 | 部署锁、缓存 |
| ticket-svc | 3 | 通知队列 |
| monitor-svc | 4 | 实时指标 |
| agent-svc | 6 | Runner 状态 |
| knowledge-svc | 7 | 搜索索引 |

## 5. 事件总线 (NATS JetStream)

### 5.1 主题命名约定

```
orion.{domain}.{entity}.{event}
```

示例:
- `orion.pipeline.build.started` - 构建开始
- `orion.deploy.release.completed` - 发布完成
- `orion.ticket.created` - 工单创建
- `orion.monitor.alert.triggered` - 告警触发

### 5.2 JetStream 消费者

每个服务订阅感兴趣的事件主题，实现最终一致性：

```
platform-core ← 订阅所有服务的心跳和状态变更
pipeline-svc  ← 订阅 deploy.requested, platform.tenant.updated
deploy-svc    ← 订阅 pipeline.build.completed, ticket.approved
monitor-svc   ← 订阅所有服务的 health.event
```

## 6. 网络架构

### 6.1 Docker 网络

| 网络名 | 类型 | 说明 |
|--------|------|------|
| orion-public | bridge | Gateway 对外暴露，客户端可访问 |
| orion-internal | bridge | 服务间内部通信，不暴露到外部 |

### 6.2 服务网络可见性

- **Gateway**: 连接 orion-public 和 orion-internal
- **所有应用服务**: 仅连接 orion-internal
- **基础设施服务**: 仅连接 orion-internal (PostgreSQL 端口可映射到宿主机用于开发调试)

## 7. 健康检查

所有服务配置 Docker 健康检查：

| 服务 | 检查方式 | 间隔 | 启动时间 |
|------|----------|------|----------|
| PostgreSQL | pg_isready | 10s | 30s |
| Redis | redis-cli ping | 10s | 10s |
| NATS | HTTP /healthz | 10s | 15s |
| Node.js 服务 | HTTP /health | 15s | 30s |
| Python 服务 | HTTP /health | 15s | 30s |

## 8. 依赖关系

```
基础设施 (PostgreSQL, Redis, NATS)
    │
    ├── orion-platform-core (基础服务)
    │       │
    │       ├── orion-gateway (依赖 platform-core)
    │       ├── orion-pipeline-svc
    │       ├── orion-deploy-svc
    │       ├── orion-ticket-svc
    │       ├── orion-monitor-svc
    │       ├── orion-intelligence-svc
    │       ├── orion-agent-svc
    │       └── orion-knowledge-svc
```
