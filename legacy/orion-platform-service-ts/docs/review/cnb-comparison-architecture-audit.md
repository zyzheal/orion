# CNB 对比设计文档 - 架构审计报告

> **审计日期**: 2026-04-19
> **审计分支**: feat/frontend-gap-implementation
> **审计范围**: 设计文档 vs 实际代码架构一致性分析

---

## 1. 架构问题 (Architecture Problems)

### 1.1 [严重] 插件系统已存在但设计文档完全忽略

设计文档将 Gap 1（插件化任务系统）描述为"从零开始构建 PluginRegistry"，但代码库中已经存在完整的插件基础设施：

- **`src/services/plugin-manager-service.ts`**: 完整的插件生命周期管理（AVAILABLE → INSTALLED → ACTIVE → CONFIGURED → INACTIVE → UNINSTALLED），支持 6 种插件类型（CUSTOM_TASK, WEBHOOK_HANDLER, AI_SKILL, APPROVAL_PROVIDER, NOTIFICATION_CHANNEL, DEPLOYMENT_STRATEGY）
- **`src/services/plugin-executor-service.ts`**: 插件执行引擎，支持三种安全等级运行时（WASM 沙箱 / 容器隔离 / 独立进程），包含资源配额管理、审计日志、输入验证、安全事件监控
- **`src/api/plugin-spi-routes.ts`**: 完整的 REST API（注册、发现、安装、卸载、启用、禁用、执行、取消、健康检查）
- **`src/routes-plugin.ts`**: 额外的插件管理路由

**设计文档的问题**: 将已有系统当作不存在，提出了重复的 `TaskPlugin` / `PluginRegistry` 接口设计，与实际代码中的 `PluginManagerService` / `PluginExecutorService` 架构完全不同。

### 1.2 [严重] 插件系统与 Pipeline 执行引擎未连接

代码库中存在两条完全独立的执行路径：

```
路径 A (旧): PipelineEngine → StageExecutor → TaskRunner (硬编码 5 种类型)
路径 B (新): PluginManagerService → PluginExecutorService (完整插件系统)
```

`StageExecutor` 直接注入 `TaskRunner`，从未使用 `PluginExecutorService`。`PluginExecutorService` 的 `executeTask()` 方法定义了完整的 `TaskExecutionRequest` 接口（包含 taskId, pipelineRunId, stageId, pluginId, workspace），但没有任何代码从 PipelineEngine 调用它。

**这是真正的 P0 问题**，不是"从零构建插件系统"，而是"将已有的插件执行引擎桥接到 Pipeline 执行链路"。

### 1.3 [中等] 设计文档的 TaskPlugin 接口与实际 Task 模型不匹配

设计文档提出:
```typescript
interface TaskPlugin {
  name: string;
  version: string;
  execute(params: TaskParams, signal?: AbortSignal): Promise<TaskResult>;
}
```

实际 `Task` 模型 (`src/models/Task.ts`) 包含: `id`, `stageId`, `name`, `type`, `sequence`, `config`, `parameters`, `resourceQuota`, `retryCount`, `maxRetries`, `timeoutSeconds` 等字段。`PluginExecutorService` 的 `TaskExecutionRequest` 接口已经定义了更完整的参数结构（包含 workspace, env, tenantId 等）。

设计文档的接口定义过于简化，无法承载现有 Task 模型的完整信息。

### 1.4 [轻微] YAML 解析已使用 js-yaml

设计文档 Gap 5 提出"替换当前 YAML 解析库为 js-yaml"。但 `src/models/Pipeline.ts` 第 103 行已经在 `parsePipelineYaml()` 中使用 `require('js-yaml')`。js-yaml 原生支持 anchors/aliases/merge，只需确认 `js-yaml` 的 `load()` 调用是否正确处理了这些语法即可（默认已支持）。

### 1.5 [中等] 两条执行引擎并存

`PipelineEngine` 和 `PipelineSaga` 是两套独立的执行引擎：
- `PipelineEngine`: 使用真实 `StageExecutor`，支持并行 Stage、条件评估、重试、取消
- `PipelineSaga`: Saga 事务模式，`executeStages` 步骤在没有 `stageExecutor` 时回退到模拟执行

两套引擎的 Stage 初始化逻辑完全重复（`initializeStages` vs `reserveResources` 中的 Stage 创建），Task 初始化逻辑也重复。设计文档未提及如何统一或协调这两套引擎与插件系统的关系。

---

## 2. 逻辑漏洞 (Logic Gaps)

### 2.1 [严重] 插件热加载方案缺少关键细节

设计文档提出"从插件目录读取 .js / .ts 文件"实现热加载，但：

- 现有 `PluginManagerService` 已经定义了完整的插件状态机（AVAILABLE → DOWNLOADED → INSTALLED → ACTIVE → CONFIGURED），热加载应该遵循这个状态机，而不是直接读取文件
- `PluginExecutorService` 支持三种运行时模式（WASM/Container/Process），设计文档只考虑了 Node.js 文件加载这一种
- TS 运行时编译需要 `ts-node` 或 `esbuild`，设计文档提到但未考虑依赖管理和编译缓存

