# Orion Pipeline Service API 文档

## 概述

Pipeline Service 是 Orion 平台的核心服务，提供 Pipeline 定义、执行、编排和调度功能。

**版本**: 1.0.0  
**基础路径**: `/api/v1`

## 认证

当前版本不需要认证。

---

## Pipeline 资源

### 创建 Pipeline

**请求**

```http
POST /api/v1/pipelines
Content-Type: application/json
```

**请求体**

```json
{
  "name": "build-and-deploy",
  "version": "1.0.0",
  "description": "构建并部署 Pipeline",
  "yamlDefinition": "apiVersion: orion.io/v1\nkind: Pipeline\nmetadata:\n  name: build-and-deploy\n  version: \"1.0.0\"\nspec:\n  stages:\n    - name: build\n      runsOn: linux\n      steps:\n        - name: checkout\n          uses: git/checkout@v1\n",
  "createdBy": "user-id"
}
```

**响应**

```http
Status: 201 Created
```

```json
{
  "id": "uuid",
  "name": "build-and-deploy",
  "version": "1.0.0",
  "description": "构建并部署 Pipeline",
  "status": "active",
  "createdAt": "2026-04-11T12:00:00.000Z"
}
```

### 获取 Pipeline 列表

**请求**

```http
GET /api/v1/pipelines?name={name}&status={status}&limit={limit}&offset={offset}
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | 按名称过滤 |
| status | string | 否 | 按状态过滤 (active/inactive/deleted) |
| limit | integer | 否 | 每页数量，默认 100 |
| offset | integer | 否 | 偏移量，默认 0 |

**响应**

```http
Status: 200 OK
```

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "build-and-deploy",
      "version": "1.0.0",
      "description": "构建并部署 Pipeline",
      "status": "active",
      "createdAt": "2026-04-11T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 获取 Pipeline 详情

**请求**

```http
GET /api/v1/pipelines/:id
```

**响应**

```http
Status: 200 OK
```

```json
{
  "id": "uuid",
  "name": "build-and-deploy",
  "version": "1.0.0",
  "description": "构建并部署 Pipeline",
  "yamlDefinition": "...",
  "status": "active",
  "spec": {
    "triggers": [...],
    "stages": [...]
  },
  "createdBy": "user-id",
  "createdAt": "2026-04-11T12:00:00.000Z",
  "updatedAt": "2026-04-11T12:00:00.000Z"
}
```

### 获取 Pipeline 版本列表

**请求**

```http
GET /api/v1/pipelines/:id/versions
```

**响应**

```http
Status: 200 OK
```

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "build-and-deploy",
      "version": "1.0.0",
      "status": "active",
      "createdAt": "2026-04-11T12:00:00.000Z"
    },
    {
      "id": "uuid",
      "name": "build-and-deploy",
      "version": "2.0.0",
      "status": "active",
      "createdAt": "2026-04-11T13:00:00.000Z"
    }
  ],
  "total": 2
}
```

### 更新 Pipeline

**请求**

```http
PUT /api/v1/pipelines/:id
Content-Type: application/json
```

**请求体**

```json
{
  "description": "更新的描述",
  "yamlDefinition": "...",
  "status": "inactive"
}
```

**响应**

```http
Status: 200 OK
```

### 删除 Pipeline

**请求**

```http
DELETE /api/v1/pipelines/:id
```

**响应**

```http
Status: 204 No Content
```

### 验证 Pipeline YAML

**请求**

```http
POST /api/v1/pipelines/validate
Content-Type: application/json
```

**请求体**

```json
{
  "yamlDefinition": "apiVersion: orion.io/v1\nkind: Pipeline\n..."
}
```

**响应**

```http
Status: 200 OK
```

```json
{
  "valid": true,
  "errors": []
}
```

---

## PipelineRun 资源

### 触发 Pipeline 执行

**请求**

```http
POST /api/v1/pipelines/:id/runs
Content-Type: application/json
```

**请求体**

```json
{
  "triggerType": "manual",
  "triggerBy": "user-id",
  "context": {
    "git": {
      "ref": "refs/heads/main",
      "sha": "abc123"
    }
  }
}
```

**响应**

```http
Status: 201 Created
```

```json
{
  "id": "run-uuid",
  "pipelineId": "pipeline-uuid",
  "pipelineVersion": "1.0.0",
  "status": "pending",
  "triggerType": "manual",
  "triggerBy": "user-id",
  "createdAt": "2026-04-11T12:00:00.000Z"
}
```

### 获取 PipelineRun 列表

**请求**

```http
GET /api/v1/pipeline-runs?pipelineId={id}&status={status}&triggerType={type}&limit={limit}&offset={offset}
```

**响应**

```http
Status: 200 OK
```

### 获取 PipelineRun 详情

**请求**

```http
GET /api/v1/pipeline-runs/:id
```

**响应**

```http
Status: 200 OK
```

