# 低代码服务 Spec 文档

**生成日期**: 2026-07-03
**状态**: 编写中
**成熟度**: L1（初始定义）

---

## 一、服务定位

### 1.1 概要

lowcode-svc-go 是 Orion 低代码平台的 Go 微服务实现，定位为独立部署的可视化工作流编排引擎与组件库管理服务。与 `orion-platform-service` 中已有的低代码模块（`src/services/lowcode/`）功能重叠，目前作为微服务架构的独立蓝图存在。

### 1.2 核心职责

| 职责域 | 说明 |
|--------|------|
| **组件库管理** | 低代码组件的 CRUD（LowCodeApp），支持组件 Schema、类型、版本管理 |
| **工作流定义编排** | 工作流模板的定义、版本管理、启用/停用（模型层已就绪，API 层待完善） |
| **工作流实例执行** | 工作流实例的生命周期管理：pending → running → completed/failed/terminated |
| **任务调度** | 人工/系统任务的分配、超时、完成处理 |
| **定时器管理** | delay/timer 类型节点的定时调度，支持 cron 表达式 |
| **触发器管理** | 事件触发与 cron 触发两种模式的触发器注册与调度 |
| **依赖分析** | 工作流定义间的循环依赖检测、可视化数据生成 |

### 1.3 成熟度评估

| 维度 | 当前状态 | 目标 |
|------|---------|------|
| **路由层 (handler)** | 仅 `/apps` CRUD，含 5 个端点。工作流核心能力（定义/实例/任务/触发器）的 API 层未实现 | Phase 1: L2.5 |
| **服务层 (service)** | 仅 LowCodeApp CRUD 的简单透传。Workflow 相关业务逻辑未实现 | Phase 1: L2.5 |
| **持久层 (repository)** | 7 张表完整 CRUD。含原子性 timer 抢占、递归 CTE 父链查询等高级操作 | 当前已 L2.5 |
| **数据模型 (models)** | 624 行完整定义：工作流节点 9 种类型、节点配置、定时器、任务、触发器、依赖分析，JSONB 序列化支持完整 | 当前已 L2.5 |
| **数据库迁移** | 7 张表完整 Schema，含索引，与 `orion-platform-service` 低代码表异源 | 当前已 L2.0 |
| **配置管理** | 环境变量方式，含 JWT/Redis/DB 配置 | 当前已 L1.5 |
| **测试覆盖** | 仅 2 个基本测试（模型字段校验、分页默认值），覆盖率极低 | Phase 1: L2.5 |
| **API 认证与权限** | JWT 认证 + 细粒度权限控制（lowcode:write / lowcode:delete） | 当前已 L2.5 |

### 1.4 与平台级设计文档的关系

| 文档 | 关系 | 差异点 |
|------|------|--------|
| `docs/services/lowcode/01-lowcode-spec.md`（平台级） | 定义 Phase 1 需求：流程设计器、API 路由、版本管理、导入导出 | 平台级 API 路径为 `/api/v1/lowcode/workflows`，当前 Go 服务路径为 `/api/v1/apps`；平台级涵盖前端设计器，本服务不涉及前端 |

---

## 二、验收标准

### 2.1 组件库管理 (LowCodeApp)

| # | 标准 | 验证方式 | 当前状态 |
|---|------|----------|:--------:|
| C1 | 创建组件需提供 name、component_type、schema，成功后返回 201 | API 测试 | ✅ 已实现 |
| C2 | 分页列表需支持 page/page_size 参数，默认 page=1, page_size=20 | API 测试 | ✅ 已实现 |
| C3 | 列表数据需以 `{"data": [...]}` 格式返回 | API 测试 | ✅ 已实现 |
| C4 | 按 ID 查询组件需校验 tenant_id 隔离 | API 测试 | ✅ 已实现 |
| C5 | 删除组件需校验 tenant_id，权限要求 lowcode:delete | API 测试 | ✅ 已实现 |
| C6 | 组件计数接口按 tenant 统计 | API 测试 | ✅ 已实现 |
| C7 | 创建时 schema 为必填字段（binding:"required"） | API 测试 | ✅ 已实现 |

### 2.2 工作流定义 (WorkflowDefinition)

