# 微服务拆分架构评审进度

> 更新日期: 2026-05-11
> 状态: 进行中（被打断，待完成评审报告）

## 已完成的工作

### 1. 微服务基座 (orion-platform-core) 开发

| 模块 | 文件 | 状态 |
|------|------|------|
| JWT 认证中间件 | `src/middleware/jwtAuth.ts` | 已实现 |
| 租户隔离中间件 | `src/middleware/tenantIsolation.ts` | 已实现 |
| 权限检查中间件 | `src/middleware/requirePermission.ts` | 已实现 |
| API Key 认证中间件 | `src/middleware/apiKeyAuth.ts` | 已实现 |
| 用户管理 | `src/services/UserService.ts` + `src/routes/user.ts` | 已实现 (CRUD + 事件) |
| 服务发现 | `src/services/ServiceDiscoveryService.ts` + `src/routes/serviceDiscovery.ts` | 已实现 |
| 数据库工具 | `src/utils/database.ts` | 已实现 (连接池 + 迁移) |
| Redis 客户端 | `src/utils/redis.ts` | 已实现 (单例) |
| 事件总线 | `src/utils/eventBus.ts` | 已实现 (NATS + 重连) |
| RBAC Service | `src/services/RBACService.ts` | 已实现 (Redis 缓存) |
| ApiKey Service | `src/services/ApiKeyService.ts` | 已实现 (SHA-256) |
| Config Service | `src/services/ConfigService.ts` | 已实现 (三级作用域) |
| 优雅关闭 | `src/app.ts` | 已实现 (SIGTERM/SIGINT) |
| 数据库迁移 | `migrations/001-platform-core-base-schema.sql` | 已实现 (10 张表) |
| 类型定义 | `src/types/core.ts` | 已更新 (User, ServiceInfo 等) |
| 应用入口 | `src/app.ts` | 已重写 (中间件注册 + 健康检查) |

### 2. 7 个新微服务骨架创建

| 服务 | 目录 | 文件数 | 代码行数 | 状态 |
|------|------|--------|----------|------|
| orion-pipeline-svc | `orion-pipeline-svc/` | 6 | 746 | 骨架 (501 Not Implemented) |
| orion-deploy-svc | `orion-deploy-svc/` | 7 | 840 | 骨架 |
| orion-ticket-svc | `orion-ticket-svc/` | 14 | 3419 | 骨架 (含 95 类型定义, 4 路由组) |
| orion-monitor-svc | `orion-monitor-svc/` | 10 | 1174 | 骨架 |
| orion-agent-svc | `orion-agent-svc/` | 10 | 1285 | 骨架 (含测试 + 优雅关闭) |
| orion-intelligence-svc | `orion-intelligence-svc/` | 26 | - | 骨架 (Python/FastAPI + uv) |
| orion-knowledge-svc | 尚未创建骨架 | - | - | 未开始 |

### 3. 编排层

| 文件 | 状态 |
|------|------|
| `orion-microservices/docker-compose.yml` | 已完成 (9 服务 + 3 基础设施) |
| `orion-microservices/scripts/init-db.sh` | 已完成 (6 数据库初始化) |
| `orion-microservices/docs/architecture.md` | 已完成 |
| `orion-microservices/docs/api-gateway.md` | 已完成 |

## 评审中发现的问题（部分完成）

### P0 - 阻断性问题

1. **端口不一致**:
   - `orion-ticket-svc/docker-compose.yml` 使用 3100，orchestrator 使用 3004
   - `orion-agent-svc/docker-compose.yml` 使用 3100，orchestrator 使用 3007
   - 各服务独立 docker-compose 端口混乱 (3000, 3100, 8000, 8004)

2. **缺少 workspace 配置**: 服务间引用 `workspace:*` 依赖但无 `pnpm-workspace.yaml`

### P1 - 重要问题

3. **ProjectService.ts 使用 require('pg')**: 未使用集中式 `database.ts` 工具
4. **数据库依赖缺失**: pipeline-svc 代码引用 pg 但 docker-compose 无 postgres
5. **orion-knowledge-svc 骨架未创建**: orchestrator 已引用但目录不存在
6. **前端未纳入编排**: `orion-frontend` 不在 `docker-compose.yml` 中

### P2 - 待确认

7. **前端拆分评估**: 124 pages, 98 API clients, 1163 行路由文件 — 需评估是否按域拆分
8. **ticket service workspace 依赖**: 引用了其他服务但实际不存在为独立包

## 前端拆分评估（部分数据已收集）

### 已收集数据

- **Pages**: 124 个目录，覆盖 Pipeline/Deploy/Ticket/Monitor/Agent/Console 等所有域
- **API Clients**: 98 个文件，映射到后端服务域
- **Router**: 1163 行，包含 domain-based 路由组
- **微前端**: 已支持 wujie (3 子应用: dba, knowledge, visor)
- **Components**: 32 个共享组件
- **Stores**: 5 个 Zustand stores

### 待完成分析

- 路由文件的域分组详情
- API client 与后端服务的映射关系
- 组件依赖关系分析
- 拆分方案推荐 (monorepo vs 独立包 vs 按域分包)