```json
{
  "run": {
    "id": "run-uuid",
    "pipelineId": "pipeline-uuid",
    "status": "running",
    "triggerType": "manual",
    "context": {...},
    "startedAt": "2026-04-11T12:00:00.000Z",
    "createdAt": "2026-04-11T12:00:00.000Z"
  },
  "stages": [
    {
      "id": "stage-uuid",
      "name": "build",
      "sequence": 0,
      "status": "success",
      "dependsOn": [],
      "startedAt": "2026-04-11T12:00:01.000Z",
      "completedAt": "2026-04-11T12:00:10.000Z",
      "durationMs": 9000
    }
  ],
  "tasks": [
    {
      "id": "task-uuid",
      "stageId": "stage-uuid",
      "name": "checkout",
      "type": "git/checkout",
      "sequence": 0,
      "status": "success",
      "startedAt": "2026-04-11T12:00:02.000Z",
      "completedAt": "2026-04-11T12:00:05.000Z",
      "durationMs": 3000
    }
  ]
}
```

### 取消 PipelineRun

**请求**

```http
POST /api/v1/pipeline-runs/:id/cancel
```

**响应**

```http
Status: 200 OK
```

```json
{
  "id": "run-uuid",
  "status": "cancelled",
  "cancelledAt": "2026-04-11T12:05:00.000Z"
}
```

### 获取 PipelineRun 的 Stages

**请求**

```http
GET /api/v1/pipeline-runs/:id/stages
```

**响应**

```http
Status: 200 OK
```

### 获取 PipelineRun 的 Tasks

**请求**

```http
GET /api/v1/pipeline-runs/:id/tasks
```

**响应**

```http
Status: 200 OK
```

---

## Stage 资源

### 获取 Stage 详情

**请求**

```http
GET /api/v1/stages/:id
```

**响应**

```http
Status: 200 OK
```

### 获取 Stage 的 Tasks

**请求**

```http
GET /api/v1/stages/:id/tasks
```

**响应**

```http
Status: 200 OK
```

### 重试 Stage

**请求**

```http
POST /api/v1/stages/:id/retry
```

**响应**

```http
Status: 200 OK
```

```json
{
  "id": "stage-uuid",
  "status": "pending",
  "retryCount": 1
}
```

---

## Task 资源

### 获取 Task 详情

**请求**

```http
GET /api/v1/tasks/:id
```

**响应**

```http
Status: 200 OK
```

### 获取 Task 日志

**请求**

```http
GET /api/v1/tasks/:id/log
```

**响应**

```http
Status: 200 OK
```

```json
{
  "taskId": "task-uuid",
  "log": "[INFO] Starting task: checkout\n[INFO] Task type: git/checkout\n[GIT] Executing checkout...\n[INFO] Task completed successfully"
}
```

### 重试 Task

**请求**

```http
POST /api/v1/tasks/:id/retry
```

**响应**

```http
Status: 200 OK
```

```json
{
  "id": "task-uuid",
  "status": "pending",
  "retryCount": 1
}
```

---

## 错误处理

所有错误返回统一格式：

```json
{
  "error": "ERROR_CODE",
  "message": "Error description",
  "timestamp": "2026-04-11T12:00:00.000Z"
}
```

### 常见错误码

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| VALIDATION_ERROR | 验证失败 | 400 |
| NOT_FOUND | 资源不存在 | 404 |
| CONFLICT | 资源冲突（如重复创建） | 409 |
| INVALID_STATE | 无效的状态（如重试非失败的 Stage） | 400 |
| MAX_RETRIES_EXCEEDED | 超过最大重试次数 | 400 |
| INTERNAL_ERROR | 内部错误 | 500 |

---

## Pipeline YAML 格式

### 完整示例

```yaml
apiVersion: orion.io/v1
kind: Pipeline
metadata:
  name: build-and-deploy
  version: "1.0.0"
  description: 构建并部署应用
spec:
  triggers:
    - type: git
      events: [push, pr]
      branches: [main, develop]
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
          with:
            namespace: production
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| apiVersion | string | 是 | API 版本，固定为 `orion.io/v1` |
| kind | string | 是 | 资源类型，固定为 `Pipeline` |
| metadata.name | string | 是 | Pipeline 名称 |
| metadata.version | string | 是 | Pipeline 版本 |
| metadata.description | string | 否 | 描述信息 |
| spec.triggers | array | 否 | 触发器列表 |
| spec.stages | array | 是 | Stage 列表 |

### Stage 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | Stage 名称 |
| runsOn | string | 是 | 运行环境 (linux/windows/macos) |
| steps | array | 是 | 步骤列表 |
| dependsOn | array | 否 | 依赖的 Stage 名称列表 |
| if | string | 否 | 执行条件表达式 |
| timeout | integer | 否 | 超时时间（秒），默认 3600 |
| retries | integer | 否 | 最大重试次数，默认 0 |

### Step 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | Step 名称 |
| uses | string | 是 | 使用的 Action，格式为 `owner/action@version` |
| with | object | 否 | 输入参数 |

---

## 事件

Pipeline Service 发布以下事件到 NATS：

| 事件主题 | 说明 |
|----------|------|
| pipeline.run.created | PipelineRun 创建 |
| pipeline.run.started | PipelineRun 开始执行 |
| pipeline.run.completed | PipelineRun 成功完成 |
| pipeline.run.failed | PipelineRun 执行失败 |
| pipeline.run.cancelled | PipelineRun 被取消 |
| pipeline.stage.started | Stage 开始执行 |
| pipeline.stage.completed | Stage 完成 |
| pipeline.stage.failed | Stage 失败 |
| pipeline.stage.skipped | Stage 被跳过 |
| pipeline.task.started | Task 开始执行 |
| pipeline.task.completed | Task 完成 |
| pipeline.task.failed | Task 失败 |