| # | 标准 | 验证方式 | 当前状态 |
|---|------|----------|:--------:|
| W1 | 创建工作流定义：包含 nodes + edges（必填） | API 测试 | ❌ 模型层就绪，API 层未实现 |
| W2 | 更新工作流定义：支持部分字段更新 | API 测试 | ❌ 未实现 |
| W3 | 分页查询工作流定义，可选 enabled 筛选 | API 测试 | ❌ 未实现 |
| W4 | 按 ID 查询工作流定义 | API 测试 | ❌ 未实现 |
| W5 | 删除工作流定义 | API 测试 | ❌ 未实现 |
| W6 | 版本自增（每次更新 version+1） | 单元测试 | ❌ 未实现 |
| W7 | 启用/停用控制（enabled 字段） | API 测试 | ❌ 未实现 |

### 2.3 工作流实例 (WorkflowInstance)

| # | 标准 | 验证方式 | 当前状态 |
|---|------|----------|:--------:|
| I1 | 创建工作流实例（基于 definition 启动） | API 测试 | ❌ 未实现 |
| I2 | 实例生命周期：pending → running → completed/failed/terminated | 集成测试 | ❌ 未实现 |
| I3 | 按 workflow_id 查询实例列表，支持 status 筛选 | API 测试 | ❌ 未实现 |
| I4 | 实例超期清理：completed/failed/terminated 实例自动删除 | 集成测试 | ✅ Repository 层已实现 |
| I5 | 实例执行历史记录（history JSONB 累计） | 集成测试 | ❌ 未实现 |
| I6 | 子工作流依赖追踪（parent-child 递归 CTE） | 单元测试 | ✅ Repository 层已实现 |

### 2.4 定时器与任务

| # | 标准 | 验证方式 | 当前状态 |
|---|------|----------|:--------:|
| T1 | 定时器创建与原子性抢占（FOR UPDATE SKIP LOCKED） | 集成测试 | ✅ Repository 层已实现 |
| T2 | 定时器执行次数自增与上限控制 | 单元测试 | ✅ Repository 层已实现 |
| T3 | 人工任务分配与完成（candidate_users/candidate_roles） | API 测试 | ❌ 未实现 |
| T4 | 任务超时检测与处理 | 集成测试 | ✅ Repository 层已实现（FindOverdueTasks） |
| T5 | 触发器 CRUD（event/cron 两种类型） | API 测试 | ❌ 未实现 |
| T6 | 启用的 cron 触发器批量查询 | 集成测试 | ✅ Repository 层已实现 |

### 2.5 依赖分析

| # | 标准 | 验证方式 | 当前状态 |
|---|------|----------|:--------:|
| D1 | 循环依赖检测（基于 workflow_sub_workflow_dependencies） | 单元测试 | ✅ 模型层定义完成 |
| D2 | 依赖关系可视化数据生成 | 单元测试 | ✅ 模型层定义完成 |

### 2.6 非功能性

| # | 标准 | 验证方式 | 当前状态 |
|---|------|----------|:--------:|
| N1 | 所有 API 端点必须通过 JWT 认证 | API 测试 | ✅ 已实现（全局中间件 + /healthz 跳过） |
| N2 | 写操作需细粒度权限校验（lowcode:write / lowcode:delete） | API 测试 | ✅ 已实现 |
| N3 | 多租户隔离：所有查询带 tenant_id 过滤 | API 测试 | ✅ 已实现 |
| N4 | 结构化日志（traceId、请求路径、耗时） | 日志审查 | ✅ 已实现（middleware.StructuredLogger） |
| N5 | 优雅启停 + 健康检查端点 /healthz | 运维验证 | ✅ 已实现 |
| N6 | 数据库迁移自动执行（启动时检测 migrations/ 目录） | 运维验证 | ✅ 已实现 |

---

## 三、API 设计

### 3.1 当前已实现 API

| 方法 | 路径 | 说明 | 认证 | 权限 |
|------|------|------|:---:|:----:|
| POST | `/api/v1/apps` | 创建低代码组件 | ✅ JWT | `lowcode:write` |
| GET | `/api/v1/apps` | 低代码组件列表（分页） | ✅ JWT | — |
| GET | `/api/v1/apps/:id` | 查询组件详情 | ✅ JWT | — |
| DELETE | `/api/v1/apps/:id` | 删除组件 | ✅ JWT | `lowcode:delete` |
| GET | `/api/v1/apps/count` | 组件计数 | ✅ JWT | — |
| GET | `/healthz` | 健康检查 | ❌ 跳过 | — |

**路由前缀**: 所有业务 API 挂载在 `/api/v1` 下，Handler 内部再绑定到 `/apps` 子路由组。

**认证机制**: 全局 `auth.Auth` 中间件（JWT + Redis 黑名单），`/healthz` 通过 `SkipPaths` 跳过认证。

