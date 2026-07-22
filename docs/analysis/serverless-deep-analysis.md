# Serverless 模块深度分析

**生成日期**: 2026-07-02  
**分析范围**: `orion-platform-service/src/services/serverless/ServerlessService.ts` + `src/api/serverless-routes.ts`  
**模块标签**: Phase 4 P0, 函数即服务, FaaS

---

## 一、现状概述

### 模块定位

Serverless 模块提供 FaaS (Function as a Service) 能力，支持函数生命周期管理、多运行时（Node.js/Python/Go/Java）、事件驱动触发器、自动扩缩容、日志聚合和指标收集。属于 Phase 4 P0 优先级的 Serverless 平台模块。

### 文件结构

| 文件 | 行数 | 职责 |
|------|------|------|
| `services/serverless/ServerlessService.ts` | 788 | 函数 CRUD、部署、调用、触发器、日志、指标、自动扩缩容 |
| `api/serverless-routes.ts` | 242 | 路由注册（18 个端点） |

### 核心数据模型

- **ServerlessFunction**: id, name, runtime (nodejs18/python3.11/go1.21/java17), handler, memory(256MB), timeout(30s), status (draft/deployed/stopped/error), version, replicas {min/max/current}, code, endpoint
- **ServerlessTrigger**: type (http/cron/event/queue/kafka/s3), config, enabled, invocationCount
- **ServerlessDeployment**: status (pending/deploying/success/failed/rolled_back), codeVersion
- **ServerlessMetrics**: invocations, errors, avg/p95/p99 duration, memory, CPU
- **ServerlessLog**: level (info/warn/error/debug), message, requestId

### 持久化方式

✅ PostgreSQL Repository 模式（5 个 Repository）：
- `ServerlessFunctionRepository`
- `ServerlessTriggerRepository`
- `ServerlessDeploymentRepository`
- `ServerlessLogRepository`
- `ServerlessMetricRepository`

构造函数接受可选的 `db` 参数，无 DB 时降级到 `Map()` 内存模式。

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 函数创建 | ✅ | 支持 6 种运行时、配置 memory/timeout/replicas |
| 函数列表 | ✅ | 支持按 status/runtime 过滤 |
| 函数详情 | ✅ | 按 ID + tenantId 查询 |
| 函数更新 | ✅ | 支持部分更新 |
| 函数删除 | ✅ | 级联删除触发器/部署/日志，发布事件 |
| 函数调用 | ⚠️ | 模拟执行，返回随机耗时(50-250ms)，无真实沙箱 |
| 函数部署 | ⚠️ | 模拟部署流程（deploying→success/failed），无真实容器化 |
| 触发器管理 | ✅ | 支持 http/cron/event/queue/kafka/s3 类型 |
| 部署历史 | ✅ | 包含版本号、状态、错误信息 |
| 日志查询 | ✅ | 按 functionId 和 level 过滤 |
| 指标记录 | ✅ | invocations/errors/duration/memory/CPU |
| 聚合指标 | ✅ | totalFunctions/deployedFunctions/errorRate |
| 自动扩缩容 | ⚠️ | 基于 CPU 利用率（>70% 扩容，<20% 缩容），无真实 K8s HPA 集成 |

---

## 三、API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/serverless/functions` | 创建函数 |
| GET | `/serverless/functions` | 函数列表 |
| GET | `/serverless/functions/:id` | 函数详情 |
| PUT | `/serverless/functions/:id` | 更新函数 |
| DELETE | `/serverless/functions/:id` | 删除函数 |
| POST | `/serverless/functions/:id/deploy` | 部署函数 |
| GET | `/serverless/functions/:id/deployments` | 部署历史 |
| POST | `/serverless/functions/:id/invoke` | 调用函数 |
| GET | `/serverless/functions/:id/logs` | 获取日志 |
| GET | `/serverless/functions/:id/metrics` | 获取指标 |
| GET | `/serverless/metrics` | 聚合指标 |
| POST | `/serverless/triggers` | 创建触发器 |
| GET | `/serverless/triggers` | 触发器列表 |
| GET | `/serverless/triggers/:id` | 触发器详情 |
| DELETE | `/serverless/triggers/:id` | 删除触发器 |
| GET | `/serverless/autoscaling` | 扩缩容建议 |

### 路由注册

✅ 所有路由通过 `authenticateUser` + `requirePermission` 中间件，资源名 `serverless`。

### ⚠️ 路由 Bug

`serverless-routes.ts` 第 62 行和 83 行存在**死代码 Bug**：

```typescript
// 第 62 行 (GET /:id)
return handleError(reply, new NotFoundError('NOT_FOUND'));  // 提前返回错误
return reply.send({ success: true, data: fn });             // 永远不会执行

// 第 83 行 (PUT /:id)
return handleError(reply, new NotFoundError('NOT_FOUND'));  // 同上
return reply.send({ success: true, data: fn });
```

**影响**：`GET /serverless/functions/:id` 和 `PUT /serverless/functions/:id` 总是返回 404，即使函数存在。

类似的问题也存在于：
- `DELETE /serverless/functions/:id`（第 93 行）
- `GET /serverless/triggers/:id`（第 217 行）
- `DELETE /serverless/triggers/:id`（第 227 行）

---

## 四、依赖关系

### 内部依赖

- `ServerlessService` → 5 个 Repository + in-memory Map fallback
- `serverless-routes.ts` → `ServerlessService`

### 外部依赖

- `uuid`（ID 生成）
- `errors.ts`（`OrionError`, `ErrorCode`）
- 数据模型定义内联在 Service 文件中（无独立 models 文件）

### 测试覆盖

✅ 测试文件:
- `__tests__/ServerlessService.test.ts`

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **路由死代码 Bug**：5 个路由因 `handleError` 提前 return 无法正常工作 | **P0** | 删除无条件的 `handleError` 调用，只在 `!fn` 时返回 404 |
| **函数调用纯模拟**：`invokeFunction` 返回随机耗时，无真实代码执行沙箱 | **P1** | 集成容器运行时（Firecracker 或 gVisor）执行函数代码 |
| **部署流程纯模拟**：无真实容器镜像构建和 K8s Deployment | **P1** | 集成 Kaniko/Docker 构建 + K8s API 部署 |
| **扩缩容未对接真实 HPA**：只返回建议，不执行实际扩缩容操作 | **P1** | 对接 K8s HPA 或 Knative Scale |
| **数据模型与 Service 耦合**：`ServerlessFunction` 等接口定义在 Service 文件内 | **P2** | 抽取到独立的 `models/serverless.ts` |
| **无事件驱动触发器运行时**：cron/queue/kafka 触发器注册后无调度执行 | **P2** | 集成 cron 调度器和消息队列消费者 |
| **函数代码存储**：code 字段直接存源码字符串，大函数会超限 | **P2** | 改用对象存储（S3/MinIO）保存函数代码 |
| **无冷启动优化**：无预热策略，每调用都"从头开始" | **P3** | 实现保留实例/预热池机制 |

---

## 六、总结

Serverless 模块的 API 骨架完整，覆盖了 FaaS 平台的各个维度（函数管理、部署、调用、触发器、监控、扩缩容）。5 个 Repository 的 PostgreSQL 持久化良好。

**最大的问题是有 5 个路由因死代码 Bug 无法正常工作**（P0），其次是**函数执行和部署全是模拟行为**（P1）。要使其成为真正的 FaaS 平台，需要集成容器运行时和 K8s 部署能力。当前状态适合作为功能预览/蓝图，不适合生产使用。