### 2.2 [中等] uses 字段解析逻辑不清晰

设计文档提出 `PluginRegistry.resolve("orion/docker-build@v1")`，但现有代码 `PipelineEngine.initializeTasks()` 中：
```typescript
const [type] = step.uses.split('@');  // "git/checkout@v1" → "git/checkout"
```

type 提取后直接存入 `Task.type`，然后 `TaskRunner.executeByType()` 用 `startsWith('git/')` 做前缀匹配。设计文档提出的 `orion/docker-build@v1` 命名空间格式（`scope/name@version`）与现有 `category/action@version` 格式不兼容，需要明确迁移策略。

### 2.3 [中等] 容器化构建与插件执行的关系混乱

设计文档 Gap 2 提出创建 `DockerTaskRunner`，但 `PluginExecutorService` 已经存在：
- `executeContainerPlugin()` 方法
- `startContainerRuntime()` 方法
- 安全等级 MEDIUM 对应容器隔离

如果 Gap 2 是创建 `DockerTaskRunner`，那 `PluginExecutorService` 的容器执行模式算什么？两者如何协调？

### 2.4 [中等] OverlayFS 缓存与 PipelineStage.cache 模型脱节

`PipelineStage` 模型 (`src/models/Pipeline.ts`) 已经定义了 `cache` 字段：
```typescript
cache?: {
  enabled: boolean;
  key: string;
  paths: string[];
  restoreKeys?: string[];
}
```

设计文档 Gap 3 提出了全新的 OverlayFS 方案（基于 lockfile hash 自动生成 key），与已有的 `cache.key` / `cache.paths` / `cache.restoreKeys` 配置模型不一致。

### 2.5 [轻微] StageExecutor.cancelStage 存在 Bug

`StageExecutor.cancelStage()` 方法用 `taskId.startsWith(stage.id)` 来匹配，但 taskId 是 UUID，不会以 stageId 开头。这个逻辑永远匹配不到任何 task。

---

## 3. 遗漏的考虑因素 (Missing Considerations)

### 3.1 [重要] Task.resourceQuota 字段未被设计覆盖

`Task` 模型已有 `resourceQuota: { cpu?, memory?, timeout? }` 字段。设计文档在容器化构建中提到了 CPU/memory 资源限制，但没有说明如何与已有的 `TaskResourceQuota` 模型整合。

### 3.2 [重要] PipelineEngine 的并行执行是伪并行

`PipelineEngine.executePendingStages()` 对每个 Stage 依次调用 `this.executeStage(execution, stage).catch(...)`（fire-and-forget），虽然看起来是并行，但没有使用 `Promise.all` 控制并发、没有并发度限制、没有错误传播机制。设计文档在性能基线中声称"DAG 编排引擎支持并行 Stage 执行"，但实际实现并未真正控制并行度。

### 3.3 [重要] 租户隔离未在设计中体现

代码库已有租户管理路由 (`src/api/tenant-routes.ts`) 和 `TaskExecutionRequest.tenantId` 字段。插件系统、缓存系统、制品库都需要考虑租户隔离，设计文档完全未提及。

### 3.4 [重要] EventBusService 集成

`PluginManagerService` 和 `PluginExecutorService` 都使用 `EventBusService` 发布事件（`plugin.installed`, `plugin.activated`, `plugin.task.completed` 等）。设计文档未说明插件生命周期事件如何与 Pipeline 事件流（`PipelineEventPublisher`）整合。

### 3.5 [中等] PipelineStage 的 runsOn 字段已有定义

`PipelineStage` 模型已定义 `runsOn: string` 字段。设计文档 Gap 2 提到"支持 runsOn 映射到预定义镜像"，但没有提及这个字段已存在，也没有分析现有 `runsOn` 的使用场景（代码中 `initializeStages` 并未使用 `runsOn`，只是从 YAML 解析后丢弃了）。

### 3.6 [中等] 确认工作流 (Confirmation Workbench) 的影响

设计文档列出了"Confirmation Workbench"为 Orion 优势，但没有考虑插件化后如何与确认流程集成。插件执行是否支持暂停-等待人工确认-继续的模式？`src/api/confirmation-routes.ts` 已存在。

---

## 4. 可行性评估 (Feasibility)

### 4.1 时间线评估

| 阶段 | 设计估计 | 实际评估 | 理由 |
|------|----------|----------|------|
| Phase 1 (P0) | 4 周 | **6-8 周** | 不是从零构建，而是桥接已有系统。但 `PluginExecutorService` 的容器/WASM 执行模式目前是模拟实现，需要真实实现。且 `PipelineEngine` 和 `PipelineSaga` 双引擎统一需要额外工作量 |
| Phase 2 (P1) | 8 周 | **10-12 周** | `PluginExecutorService` 的容器执行是模拟的，需要真实的 Docker/K8s 集成。OverlayFS 的 macOS 兼容问题比预期复杂。制品库 6 种类型即使只做 2 种也需要注册表协议实现 |
| Phase 3 (P2) | 6 周 | **6-8 周** | YAML anchors 已部分可用（js-yaml 已在使用），可以缩短。Git 增强和 Plugin Marketplace 的时间估计合理 |

