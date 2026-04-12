# F301 - Pipeline 引擎核心服务技术方案

## 1. 架构设计

### 1.1 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                  API Gateway Layer                       │
│  ┌───────────┬───────────┬───────────┬───────────┐     │
│  │ Pipeline  │PipelineRun│  Stage    │   Task    │     │
│  │  Routes   │  Routes   │  Routes   │  Routes   │     │
│  └───────────┴───────────┴───────────┴───────────┘     │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                 Service Layer                            │
│  ┌────────────┬──────────────┬────────────┬──────────┐ │
│  │ Pipeline   │ PipelineRun  │   Stage    │   Task   │ │
│  │  Service   │   Service    │  Service   │Scheduler │ │
│  └────────────┴──────────────┴────────────┴──────────┘ │
│                      │                                  │
│  ┌──────────────────────────────────────────┐          │
│  │         Pipeline Event Publisher         │          │
│  └──────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  Engine Layer                            │
│  ┌─────────────┬──────────────┬────────────────┐       │
│  │  Pipeline   │   Stage      │    Task        │       │
│  │   Engine    │  Executor    │    Runner      │       │
│  └─────────────┴──────────────┴────────────────┘       │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  Data Layer                              │
│  ┌────────────┬──────────────┬────────────┬──────────┐ │
│  │ PostgreSQL │    Redis     │    NATS    │  Models  │ │
│  │  (持久化)  │   (缓存)     │  (事件总线)│          │ │
│  └────────────┴──────────────┴────────────┴──────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 2. 数据模型设计

### 2.1 Pipeline 表
```sql
CREATE TABLE pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    yaml_definition TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, deleted
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, version)
);

CREATE INDEX idx_pipelines_name ON pipelines(name);
CREATE INDEX idx_pipelines_status ON pipelines(status);
```

### 2.2 PipelineRun 表
```sql
CREATE TABLE pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES pipelines(id),
    pipeline_version VARCHAR(50),
    trigger_type VARCHAR(50), -- manual, api, event, schedule
    trigger_by VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, success, failed, cancelled
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms BIGINT,
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pipeline_runs_pipeline_id ON pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_created_at ON pipeline_runs(created_at);
```

### 2.3 Stage 表
```sql
CREATE TABLE stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sequence INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, success, failed, skipped
    depends_on UUID[] DEFAULT '{}',
    condition TEXT,
    timeout_seconds INT DEFAULT 3600,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms BIGINT,
    result JSONB,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stages_run_id ON stages(run_id);
CREATE INDEX idx_stages_status ON stages(status);
```

