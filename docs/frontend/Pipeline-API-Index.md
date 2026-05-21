# Pipeline 模块 API 索引

> 本文档梳理 Pipeline 相关的 API 调用，统一入口，避免混淆。

---

## 核心原则

| 原则 | 说明 |
|------|------|
| **单一来源** | 相同功能的函数只在一个文件中定义 |
| **命名清晰** | `getPipeline` = 获取 Pipeline 定义，`getPipelineRun` = 获取运行记录 |
| **分层调用** | 页面组件 → API 函数 → 后端端点 |

---

## API 文件职责

### `pipelines.ts` - Pipeline 实体管理

| 函数 | 用途 | 端点 |
|------|------|------|
| `getPipelines(params?)` | 获取 Pipeline 列表（定义） | GET /v1/pipelines |
| `getPipeline(id)` | 获取单个 Pipeline 定义 | GET /v1/pipelines/:id |
| `createPipeline(data)` | 创建 Pipeline | POST /v1/pipelines |
| `updatePipeline(id, data)` | 更新 Pipeline | PUT /v1/pipelines/:id |
| `deletePipeline(id)` | 删除 Pipeline | DELETE /v1/pipelines/:id |
| `triggerPipeline(id, data)` | 触发 Pipeline 运行 | POST /v1/pipelines/:id/trigger |
| `getPipelineRuns(pipelineId, params?)` | **获取指定 Pipeline 的运行列表** | GET /v1/pipeline-runs?pipelineId=xxx |
| `getPipelineRun(runId)` | ~~获取运行详情~~（已废弃，请用 `getPipelineRunDetail`） | GET /v1/pipeline-runs/:id |
| `getPipelineErrorDetail(runId)` | 获取运行错误详情 | GET /v1/pipelines/:runId/error-detail |

### `pipelineRuns.ts` - 运行记录管理（推荐）

| 函数 | 用途 | 端点 |
|------|------|------|
| `getAllPipelineRuns(params?)` | 获取所有运行（全局列表） | GET /v1/pipeline-runs |
| `getPipelineRunDetail(runId)` | **获取单个运行的完整详情（含 stages）** | GET /v1/pipeline-runs/:id |
| `getPipelineRunStages(runId)` | 获取运行的阶段列表 | GET /v1/pipeline-runs/:id/stages |
| `retryPipelineRun(runId)` | 重试整个运行 | POST /v1/pipeline-runs/:id/retry |
| `retryFromStage(runId, stageId)` | 从指定阶段重试 | POST /v1/pipeline-runs/:id/retry?fromStage=xxx |
| `cancelPipelineRun(runId)` | 取消运行 | POST /v1/pipeline-runs/:id/cancel |

---

## 页面组件正确用法

### PipelineList（列表页）

```typescript
import { getPipelines } from '@/api/pipelines';

// 获取 Pipeline 定义列表
const pipelines = await getPipelines({ page: 1, pageSize: 20 });
```

### PipelineDetail（详情页）

```typescript
import { getPipeline, getPipelineRuns } from '@/api/pipelines';
import { getPipelineRunDetail } from '@/api/pipelineRuns';

// 1. 获取 Pipeline 定义（基本信息）
const pipeline = await getPipeline(id);

// 2. 获取该 Pipeline 的运行列表
const runs = await getPipelineRuns(id);

// 3. 获取某次运行的完整详情（包含 stages、tasks、logs）
const runDetail = await getPipelineRunDetail(runId);

// 4. 获取运行的阶段列表（可选，性能更好）
const stages = await getPipelineRunStages(runId);
```

### PipelineRunList（运行列表页）

```typescript
import { getAllPipelineRuns } from '@/api/pipelineRuns';

// 获取所有 Pipeline 运行记录（全局视图）
const allRuns = await getAllPipelineRuns({ status: 'failed' });
```

### 触发/重试/取消

```typescript
import { triggerPipeline } from '@/api/pipelines';
import { retryPipelineRun, cancelPipelineRun, retryFromStage } from '@/api/pipelineRuns';

// 触发新运行
await triggerPipeline(pipelineId, { branch: 'main' });

// 重试整个运行
await retryPipelineRun(runId);

// 从指定阶段重试
await retryFromStage(runId, 'stage-2');

// 取消运行
await cancelPipelineRun(runId);
```

---

## 废弃/不推荐用法

| 旧用法 | 问题 | 替代方案 |
|--------|------|----------|
| `getPipelineRun` (pipelines.ts) | 名称与 `getPipeline` 相似，易混淆 | 使用 `getPipelineRunDetail` (pipelineRuns.ts) |
| `cancelPipelineRun` (pipelines.ts) | 重复定义 | 使用 `pipelineRuns.ts` 中的版本 |
| `retryPipelineRun` (pipelines.ts) | 重复定义 | 使用 `pipelineRuns.ts` 中的版本 |

---

## 数据结构对应

### Pipeline vs PipelineRun

| 概念 | 说明 | 示例字段 |
|------|------|----------|
| **Pipeline** | 流水线定义（模板） | id, name, definition, triggers |
| **PipelineRun** | 流水线运行实例 | id, pipelineId, status, stages, branch |

### Stage vs Task vs Step

| 概念 | 说明 | 来源 |
|------|------|------|
| **Stage** | 阶段（Build/Test/Deploy） | runDetail.stages[] |
| **Task** | 任务（阶段内的具体任务） | runDetail.tasks[] |
| **Step** | 步骤（Task 内的详细步骤） | stage.steps[] 或 stageTasks[].logs |

---

## 快速查阅

| 需求 | 使用的 API |
|------|------------|
| 查看有哪些 Pipeline | `getPipelines()` |
| 查看某个 Pipeline 的定义 | `getPipeline(id)` |
| 查看某 Pipeline 的所有运行 | `getPipelineRuns(pipelineId)` |
| 查看某次运行的详情（含日志） | `getPipelineRunDetail(runId)` |
| 查看运行包含哪些阶段 | `getPipelineRunStages(runId)` 或 `getPipelineRunDetail().stages` |
| 触发新运行 | `triggerPipeline(id)` |
| 重新运行 | `retryPipelineRun(runId)` |
| 从某阶段重试 | `retryFromStage(runId, stageId)` |
| 取消运行中 | `cancelPipelineRun(runId)` |