### 4.2 技术选择评估

| 设计选择 | 评估 |
|----------|------|
| 新建 PluginRegistry | **不推荐** — 已有 PluginManagerService，应该扩展而非重建 |
| DockerTaskRunner 独立类 | **不推荐** — 应集成到 PluginExecutorService 的容器执行模式 |
| OverlayFS 层缓存 | **可行** — 但需要处理 macOS 兼容，建议开发环境用 tarball 降级 |
| 插件热加载 (.js/.ts 文件) | **有风险** — 建议走 PluginManagerService 的 install/activate 流程，而非直接文件读取 |
| js-yaml 替换现有 YAML 库 | **不需要** — 已在使用 js-yaml |
| MinIO/S3 作为制品存储后端 | **合理** |

### 4.3 最大风险

1. **双引擎并存导致的重构复杂度**: `PipelineEngine` + `PipelineSaga` 需要统一接入插件系统，工作量被低估
2. **PluginExecutorService 的模拟实现**: 容器/WASM/进程三种执行模式目前都是 `simulateExecution()`，Phase 2 的真实实现工作量可能超出预期
3. **向后兼容性**: 设计文档声称保持 `type` 字段兼容，但 `PluginExecutorService` 使用 `pluginId` 而非 `type`，两套标识系统需要映射层

---

## 5. 建议 (Recommendations)

### 5.1 重新定义 Gap 1 (P0)

**不要从零构建 PluginRegistry**，改为：

1. **桥接层**: 在 `StageExecutor` 中增加 `PluginExecutorService` 作为可选执行后端，保持 `TaskRunner` 作为 fallback
2. **类型映射**: 创建 `TaskTypeToPluginMapper`，将现有 `git/checkout` 等 type 映射到对应的插件 ID
3. **统一 TaskResult**: 对齐 `TaskRunner.TaskExecutionResult` 和 `PluginExecutorService.TaskExecutionResult` 两种结果格式
4. **删除模拟代码**: `PluginExecutorService` 中的 `simulateExecution()` 需要替换为真实的子进程/shell 执行（至少对于 shell 类插件）

预计工作量: 6 周（比设计多 2 周）

### 5.2 重新定义 Gap 2 (P1)

**不要创建独立的 DockerTaskRunner**，改为：

1. **增强 PluginExecutorService**: 将 `executeContainerPlugin()` 从模拟改为真实的 `docker run` / `dockerode` 调用
2. **Workspace Volume 管理**: 新增 `WorkspaceManager` 服务，处理容器间 workspace 共享（Volume 或 bind mount）
3. **runsOn 映射表**: 利用已有的 `PipelineStage.runsOn` 字段，创建 `runsOn → Docker image` 的映射配置
4. **container YAML 字段**: 在 `PipelineStage` 模型中新增 `container?: { image, workingDir, env }` 字段

### 5.3 重新定义 Gap 3 (P1)

1. **复用已有 cache 模型**: 基于 `PipelineStage.cache` 的 `key` / `paths` / `restoreKeys` 实现，而非推翻重来
2. **OverlayFS 作为可选加速层**: 在 Linux 环境下使用 overlayfs mount，非 Linux 环境使用 tarball 还原
3. **缓存 Key 生成策略**: 结合 `cache.key`（用户指定）和 lockfile hash（自动检测）

### 5.4 修复代码中发现的 Bug

1. **StageExecutor.cancelStage()**: `taskId.startsWith(stage.id)` 逻辑错误，需要维护 stage → taskIds 的映射
2. **PipelineEngine.executePendingStages()**: fire-and-forget 缺少并发控制，建议增加最大并行 Stage 数配置
3. **PipelineEngine 与 PipelineSaga 的重复代码**: 合并 Stage/Task 初始化逻辑

### 5.5 补充设计遗漏

1. **租户隔离**: 缓存、制品库、插件安装都需要租户级别的隔离策略
2. **EventBus 整合**: 插件生命周期事件应通过统一的 EventBus 发布，供 SSE 日志流消费
3. **确认工作流集成**: 插件执行应支持 `ConfirmationGate` 中间状态
4. **resourceQuota 传递**: Task 的 `resourceQuota` 应传递给容器的 `--cpus` / `--memory` 参数

---

## 总结

设计文档的最大问题是**未发现代码库中已经存在一套完整的插件系统**（`PluginManagerService` + `PluginExecutorService` + plugin-spi-routes）。当前真正的缺口是：

1. 插件执行引擎与 Pipeline 执行链路的**桥接**（而非从零构建）
2. 插件执行引擎中容器/WASM 模式的**真实实现**（当前为模拟）
3. `PipelineEngine` 和 `PipelineSaga` 双引擎的**统一**

建议设计文档 v2 版本以上述发现为基础重写，避免重复建设和架构冲突。
