# Orion Pipeline Service

Orion Pipeline Service 是 Orion 平台的核心服务，提供 Pipeline 定义、执行、编排和调度功能。

## 功能特性

- **Pipeline CRUD** - 创建/读取/更新/删除 Pipeline，支持版本管理
- **PipelineRun 执行引擎** - 触发 Pipeline 执行，管理执行状态
- **Stage 编排** - 支持 Stage 顺序执行/并行执行，条件判断
- **Task 调度** - Task 依赖解析，并发执行，日志收集
- **事件发布** - 集成 @orion/event-bus，发布完整的执行事件

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- npm >= 9.0.0

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 运行测试

```bash
npm test
npm run test:coverage
```

## 项目结构

```
orion-platform-service/
├── src/
│   ├── index.ts                    # 入口文件
│   ├── app.ts                      # Express 应用配置
│   ├── api/
│   │   ├── routes.ts               # 路由注册
│   │   ├── controllers/            # API 控制器
│   │   └── validators/             # 验证器
│   ├── services/
│   │   └── pipeline/               # Pipeline 服务
│   ├── engine/
│   │   ├── PipelineEngine.ts       # Pipeline 执行引擎
│   │   ├── StageExecutor.ts        # Stage 执行器
│   │   └── TaskRunner.ts           # Task 执行器
│   ├── models/
│   │   ├── Pipeline.ts             # Pipeline 模型
│   │   ├── PipelineRun.ts          # PipelineRun 模型
│   │   ├── Stage.ts                # Stage 模型
│   │   └── Task.ts                 # Task 模型
│   └── events/
│       └── PipelineEventPublisher.ts # 事件发布器
├── __tests__/
│   ├── api/                        # API 测试
│   ├── services/                   # 服务测试
│   └── engine/                     # 引擎测试
├── docs/
│   └── API.md                      # API 文档
└── package.json
```

## API 端点

### Pipeline

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/pipelines | 创建 Pipeline |
| GET | /api/v1/pipelines | 获取 Pipeline 列表 |
| GET | /api/v1/pipelines/:id | 获取 Pipeline 详情 |
| GET | /api/v1/pipelines/:id/versions | 获取版本列表 |
| PUT | /api/v1/pipelines/:id | 更新 Pipeline |
| DELETE | /api/v1/pipelines/:id | 删除 Pipeline |
| POST | /api/v1/pipelines/validate | 验证 Pipeline YAML |

### PipelineRun

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/pipelines/:id/runs | 触发 Pipeline 执行 |
| GET | /api/v1/pipeline-runs | 获取 PipelineRun 列表 |
| GET | /api/v1/pipeline-runs/:id | 获取 PipelineRun 详情 |
| POST | /api/v1/pipeline-runs/:id/cancel | 取消 PipelineRun |
| GET | /api/v1/pipeline-runs/:id/stages | 获取 Stages |
| GET | /api/v1/pipeline-runs/:id/tasks | 获取 Tasks |

### Stage

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/stages/:id | 获取 Stage 详情 |
| GET | /api/v1/stages/:id/tasks | 获取 Tasks |
| POST | /api/v1/stages/:id/retry | 重试 Stage |

### Task

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/tasks/:id | 获取 Task 详情 |
| GET | /api/v1/tasks/:id/log | 获取 Task 日志 |
| POST | /api/v1/tasks/:id/retry | 重试 Task |

详细 API 文档请参阅 [docs/API.md](docs/API.md)。

## Pipeline YAML 示例

```yaml
apiVersion: orion.io/v1
kind: Pipeline
metadata:
  name: build-and-deploy
  version: "1.0.0"
spec:
  stages:
    - name: build
      runsOn: linux
      steps:
        - name: checkout
          uses: git/checkout@v1
        - name: compile
          uses: npm/run@v1
          with:
            command: build
    - name: test
      runsOn: linux
      dependsOn: [build]
      steps:
        - name: unit-test
          uses: npm/test@v1
    - name: deploy
      runsOn: linux
      dependsOn: [test]
      if: github.ref == 'refs/heads/main'
      steps:
        - name: deploy-prod
          uses: k8s/deploy@v1
```

## 执行流程

1. **创建 Pipeline** - 通过 API 创建 Pipeline 定义
2. **触发执行** - 调用 `POST /api/v1/pipelines/:id/runs` 触发执行
3. **引擎编排** - PipelineEngine 解析依赖，编排 Stages 执行
4. **Stage 执行** - StageExecutor 按顺序执行 Tasks
5. **Task 执行** - TaskRunner 执行具体任务逻辑
6. **事件发布** - PipelineEventPublisher 发布执行事件

## 测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npx jest --coverage
```

### 测试覆盖范围

- PipelineService CRUD 操作
- PipelineRunService 执行管理
- TaskRunner 任务执行
- Pipeline API 集成测试

## 配置

通过环境变量配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3001 |
| HOST | 服务地址 | 0.0.0.0 |
| NATS_SERVERS | NATS 服务器地址 | nats://localhost:4222 |
| REDIS_HOST | Redis 主机 | localhost |
| REDIS_PORT | Redis 端口 | 6379 |
| DB_HOST | 数据库主机 | localhost |
| DB_PORT | 数据库端口 | 5432 |
| DB_NAME | 数据库名称 | orion |

## License

Apache-2.0