### 3.2 模型层已定义但未实现 API

以下 API 基于现有模型定义推测，尚待实现：

| 方法 | 路径 | 说明 | 建议优先级 |
|------|------|------|:---------:|
| POST | `/api/v1/workflows` | 创建工作流定义 | P0 |
| GET | `/api/v1/workflows` | 工作流定义列表（分页 + enabled 筛选） | P0 |
| GET | `/api/v1/workflows/:id` | 查询工作流定义 | P0 |
| PUT | `/api/v1/workflows/:id` | 更新工作流定义 | P0 |
| DELETE | `/api/v1/workflows/:id` | 删除工作流定义 | P0 |
| POST | `/api/v1/workflows/:id/instances` | 创建并启动实例 | P0 |
| GET | `/api/v1/workflows/:id/instances` | 查询实例列表 | P0 |
| GET | `/api/v1/instances/:id` | 查询实例详情 | P0 |
| GET | `/api/v1/instances/:id/state` | 查询实例轻量状态 | P1 |
| POST | `/api/v1/tasks` | 创建任务 | P0 |
| GET | `/api/v1/tasks/:id` | 查询任务详情 | P0 |
| PUT | `/api/v1/tasks/:id` | 更新任务（表单数据） | P1 |
| POST | `/api/v1/tasks/:id/complete` | 完成任务 | P0 |
| GET | `/api/v1/tasks/overdue` | 查询超时任务 | P2 |
| POST | `/api/v1/triggers` | 创建触发器 | P0 |
| GET | `/api/v1/triggers` | 触发器列表 | P0 |
| GET | `/api/v1/triggers/:id` | 查询触发器 | P0 |
| PUT | `/api/v1/triggers/:id` | 更新触发器 | P0 |
| DELETE | `/api/v1/triggers/:id` | 删除触发器 | P0 |
| GET | `/api/v1/workflows/:id/triggers` | 查询工作流的触发器 | P1 |
| GET | `/api/v1/dependencies/cycles` | 循环依赖检测 | P1 |
| GET | `/api/v1/dependencies/visualization` | 依赖关系可视化 | P2 |
| POST | `/api/v1/instances/cleanup` | 手动触发实例清理 | P2 |

### 3.3 请求/响应结构规范

**通用分页查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码（从 1 开始） |
| page_size | int | 20 | 每页数量（上限 100） |

**通用响应格式**:

| 场景 | HTTP 状态码 | Body |
|------|:----------:|------|
| 创建成功 | `201` | 完整资源对象 |
| 查询成功（单条） | `200` | 完整资源对象 |
| 查询成功（列表） | `200` | `{"data": [...]}` |
| 计数成功 | `200` | `{"count": N}` |
| 删除成功 | `200` | `{"message": "deleted"}` |
| 请求参数错误 | `400` | `{"error": "..."}` |
| 资源不存在 | `404` | `{"error": "..."}` |
| 服务端错误 | `500` | `{"error": "..."}` |

---

## 四、数据模型

### 4.1 数据库表结构

| 表名 | 用途 | 核心字段 | 是否已迁移 |
|------|------|---------|:---------:|
| `lowcode_apps` | 低代码组件库 | id, tenant_id, name, component_type, schema(JSONB), version | ✅ |
| `lowcode_workflow_definition` | 工作流定义模板 | id, tenant_id, name, nodes(JSONB), edges(JSONB), enabled, version | ✅ |
| `lowcode_workflow_instance` | 工作流运行实例 | id, workflow_id, status, current_node_id, variables(JSONB), history(JSONB), input/output(JSONB) | ✅ |
| `workflow_timers` | 延时/定时节点调度 | id, instance_id, timer_type, cron_expression, scheduled_at, status, max_executions | ✅ |
| `workflow_tasks` | 人工/系统任务 | id, instance_id, task_type, assignee_id, candidate_users(JSONB), status, due_date | ✅ |
| `workflow_triggers` | 事件/cron 触发器 | id, workflow_id, type, enabled, event_filter(JSONB), cron_expression | ✅ |
| `workflow_sub_workflow_dependencies` | 子工作流依赖追踪 | parent_instance_id, child_instance_id, node_id | ✅ |

### 4.2 关键模型关系

```
WorkflowDefinition 1 ──→ N WorkflowInstance
WorkflowDefinition 1 ──→ N WorkflowTrigger
WorkflowInstance  1 ──→ N WorkflowTask
WorkflowInstance  1 ──→ N WorkflowTimer
WorkflowInstance  N ──→ N WorkflowInstance (via sub_workflow_dependencies)
```

