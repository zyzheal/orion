# Spec: Workflow 服务 (workflow)

## 1. 模块概述

### 功能描述
Workflow 服务提供工作流引擎，支持工作流定义、实例执行和状态管理。提供 DAG 拓扑的任务编排和执行能力。

### 架构
- **框架**：Gin HTTP
- **分层**：handler → service → repository → models
- **认证**：`RequirePermission("workflow", action)`
- **多租户**：所有查询带 `tenant_id` 过滤
- **存储**：PostgreSQL

### 与 TypeScript 实现的差异
- TS 实现：`orion-platform-service/src/services/lowcode/` 和 `workflow-engine/`
- Go 实现：独立微服务，轻量级工作流引擎

## 2. API 端点

**Base 路径**：`/api/v1/workflow`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /workflows | 查询工作流列表 | workflow:read |
| POST | /workflows | 创建工作流 | workflow:write |
| GET | /workflows/:id | 获取工作流详情 | workflow:read |
| PUT | /workflows/:id | 更新工作流 | workflow:write |
| DELETE | /workflows/:id | 删除工作流 | workflow:delete |
| POST | /workflows/:id/start | 启动执行 | workflow:write |
| GET | /runs | 查询执行记录 | workflow:read |
| GET | /runs/:id | 获取执行详情 | workflow:read |
| POST | /runs/:id/cancel | 取消执行 | workflow:write |
| GET | /runs/:id/steps | 查询执行步骤 | workflow:read |

## 3. 数据模型

### Workflow
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| name | VARCHAR | 工作流名称 |
| description | TEXT | 描述 |
| definition | JSONB | DAG 定义 (nodes/edges) |
| variables | JSONB | 变量定义 |
| timeout_seconds | INT | 超时时间 |
| retry_policy | JSONB | 重试策略 |
| created_by | VARCHAR | 创建人 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### WorkflowRun
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| workflow_id | UUID | 关联工作流 |
| status | VARCHAR | 状态 (pending/running/completed/failed/cancelled) |
| input | JSONB | 输入参数 |
| output | JSONB | 输出结果 |
| current_node | VARCHAR | 当前执行节点 |
| error | TEXT | 错误信息 |
| started_at | TIMESTAMP | 开始时间 |
| finished_at | TIMESTAMP | 结束时间 |

### WorkflowStep
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| run_id | UUID | 关联执行 |
| node_id | VARCHAR | 节点 ID |
| node_type | VARCHAR | 节点类型 |
| status | VARCHAR | 状态 |
| input | JSONB | 输入 |
| output | JSONB | 输出 |
| error | TEXT | 错误信息 |
| started_at | TIMESTAMP | 开始时间 |
| finished_at | TIMESTAMP | 结束时间 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| WF-01 | 创建工作流后可在列表中查询 | 单元测试 |
| WF-02 | 工作流定义支持 DAG 拓扑 | 单元测试 |
| WF-03 | 执行后生成 WorkflowRun 记录 | 集成测试 |
| WF-04 | Step 按 DAG 拓扑顺序执行 | 集成测试 |
| WF-05 | 多租户隔离：不同租户工作流互不可见 | 集成测试 |
| WF-06 | 工作流超时自动终止 | 单元测试 |
| WF-07 | 取消执行后 Step 状态变为 cancelled | 集成测试 |
| WF-08 | 重试策略支持指数退避 | 单元测试 |

## 5. 测试策略

| 类型 | 用例数 | 覆盖范围 |
|------|--------|---------|
| 单元测试 | 20+ | handler/service/repository |
| 集成测试 | 10+ | DAG 执行全流程 |
| 前端测试 | 8+ | 工作流设计器/执行监控页面 |
