# Spec: Runner 服务 (runner)

## 1. 模块概述

### 功能描述
Runner 服务管理流水线执行代理（Runner）的注册、健康检查和任务分发。支持 Runner 的自动发现、负载均衡和任务调度。

### 架构
- **框架**：Gin HTTP
- **分层**：handler → service → repository → models
- **认证**：`RequirePermission("runner", action)`
- **多租户**：所有查询带 `tenant_id` 过滤
- **存储**：PostgreSQL

### 与 TypeScript 实现的差异
- TS 实现：`orion-platform-service/src/services/pipeline/` 中的 PipelineEngine
- Go 实现：独立微服务，专注于 Runner 代理管理和任务分发

## 2. API 端点

**Base 路径**：`/api/v1/runner`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /runners | 查询 Runner 列表 | runner:read |
| POST | /runners | 注册 Runner | runner:write |
| GET | /runners/:id | 获取 Runner 详情 | runner:read |
| DELETE | /runners/:id | 注销 Runner | runner:delete |
| POST | /runners/:id/heartbeat | 发送心跳 | runner:write |
| GET | /runners/:id/jobs | 查询 Runner 任务 | runner:read |
| POST | /jobs | 创建任务 | runner:write |
| GET | /jobs | 查询任务列表 | runner:read |
| GET | /jobs/:id | 获取任务详情 | runner:read |
| PATCH | /jobs/:id/status | 更新任务状态 | runner:write |
| GET | /runs | 查询执行记录 | runner:read |
| POST | /runs | 创建执行记录 | runner:write |
| PATCH | /runs/:id/status | 更新执行状态 | runner:write |
| GET | /runs/:id/stages | 查询 Stage 列表 | runner:read |
| POST | /stages | 创建 Stage | runner:write |
| PATCH | /stages/:id/status | 更新 Stage 状态 | runner:write |
| GET | /stages/:id/tasks | 查询 Task 列表 | runner:read |
| POST | /tasks | 创建 Task | runner:write |
| PATCH | /tasks/:id/status | 更新 Task 状态 | runner:write |
| GET | /tasks/:id/logs | 获取 Task 日志 | runner:read |

## 3. 数据模型

### Runner
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| name | VARCHAR | Runner 名称 |
| agent_token | VARCHAR | 认证 Token |
| status | VARCHAR | 状态 (idle/busy/offline) |
| labels | JSONB | 标签 (用于调度匹配) |
| capacity | INT | 并发容量 |
| current_jobs | INT | 当前任务数 |
| last_heartbeat | TIMESTAMP | 最后心跳时间 |
| registered_at | TIMESTAMP | 注册时间 |

### PipelineRun
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| pipeline_template_id | UUID | 模板 ID |
| runner_id | UUID | 分配 Runner |
| status | VARCHAR | 状态 |
| triggered_by | VARCHAR | 触发人 |
| parameters | JSONB | 运行参数 |
| started_at | TIMESTAMP | 开始时间 |
| finished_at | TIMESTAMP | 结束时间 |

### StageExecution
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| run_id | UUID | 关联 Run |
| name | VARCHAR | Stage 名称 |
| status | VARCHAR | 状态 |
| started_at | TIMESTAMP | 开始时间 |
| finished_at | TIMESTAMP | 结束时间 |

### TaskExecution
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| stage_id | UUID | 关联 Stage |
| name | VARCHAR | Task 名称 |
| status | VARCHAR | 状态 |
| command | TEXT | 执行命令 |
| exit_code | INT | 退出码 |
| started_at | TIMESTAMP | 开始时间 |
| finished_at | TIMESTAMP | 结束时间 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| RUN-01 | Runner 注册后可在列表中查询 | 单元测试 |
| RUN-02 | 心跳超时后 Runner 状态变为 offline | 集成测试 |
| RUN-03 | 任务分发时选择空闲 Runner | 单元测试 |
| RUN-04 | Run 创建后自动触发 Stage 调度 | 集成测试 |
| RUN-05 | 多租户隔离：不同租户 Runner 互不可见 | 集成测试 |
| RUN-06 | Stage 失败触发补偿流程 | 单元测试 |
| RUN-07 | Task 日志可实时查询 | 集成测试 |
| RUN-08 | Runner 容量满时新任务排队等待 | 单元测试 |

## 5. 测试策略

| 类型 | 用例数 | 覆盖范围 |
|------|--------|---------|
| 单元测试 | 30+ | handler/service/repository |
| 集成测试 | 15+ | Runner 注册/心跳/任务分发全流程 |
| 前端测试 | 5+ | Runner 列表/任务队列页面 |