### 4.3 工作流节点类型枚举

| 节点类型 | 标识 | 配置模型 | 说明 |
|---------|------|---------|------|
| 开始 | `start` | StartNodeConfig | 工作流入口，定义输出变量 |
| 审批 | `approval` | ApprovalNodeConfig | 支持 or/and 审批、超时处理、驳回策略 |
| 条件 | `condition` | ConditionNodeConfig | 按条件表达式分支，多分支可选 |
| 通知 | `notification` | NotificationNodeConfig | 多渠道通知（钉钉/企微/飞书/邮件） |
| Webhook | `webhook` | WebhookNodeConfig | HTTP 调用，支持重试与超时 |
| 结束 | `end` | EndNodeConfig | 工作流出口，定义输出变量 |
| 任务 | `task` | TaskNodeConfig | 人工或系统任务，含表单、超时、优先级 |
| 子工作流 | `sub-workflow` | SubWorkflowNodeConfig | 嵌套子流程，支持输入/输出变量映射 |
| 延时 | `delay` | DelayNodeConfig | 固定延时，支持事件提前唤醒 |
| 定时器 | `timer` | TimerNodeConfig | 基于 cron 表达式的重复调度 |

### 4.4 工作流实例状态机

```
pending → running → ... → completed
                    └→ suspended → running
                    └→ failed
                    └→ terminated
```

### 4.5 JSONB 序列化辅助类型

为支持 PostgreSQL JSONB 列，模型层定义了以下辅助类型：

| 类型 | Go 类型 | 用途 |
|------|---------|------|
| `JSONB` | `map[string]interface{}` | 通用 JSONB（schema, variables, config 等） |
| `WorkflowNodeList` | `[]WorkflowNode` | 节点列表 JSONB |
| `WorkflowEdgeList` | `[]WorkflowEdge` | 连线列表 JSONB |
| `HistoryList` | `[]WorkflowHistory` | 执行历史 JSONB |
| `StringList` | `[]string` | 字符串数组 JSONB（candidate_users/roles） |

### 4.6 哨兵错误

| 错误值 | 触发条件 |
|--------|---------|
| `ErrNotFound` | 资源不存在 |
| `ErrNotEnabled` | 工作流未启用 |
| `ErrInvalidStatus` | 实例状态不允许操作 |
| `ErrCircularDependency` | 检测到循环依赖 |
| `ErrNoStartNode` | 工作流定义缺少 start 节点 |
| `ErrNoMatchingBranch` | condition 节点无匹配分支 |
| `ErrNoOutgoingEdge` | 节点缺少出边 |

---

## 五、依赖与集成

### 5.1 外部依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Go | 1.25 | 运行时 |
| PostgreSQL | ≥ 13 | 持久化存储 |
| Redis | ≥ 6 | JWT 黑名单缓存 |
| `orion/go-common` | replace 指向 `../orion-go-common` | 共享库：auth、database、logger、middleware、redis |

### 5.2 Go 模块依赖

| 模块 | 用途 |
|------|------|
| `github.com/gin-gonic/gin v1.10.0` | HTTP 框架 |
| `github.com/google/uuid v1.6.0` | UUID 生成 |
| `github.com/jmoiron/sqlx v1.4.0` | PostgreSQL 扩展驱动 |
| `github.com/lib/pq` | PostgreSQL 驱动（间接） |
| `github.com/go-playground/validator/v10` | 请求参数校验（间接） |

### 5.3 集成点

| 集成对象 | 方式 | 说明 |
|---------|------|------|
| API 网关 (orion-api-gateway) | HTTP 反向代理 | 通过网关统一入口暴露 `/api/v1/apps` |
| JWT 认证服务 | 共享 JWT Secret + Redis | 同一套 JWT 签发与黑名单机制 |
| 事件总线（待定） | 未接入 | 工作流触发器的事件驱动能力需事件总线支持 |
| 通知服务 | HTTP/SDK（待实现） | notification 节点的多渠道通知调用 |
| Webhook 目标 | HTTP | webhook 节点的外部 HTTP 调用 |
| 平台级 lowcode 模块 | 数据库（异源） | 当前 Go 服务有独立表，与 platform-service 表不同步 |

