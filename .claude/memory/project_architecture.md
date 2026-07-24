---
name: 项目架构与数据流
description: 微服务架构、Repository 模式迁移、Saga 编排、事件系统、双 ArtifactService 问题
type: project
---

# 架构与数据流

## 核心架构

```
orion-platform-service/     # 核心后端 (Node.js + TypeScript + Fastify) — 主力服务
orion-api-gateway/          # API 网关 (Node.js + Fastify + http-proxy)
orion-frontend/             # 前端 (React + Vite + Ant Design + wujie 微前端)
orion-ai-service/           # AI 微服务 (Python)
orion-visor/                # 运维可视化 (Java/Spring)
orion-knowledge/            # AI 知识库 (PandaWiki fork)
orion-dba/                  # DB 管理平台
```

## Platform Service 内部结构 (orion-platform-service/src/)

- `api/` — 路由定义，routes.ts 中央注册表 (~48 路由模块)
- `api/controllers/` — 请求处理器
- `services/` — 70+ 服务模块，30+ 已迁移到 PostgreSQL Repository 模式
- `engine/` — 流水线引擎: PipelineEngine → StageExecutor → TaskRunner
- `saga/` — Saga 编排: SagaCoordinator, PipelineSaga, TransactionLog
- `events/` — 事件发布器 (内存级，未接入 NATS)
- `models/` — 数据模型 (TypeScript 类)
- `repositories/` — 数据访问层
- `db/migrations/` — SQL 迁移文件 (001-049, 68 个文件)

## M25 持久化迁移

30+ 服务从 Map() mock 存储迁移到 PostgreSQL Repository 模式。

## 已知架构问题

1. **无真实 EventBus 集成**: 事件发布器存在但未接入 NATS
2. **双 ArtifactService 混淆**: `services/artifact/` 和 build 相关服务职责重叠
3. **orion-platform-service 是单体**: 所有服务运行在同一进程

**How to apply:** 新增功能时注意：事件系统目前是内存级；新增 API 路由需在 routes.ts 注册；数据持久化用 Repository 模式而非 Map()。