### 2.4 Task 表
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID REFERENCES stages(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- git/checkout, npm/run, etc.
    sequence INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, success, failed, skipped
    config JSONB DEFAULT '{}',
    parameters JSONB DEFAULT '{}',
    resource_quota JSONB,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 0,
    timeout_seconds INT DEFAULT 600,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms BIGINT,
    result JSONB,
    log TEXT,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_stage_id ON tasks(stage_id);
CREATE INDEX idx_tasks_status ON tasks(status);
```

## 3. API 设计

### 3.1 Pipeline APIs

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/pipelines | 创建 Pipeline |
| GET | /api/v1/pipelines | 获取 Pipeline 列表 |
| GET | /api/v1/pipelines/:id | 获取 Pipeline 详情 |
| GET | /api/v1/pipelines/:id/versions | 获取 Pipeline 所有版本 |
| PUT | /api/v1/pipelines/:id | 更新 Pipeline |
| DELETE | /api/v1/pipelines/:id | 删除 Pipeline |
| POST | /api/v1/pipelines/:id/validate | 验证 Pipeline 定义 |

### 3.2 PipelineRun APIs

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/pipelines/:id/runs | 触发 Pipeline 执行 |
| GET | /api/v1/pipeline-runs | 获取 PipelineRun 列表 |
| GET | /api/v1/pipeline-runs/:id | 获取 PipelineRun 详情 |
| POST | /api/v1/pipeline-runs/:id/cancel | 取消 PipelineRun |
| GET | /api/v1/pipeline-runs/:id/stages | 获取 Stage 列表 |
| GET | /api/v1/pipeline-runs/:id/tasks | 获取 Task 列表 |

### 3.3 Stage APIs

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/stages/:id | 获取 Stage 详情 |
| POST | /api/v1/stages/:id/retry | 重试 Stage |
| GET | /api/v1/stages/:id/tasks | 获取 Stage 下的 Tasks |

### 3.4 Task APIs

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/tasks/:id | 获取 Task 详情 |
| POST | /api/v1/tasks/:id/retry | 重试 Task |
| GET | /api/v1/tasks/:id/log | 获取 Task 日志 |

## 4. 核心组件设计

### 4.1 PipelineEngine

负责 Pipeline 执行的整体编排：
- 解析 Pipeline YAML 定义
- 创建 PipelineRun 实例
- 初始化 Stages 和 Tasks
- 协调 Stage 执行顺序
- 发布执行事件

### 4.2 StageExecutor

负责 Stage 的执行：
- 检查 Stage 前置条件
- 执行 Stage 内的 Tasks
- 处理 Stage 超时和重试
- 更新 Stage 状态

### 4.3 TaskRunner

负责 Task 的执行：
- 解析 Task 配置
- 执行具体任务逻辑
- 收集 Task 日志
- 处理 Task 重试

### 4.4 TaskScheduler

负责 Task 调度：
- 依赖解析
- 并发控制
- 资源配额管理
- 任务队列管理

### 4.5 PipelineEventPublisher

负责事件发布：
- pipeline.run.created
- pipeline.run.started
- pipeline.run.completed
- pipeline.run.failed
- pipeline.stage.started
- pipeline.stage.completed
- pipeline.stage.failed

## 5. 执行流程

### 5.1 Pipeline 执行流程

```
1. 接收执行请求
   │
   ▼
2. 验证 Pipeline 定义
   │
   ▼
3. 创建 PipelineRun (status=pending)
   │
   ▼
4. 发布 pipeline.run.created 事件
   │
   ▼
5. 解析 Stages 依赖关系
   │
   ▼
6. 更新 PipelineRun (status=running)
   │
   ▼
7. 发布 pipeline.run.started 事件
   │
   ▼
8. 执行 Stages (按依赖关系)
   │
   ├──► 检查 Stage 前置条件
   │    │
   │    ▼
   │    执行 Stage Tasks
   │    │
   │    ▼
   │    更新 Stage 状态
   │    │
   │    ▼
   │    发布 pipeline.stage.* 事件
   │
   ▼
9. 所有 Stages 完成
   │
   ▼
10. 更新 PipelineRun 状态
    │
    ├──► 全部成功 → success
    ├──► 任一失败 → failed
    └──► 被取消 → cancelled
    │
    ▼
11. 发布 pipeline.run.completed/failed 事件
```

### 5.2 Stage 执行流程

```
1. 检查 Stage 条件（if 表达式）
   │
   ▼
2. 等待依赖 Stages 完成
   │
   ▼
3. 检查依赖结果是否满足条件
   │
   ▼
4. 更新 Stage (status=running)
   │
   ▼
5. 发布 pipeline.stage.started 事件
   │
   ▼
6. 按顺序执行 Tasks
   │
   ▼
7. 更新 Stage (status=success/failed)
   │
   ▼
8. 发布 pipeline.stage.completed/failed 事件
```

## 6. 目录结构

```
orion-platform-service/
├── src/
│   ├── index.ts                    # 入口文件（更新）
│   ├── app.ts                      # 应用配置（更新）
│   ├── api/
│   │   ├── routes.ts               # 路由注册
│   │   ├── controllers/
│   │   │   ├── PipelineController.ts
│   │   │   ├── PipelineRunController.ts
│   │   │   ├── StageController.ts
│   │   │   └── TaskController.ts
│   │   └── validators/
│   │       ├── PipelineValidator.ts
│   │       └── schemas.ts
│   ├── services/
│   │   ├── PipelineService.ts
│   │   ├── PipelineRunService.ts
│   │   ├── StageService.ts
│   │   └── TaskScheduler.ts
│   ├── engine/
│   │   ├── PipelineEngine.ts
│   │   ├── StageExecutor.ts
│   │   └── TaskRunner.ts
│   ├── models/
│   │   ├── Pipeline.ts
│   │   ├── PipelineRun.ts
│   │   ├── Stage.ts
│   │   └── Task.ts
│   ├── events/
│   │   └── PipelineEventPublisher.ts
│   └── config/
│       └── index.ts                # 配置（更新）
├── __tests__/
│   ├── api/
│   ├── services/
│   └── engine/
└── package.json                    # 更新依赖
```

## 7. 依赖包

需要安装的包：
- `js-yaml` - YAML 解析
- `ajv` - JSON Schema 验证
- `express-validator` - 请求验证
- `uuid` - UUID 生成（已有）

## 8. 实现计划

1. 数据模型定义 (models/)
2. 数据库迁移脚本
3. Pipeline CRUD 服务 (PipelineService)
4. PipelineRun 执行引擎 (PipelineEngine)
5. Stage 编排 (StageExecutor)
6. Task 调度 (TaskRunner, TaskScheduler)
7. API 控制器和路由
8. 事件发布 (PipelineEventPublisher)
9. 单元测试
10. 集成测试
11. API 文档