### 5.4 环境变量

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `PORT` | int | `8080` | 服务监听端口 |
| `DB_HOST` | string | `localhost` | 数据库主机 |
| `DB_PORT` | int | `5432` | 数据库端口 |
| `DB_USER` | string | **必填** | 数据库用户 |
| `DB_PASSWORD` | string | **必填** | 数据库密码 |
| `DB_NAME` | string | `orion_lowcode` | 数据库名 |
| `DB_SSLMODE` | string | `disable` | SSL 模式 |
| `JWT_SECRET` | string | `change-me-in-production` | JWT 签名密钥 |
| `REDIS_ADDR` | string | `localhost:6379` | Redis 地址 |

### 5.5 技术栈

```
┌──────────────────────────────────────────────────────────────┐
│                    HTTP / Gin v1.10.0                        │
├──────────────────────────────────────────────────────────────┤
│  Handler 层 (路由注册 + JSON 序列化 + 参数校验 + 权限检查)   │
├──────────────────────────────────────────────────────────────┤
│  Service 层 (业务编排 + 事务边界)                             │
├──────────────────────────────────────────────────────────────┤
│  Repository 层 (sqlx + PostgreSQL JSONB + 原子操作)          │
├──────────────────────────────────────────────────────────────┤
│  共享库 orion/go-common (auth/database/logger/middleware)    │
├──────────────────────────────────────────────────────────────┤
│  PostgreSQL 13+  |  Redis 6+                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 六、注意事项

### 6.1 已知差距

1. **路由层（handler）与模型层不匹配**: `models.go` 定义了完整的工作流领域模型（624 行），但 handler 仅暴露了 LowCodeApp CRUD（5 个端点）。工作流定义的 CRUD、实例管理、任务调度、触发器管理均无 API 入口——**这是当前最大的实现缺口**。

2. **Service 层过于单薄**: 当前 `lowcode_service.go` 仅负责 LowCodeApp CRUD 的透传调用，无任何工作流引擎运行时逻辑（节点执行、状态机、变量传递等）。完整的引擎实现需要新增 `workflow_service.go`、`instance_service.go`、`task_service.go`、`timer_service.go`、`trigger_service.go`。

3. **测试覆盖严重不足**: 仅 2 个基本测试，无任何 handler/service/repository 集成测试。满编后应有 ≥ 6 个测试文件，覆盖所有 CRUD + 状态机 + 边界条件。

4. **与 platform-service 低代码模块双写问题**: `orion-platform-service` 的 `src/services/lowcode/` 已有低代码相关实现。当前 Go 微服务使用独立数据库表（`lowcode_apps` 等），与平台级表不同步。未来需确定是替代关系还是并行关系。

5. **缺少事件总线集成**: `WorkflowTrigger` 的 `event` 类型需要事件总线支持才能工作，当前无事件发布/订阅机制。

### 6.2 演进建议

| 优先级 | 改进项 | 影响 |
|:------:|--------|------|
| **P0** | 为 WorkflowDefinition 实现 API 层（CRUD + 列表 + 启用/停用） | 解封工作流核心能力 |
| **P0** | 为 WorkflowInstance 实现创建与查询 API | 使工作流可执行 |
| **P0** | 实现 WorkflowTask 完成任务 API + 超时调度 goroutine | 人工任务流转 |
| **P0** | 实现 WorkflowTrigger CRUD + cron 调度循环 | 自动化触发 |
| **P1** | 工作流实例状态机运行时（Service 层） | 引擎闭环 |
| **P1** | WorkflowTimer 调度循环（基于 FindPendingTimers） | 定时/延时节点运行 |
| **P1** | 循环依赖检测的 Service 层实现 | 防止生产死循环 |
| **P2** | 集成事件总线（用于 event 类型触发器） | 事件驱动工作流 |
| **P2** | 编写完整测试套件（handler/service/repository） | 质量保障 |
| **P2** | 与 platform-service 低代码模块数据同步方案 | 架构统一 |
| **P3** | 工作流导入/导出 JSON（平台级文档需求） | 可迁移性 |
| **P3** | 运行时调试能力（单步执行、断点） | 开发者体验 |

### 6.3 架构约束

- **多租户安全**: 所有数据查询必须携带 `tenant_id` 过滤（当前已强制执行）
- **原子性**: Timer 抢占使用 `FOR UPDATE SKIP LOCKED`，防止重复调度
- **递归深度**: 子工作流依赖的递归 CTE 可能有深度限制，需监控
- **JSONB 大小**: `history` 和 `variables` 字段随实例运行持续增长，建议对大实例的历史定期归档

---

_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
