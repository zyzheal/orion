# 微服务增量迁移设计文档

> 日期: 2026-05-11
> 策略: 方案 A — 增量迁移（逐个域从 platform-service 拆分到独立微服务）

## 目标

将 `orion-platform-service` 中的 100+ 路由模块按业务域拆分到 6 个独立微服务中，同时：
1. 每个服务接入 api-gateway 路由代理
2. 每个服务加入主 docker-compose 编排
3. 复用 `orion-platform-core` 的中间件（JWT、租户隔离、RBAC）
4. 保持向后兼容（API 路径不变）

## 迁移顺序

1. **orion-pipeline-svc** — Pipeline 域（12 个路由模块）
2. **orion-ticket-svc** — 工单域（6 个路由模块）
3. **orion-monitor-svc** — 监控域（10 个路由模块）
4. **orion-deploy-svc** — 部署域（3 个路由模块）
5. **orion-agent-svc** — Agent 域（5 个路由模块）
6. **orion-intelligence-svc** — 智能域（5 个路由模块）

## 每个服务的迁移步骤

### 步骤 1: 识别并提取路由模块
从 `orion-platform-service/src/api/routes.ts` 中找出属于该域的所有路由文件，复制目标服务。

### 步骤 2: 构建服务骨架
每个服务统一结构：
```
src/
  app.ts              — Fastify 入口
  config.ts           — 环境变量配置
  routes/             — 域路由
  services/           — 业务逻辑
  middleware/         — 复用 platform-core 中间件
  types/              — 类型定义
  utils/
    database.ts       — DB 连接池（复用 core 模式）
    redis.ts          — Redis 客户端
    eventBus.ts       — NATS 事件总线
```

### 步骤 3: 迁移业务逻辑
将 platform-service 中对应的 Service 实现迁移到目标服务。

### 步骤 4: 接入 api-gateway
在 `orion-api-gateway/src/routes/api.ts` 中添加该服务的代理路由。

### 步骤 5: 加入 docker-compose
在 `orion-microservices/docker-compose.yml` 中添加服务定义。

### 步骤 6: 从 platform-service 中移除
删除已迁移的路由和 Service，清理 routes.ts 引用。

## 共享基础设施

所有服务复用 `orion-platform-core` 的中间件和工具类：
- `jwtAuth` — JWT 认证
- `tenantIsolation` — 租户隔离
- `requirePermission` — 权限检查
- `apiKeyAuth` — API Key 认证
- `database.ts` — PostgreSQL 连接池
- `redis.ts` — Redis 单例
- `eventBus.ts` — NATS 事件总线

**实现方式**：通过 `workspace:*` 依赖引用 platform-core 的包，或复制工具类到各服务的 `utils/` 目录。

## 网关路由映射

| 网关前缀 | 目标服务 | 端口 |
|----------|----------|------|
| `/api/v1/pipeline` | orion-pipeline-svc | 3002 |
| `/api/v1/ticket` | orion-ticket-svc | 3004 |
| `/api/v1/monitor` | orion-monitor-svc | 3005 |
| `/api/v1/deploy` | orion-deploy-svc | 3003 |
| `/api/v1/agent` | orion-agent-svc | 3007 |
| `/api/v1/ai` | orion-intelligence-svc | 3008 |

## 数据库策略

每个服务拥有独立的 PostgreSQL 数据库：
- `orion_pipeline_db`
- `orion_ticket_db`
- `orion_monitor_db`
- `orion_deploy_db`
- `orion_agent_db`
- `orion_intelligence_db`

共享 `orion_platform_db`（platform-core 的租户/用户/RBAC 数据）。

## 验证标准

每个服务迁移完成后验证：
1. `npm run build` 编译通过
2. `docker compose up` 能启动
3. 网关能正确代理到该服务
4. 健康检查端点 `/healthz` 返回 200
5. 该域 API 功能与迁移前一致
