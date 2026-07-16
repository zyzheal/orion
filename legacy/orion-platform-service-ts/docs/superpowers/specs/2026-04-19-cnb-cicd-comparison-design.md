# 全面对比设计文档 - CNB.Cool vs Orion CI/CD 系统

> **文档版本**: v2.0
> **创建日期**: 2026-04-19
> **修订日期**: 2026-04-19
> **分支**: feat/frontend-gap-implementation
> **状态**: 基于架构审计与逻辑审计修订

---

## 目录

1. [整体架构对比](#1-整体架构对比)
2. [Orion 现有优势保留](#2-orion-现有优势保留)
3. [核心差距详细设计](#3-核心差距详细设计)
4. [数据流完整设计](#4-数据流完整设计)
5. [实施优先级与依赖关系图](#5-实施优先级与依赖关系图)

---

## 1. 整体架构对比

### CNB.Cool 核心特征

- **基于 Docker 容器的构建环境** -- 声明式 Dockerfile 定义构建环境
- **OverlayFS 层缓存** -- 语言/依赖自动检测，跨 Pipeline 复用缓存
- **插件化任务系统** -- plugin marketplace，热插拔扩展
- **多类型制品库** -- Docker / Maven / npm / Helm / Composer / NuGet，6 种制品真实存储
- **YAML anchors/aliases/merge** -- 高级语法减少重复配置
- **内置 Git 仓库** -- PR / Review 工作流一体化

### Orion 当前状态

- **已有的完整插件系统** -- `PluginManagerService`（6 种插件类型、完整状态机、安全等级管理） + `PluginExecutorService`（WASM/容器/进程三种运行时），但未接入 Pipeline 执行链路
- **两条独立的执行路径** -- `PipelineEngine → StageExecutor → TaskRunner`（硬编码 5 种类型）与 `PluginManagerService → PluginExecutorService`（完整插件系统）完全断开
- **双引擎并存** -- `PipelineEngine`（真实执行）和 `PipelineSaga`（Saga 事务模式）共享重复的 Stage/Task 初始化逻辑
- **内存 LRU 缓存** -- 无持久化，重启丢失，不支持跨 Pipeline 复用
- **YAML 解析已使用 js-yaml** -- `parsePipelineYaml()` 已支持 anchors/aliases/merge，只需确认配置正确
- **无内置制品库** -- 仅记录 `artifactPath` 字符串元数据
- **SmartDeploy 独立部署系统** -- 支持 Blue-Green / Canary / Rolling / Recreate 四种策略，但与 Pipeline deploy stage 完全断开
- **Canary Analysis 灰度分析** -- 完整的灰度分析系统（`canary-analysis-routes.ts`）
- **AI Review 服务** -- 代码 AI 审查能力（`AIReviewService`）
- **Test Selector 测试影响分析** -- 基于代码变更的智能测试选择
- **Change Intelligence 变更智能** -- 变更影响范围分析、风险评估
- **Policy Evaluation 策略评估** -- 部署前策略检查（合规、安全）
- **Confirmation Workbench** -- 人工审批确认流程

### 差距分类

| 类别 | 差距项 | 复杂度 | 优先级 |
|------|--------|--------|--------|
| 插件桥接 | 将 PluginExecutorService 接入 Pipeline 执行链路 | 高 | P0 |
| 构建环境 | 容器化构建与 PluginExecutorService 容器模式整合 | 高 | P1 |
| 缓存系统 | OverlayFS + 复用已有 PipelineStage.cache 模型 | 高 | P1 |
| 制品库 | 6 种制品库真实存储 | 高 | P1 |
| 部署集成 | Pipeline deploy stage → SmartDeployService 桥接 | 高 | P1 |
| CI 能力增强 | Canary Analysis / AI Review / Test Selector 作为 Pipeline stage | 中 | P1 |
| YAML 解析 | anchors/aliases/merge 已部分可用，需验证和完善 | 低 | P2 |
| Git 集成 | 增强外部适配器（Webhook 触发、MR 状态关联） | 中 | P2 |
| 插件生态 | Plugin Marketplace + 前端管理页面 | 中 | P2 |
| 前端页面 | 制品库管理页面、插件管理页面、PipelineRun 状态展示 | 中 | P2 |

---

## 2. Orion 现有优势保留

以下能力为 Orion 相比 CNB.Cool 的差异化优势，在后续演进中必须保留并持续增强：

1. **SSE 实时日志流** -- CNB 使用轮询，Orion 的 SSE 更实时、资源消耗更低。当前 NATS EventBus → SSE 基础设施需补齐
2. **DAG 编排引擎** -- 支持并行 Stage 执行（需增加并发度控制），CNB 为串行流水线
3. **Saga 事务** -- 分布式事务回滚保证一致性，CNB 无此能力
4. **AbortController 取消机制** -- 真正的任务取消（P0 修复后与插件系统集成）
5. **多租户 + RBAC** -- 企业级权限模型，CNB 权限模型较简单
6. **Confirmation Workbench** -- 人工审批确认流程，适合企业发布管控
7. **SmartDeploy 智能部署** -- Blue-Green / Canary / Rolling / Recreate 四种策略 + 部署前风险评估 + 自动回滚 + 审计追踪，CNB 完全没有
8. **Canary Analysis 灰度分析** -- 与 Canary 部署策略联动，实时监控指标分析，CNB 无此能力
9. **AI Review 代码审查** -- 集成到 Pipeline scan stage，提供智能代码质量审查，CNB 无此能力
10. **Test Selector 测试选择** -- 基于代码变更影响分析，只运行受影响测试，减少 Pipeline 执行时间
11. **Change Intelligence 变更智能** -- 变更影响范围分析、风险评估，指导 Pipeline 执行策略
12. **Policy Evaluation 策略评估** -- 部署前合规/安全策略检查，确保发布符合规范

---

## 3. 核心差距详细设计

### Gap 1: 插件系统桥接 (P0 - 最高优先)

**现状：** 代码库已存在完整的插件基础设施，但从未被 Pipeline 执行链路调用。

- `PluginManagerService`：完整的插件生命周期管理，支持 6 种插件类型（`CUSTOM_TASK`、`WEBHOOK_HANDLER`、`AI_SKILL`、`APPROVAL_PROVIDER`、`NOTIFICATION_CHANNEL`、`DEPLOYMENT_STRATEGY`），状态机（`AVAILABLE → DOWNLOADED → INSTALLED → ACTIVE → CONFIGURED → INACTIVE → UNINSTALLED`）
- `PluginExecutorService`：插件执行引擎，支持三种安全等级运行时（WASM 沙箱 / 容器隔离 / 独立进程），包含资源配额管理、审计日志、输入验证、安全事件监控
- `plugin-spi-routes.ts`：完整的 REST API（注册、发现、安装、卸载、启用、禁用、执行、取消、健康检查）
- 当前 `StageExecutor` 直接注入 `TaskRunner`（硬编码 5 种类型），从未使用 `PluginExecutorService`

**两条独立的执行路径：**

```
路径 A (旧): PipelineEngine → StageExecutor → TaskRunner (硬编码 5 种类型)
路径 B (新): PluginManagerService → PluginExecutorService (完整插件系统，未被调用)
```

**目标：** 桥接已有 `PluginExecutorService` 到 Pipeline 执行链路，创建 `TaskTypeToPluginMapper` 将现有 `git/checkout` 等 type 映射到对应插件 ID，统一两种 `TaskExecutionResult` 格式。

**架构桥接设计：**

```
PipelineEngine.executeStage()
  → StageExecutor.executeTask(task)
    → TaskTypeToPluginMapper.map(task.type)  →  pluginId
    → PluginManagerService.getPlugin(pluginId)
    → PluginExecutorService.executeTask({
        taskId, pipelineRunId, stageId, pluginId,
        workspace, env, tenantId, resourceQuota
      })
    → 根据插件安全等级选择运行时：
      - HIGH → WASM 沙箱
      - MEDIUM → 容器隔离 (docker run)
      - LOW → 独立进程 (child_process)
    → 返回统一 TaskExecutionResult
```

**统一 TaskExecutionResult 格式：**

当前 `TaskRunner` 返回 `{ status, result, log, error }`，`PluginExecutorService` 返回 `{ taskId, status, exitCode, stdout, stderr, outputs, errorMessage }`。统一为：

```typescript
interface UnifiedTaskResult {
  taskId: string;
  pipelineRunId: string;
  stageId: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'QUOTA_EXCEEDED' | 'VALIDATION_FAILED';
  exitCode: number;
  stdout: string;
  stderr: string;
  outputs: Record<string, unknown>;
  errorMessage?: string;
  durationMs: number;
  resourceUsage?: { cpuMs: number; memoryMb: number };
}
```

**状态映射表（PluginExecutorService → PipelineEngine）：**

| PluginExecutorService 状态 | PipelineEngine 处理 |
|---|---|
| `SUCCESS` | Stage 标记 SUCCESS，继续下一阶段 |
| `FAILED` | 根据 retry 策略决定是否重试 |
| `CANCELLED` | Stage 标记 CANCELLED，触发 Saga 回滚 |
| `QUOTA_EXCEEDED` | Stage 标记 FAILED，记录资源超限原因 |
| `VALIDATION_FAILED` | Stage 标记 FAILED，记录验证失败详情 |

**实现路径：**

1. 在 `StageExecutor` 中增加 `PluginExecutorService` 作为可选执行后端，保持 `TaskRunner` 作为 fallback
2. 创建 `TaskTypeToPluginMapper` 服务，将现有 `git/checkout` 等 type 前缀映射到 `PluginManagerService` 中对应的插件 ID
3. 创建 `ResultFormatAdapter` 统一两种 `TaskExecutionResult` 格式
4. 将 `PluginExecutorService` 中的 `simulateExecution()` 替换为真实的子进程/shell 执行（至少对于 LOW 安全等级的 shell 类插件）
5. 修复 `StageExecutor.cancelStage()` 中的 Bug（维护 stage → taskIds 映射，而非 `taskId.startsWith(stage.id)`）
6. 同时统一 `PipelineEngine` 和 `PipelineSaga` 的 Stage/Task 初始化逻辑，消除重复代码

### Gap 2: 容器化构建环境 (P1)

**现状：** 所有任务在宿主机 Node.js 进程中执行，依赖冲突、环境污染风险。`PluginExecutorService` 已有 `executeContainerPlugin()` 和 `startContainerRuntime()` 方法但为模拟实现。

**目标：** 增强 `PluginExecutorService` 的容器执行模式（而非创建独立的 `DockerTaskRunner`），实现真实的 `docker run` / `dockerode` 调用。

```yaml
spec:
  stages:
    - name: build
      runsOn: ubuntu-latest           # 向后兼容：映射到预定义镜像
      container:                       # 新增：直接指定自定义镜像
        image: node:20-alpine
        workingDir: /workspace
        env:
          CI: "true"
```

**实现路径：**

1. **增强 PluginExecutorService 容器执行模式**：将 `executeContainerPlugin()` 从模拟改为真实的 `docker run` / `dockerode` 调用。安全等级 MEDIUM 对应容器隔离
2. **WorkspaceManager 服务**：新增 workspace 卷管理服务，处理容器间 workspace 共享（Volume 或 bind mount）。并行 Stage 各自使用独立的 workspace volume，避免写竞争
3. **runsOn 映射表**：利用已有的 `PipelineStage.runsOn` 字段，创建 `runsOn → Docker image` 的映射配置
4. **container YAML 字段**：在 `PipelineStage` 模型中新增 `container?: { image, workingDir, env }` 字段
5. **resourceQuota 传递**：Task 的 `resourceQuota` 应映射到容器的 `--cpus` / `--memory` 参数
6. **并行 Stage 隔离**：`PipelineEngine.executePendingStages()` 增加最大并行 Stage 数配置，各并行 Stage 使用独立 workspace volume

### Gap 3: OverlayFS 缓存系统 (P1)

**现状：** 内存 LRU 缓存，重启即丢失。`PipelineStage` 模型已定义 `cache` 字段（`enabled`, `key`, `paths`, `restoreKeys`），但未被充分利用。

**目标：** 基于已有 `PipelineStage.cache` 模型实现 OverlayFS 层缓存 + 语言/依赖自动检测。

```
缓存架构:
┌─────────────────────────┐
│  OverlayFS Mount Point  │  ← 构建工作目录
├─────────────────────────┤
│ Upper: Pipeline Run N   │  ← 当前写入层
├─────────────────────────┤
│ Lower: Cache Layer      │  ← 命中时复用（基于 cache.key + lockfile hash）
├─────────────────────────┤
│ Lower: Base Image       │  ← 基础依赖
└─────────────────────────┘
```

**实现路径：**

1. **复用已有 cache 模型**：基于 `PipelineStage.cache` 的 `key` / `paths` / `restoreKeys` 实现，而非推翻重来
2. **缓存 Key 生成策略**：结合 `cache.key`（用户指定）和 lockfile hash（自动检测 `package-lock.json` / `go.sum` / `Cargo.lock`）
3. **OverlayFS 作为可选加速层**：Linux 环境下使用 overlayfs mount，非 Linux 环境（macOS / Windows）使用 tarball 还原降级
4. **磁盘持久化**：缓存存储到磁盘，跨重启保留。LRU 淘汰策略（磁盘空间不足时自动清理最旧缓存）
5. **跨 Pipeline 缓存复用**：缓存 key 包含租户前缀，支持同租户下不同 Pipeline 间复用相同依赖缓存

### Gap 4: 多类型制品库真实存储 (P1)

**现状：** 制品仅记录元数据（`artifactPath` 字符串），无实际存储能力。`pipelines.ts` 已有 `uploadArtifact` / `downloadArtifact` / `listArtifacts` API 但无页面消费。

**目标：** 6 种制品库后端支持，Phase 2 优先实现 Docker + npm。

| 制品类型 | 存储后端 | 用途 |
|---------|---------|------|
| Docker | Registry API (v2) | 容器镜像推送/拉取 |
| Maven | Nexus/Artifactory API | Java 依赖 |
| npm | npm Registry API | Node.js 包 |
| Helm | OCI Registry / HTTP | K8s Charts |
| Composer | Packagist 兼容 | PHP 包 |
| NuGet | NuGet Server API | .NET 包 |

**实现路径：**

1. 定义统一 `ArtifactProvider` 接口
2. 实现 Docker / npm 两种优先（覆盖 80% 场景）
3. `ArtifactService` 根据类型路由到对应 Provider
4. 存储层：本地 MinIO / S3 兼容存储
5. 租户隔离：制品命名空间按租户隔离（`{tenant}/{repo}/{artifact}`）
6. **前端页面**：制品库管理页面（上传/下载/列表/版本管理），消费已有的 `uploadArtifact` / `downloadArtifact` / `listArtifacts` API

### Gap 5: SmartDeploy 与 Pipeline deploy stage 集成 (P1)

**现状：** `SmartDeployService` 是独立的部署编排引擎，Pipeline 的 deploy stage 通过 `TaskRunner.executeK8sTask()` 执行（硬编码的 `k8s/*` 前缀匹配），两者之间没有任何连接。Pipeline 产出的 Docker 镜像 tag 无法传递给部署系统。

**目标：** Pipeline deploy stage 能够调用 `SmartDeployService` 进行智能部署，支持在 Pipeline YAML 中声明部署策略。

**集成设计：**

```yaml
spec:
  stages:
    - name: deploy-staging
      type: deploy
      deploy:
        strategy: canary          # blue-green / canary / rolling / recreate
        environment: staging
        artifact:                 # 引用上一 stage 产出的制品
          type: docker
          image: my-app
          tag: ${BUILD_TAG}
        canary_analysis: true     # 启用灰度分析
        risk_assessment: true     # 部署前风险评估
```

**实现路径：**

1. **DeployStageExecutor**：创建专用 deploy stage 执行器，桥接 `StageExecutor` 和 `SmartDeployService`
2. **制品传递**：Pipeline 产出的 Docker image tag 通过 `PipelineContext.artifacts` 传递给 deploy stage
3. **YAML 扩展**：在 Pipeline YAML 中支持 `deploy.strategy` / `deploy.environment` / `deploy.canary_analysis` 等字段
4. **状态反馈闭环**：`DeploymentVerifier` 验证部署结果后，结果反馈回 `PipelineRun` 状态。部署失败时 Pipeline 标记为 FAILED
5. **部署审计关联**：`PipelineRun.id` 与 `Deployment.auditTrail` 关联，实现端到端追溯

### Gap 6: Canary Analysis Pipeline 集成 (P1)

**现状：** `canary-analysis-routes.ts` 存在完整的灰度分析系统，但与 Pipeline 系统独立运行。

**目标：** 将 Canary Analysis 作为 Pipeline 的可选 stage 类型，与 SmartDeploy 的 canary 策略联动。

**实现路径：**

1. **CanaryAnalysisStageExecutor**：新建 stage 类型 `canary_analysis`，调用 Canary Analysis 服务
2. **指标配置**：在 YAML 中定义分析指标（延迟、错误率、饱和度等）和阈值
3. **与 deploy stage 联动**：deploy stage 配置 `canary_analysis: true` 后，自动插入 canary_analysis stage
4. **决策输出**：Canary Analysis 结果 → `PROMOTE` / `ABORT` → 驱动 Pipeline 继续或回滚

### Gap 7: AI Review 作为 Pipeline stage (P1)

**现状：** `AIReviewService` 提供代码 AI 审查能力，独立于 Pipeline 运行。

**目标：** 将 AI Review 集成到 Pipeline 的 scan stage，或作为独立的 `ai_review` stage 类型。

**实现路径：**

1. **AIReviewStageExecutor**：新建 stage 类型 `ai_review`，调用 `AIReviewService`
2. **扫描范围**：支持全量扫描和增量扫描（基于 PR/MR 的 diff）
3. **结果输出**：AI Review 结果输出为结构化报告，可配置 gate（阻塞/非阻塞）
4. **PR/MR 集成**：Review 结果可推送到 Git 平台的 PR/MR 评论中

### Gap 8: YAML 高级语法 (P2)

**现状：** `parsePipelineYaml()` 已使用 `js-yaml`，原生支持 anchors/aliases/merge，只需确认正确配置即可。

**目标：** 确保 YAML anchors/aliases/merge 正常工作，补充前端编辑器支持。

```yaml
definitions:
  - &node-env
    image: node:20
    env: { CI: "true" }

stages:
  - name: build
    <<: *node-env
  - name: test
    <<: *node-env
```

**实现路径：**

1. 确认 `js-yaml` 的 `load()` 调用正确配置（`js-yaml` 默认已支持 anchors/aliases/merge）
2. 修改 `parsePipelineYaml()` 处理 merge 后的展开结果
3. 向后兼容：简单 YAML 保持不变
4. **前端编辑器增强**：StageModal 支持"引用定义"选择；YAML 预览展示合并后的结果

### Gap 9: Git 增强集成 (P2)

**现状：** 通过 GitLab / Gerrit 外部适配器，无内置仓库。

**CNB 模式：** 内置 Git 仓库 + PR / Review 工作流。

**评估：** Orion 作为平台服务，内置 Git 仓库成本过高。建议保持外部适配器路线，增强现有功能覆盖。

**建议改进：**

1. 增强 GitLab 适配器：支持 Webhook 自动触发 Pipeline；MR 关联 Pipeline 状态
2. 增强 Gerrit 适配器：支持 `refs/changes` 自动检出
3. 新增 GitHub 适配器（OAuth + Webhook + Action 兼容）
4. **PR/MR 评论集成**：在 PR/MR 中显示 Pipeline 状态、构建产物预览、AI Review 结果

### Gap 10: Plugin Marketplace + 前端管理页面 (P2)

**现状：** 无插件市场，插件需手动开发部署。`plugin-spi-routes.ts` 已有完整 API。

**目标：** 轻量级插件注册/发现机制 + 前端管理页面。

**实现路径：**

1. **插件元数据注册表**：name / version / description / params schema / compatibility（复用已有 `PluginManagerService` 元数据）
2. **插件安装流程**：走 `PluginManagerService` 的 install → activate 状态机（而非直接读取文件），确保安全等级和沙箱配置生效
3. **前端插件管理页面**：
   - 已安装插件列表（名称、版本、状态、安全等级）
   - 可用插件市场（浏览、搜索、安装/卸载）
   - 插件详情（描述、参数 schema、兼容版本、执行日志）
   - 从后端 API 动态拉取可用插件列表（`PluginManagerService.list()`）
4. **版本冲突处理**：同一 Pipeline 内两个 Stage 引用同一插件的不同版本时，各自独立沙箱隔离执行
5. **热加载安全**：正在运行的 Pipeline 使用旧版插件快照，新版插件加载不影响运行中 Pipeline

### Gap 11: 前端 Pipeline 页面增强 (P2)

**现状：** `PipelineList` 页面只显示 Pipeline 定义列表（active/inactive/deleted），不显示最近运行状态。不存在 PipelineRun 详情页面。

**目标：** 增强前端 UX，补齐 CNB 级别的信息展示。

**实现路径：**

1. **PipelineList 增强**：展示最近一次 PipelineRun 的状态（success/failed/running）
2. **PipelineRun 详情页**：新建页面，展示运行历史、各 Stage 状态、实时日志（SSE）
3. **Stage 类型动态发现**：Stage 类型从后端 `PluginManagerService.list()` 动态拉取，而非前端硬编码
4. **容器配置 UI**：StageModal 增加容器配置表单（image 输入、workingDir、环境变量）
5. **部署策略 UI**：deploy stage 支持选择部署策略（blue-green / canary / rolling / recreate）

---

## 4. 数据流完整设计

### 4.1 插件执行完整数据流

```
PipelineEngine.execute(pipelineYaml)
  │
  ├── 1. parsePipelineYaml(yaml)           // js-yaml 解析，处理 anchors/aliases/merge
  │     → PipelineDefinition
  │
  ├── 2. initializeStages(def)             // 统一 Stage/Task 初始化（PipelineEngine + PipelineSaga 共享）
  │     → Stage[] with Task[]
  │
  ├── 3. executePendingStages()            // DAG 调度，带并发度控制
  │     │
  │     └── StageExecutor.executeStage(execution, stage)
  │           │
  │           └── for each task in stage.tasks:
  │                 │
  │                 ├── 3a. TaskTypeToPluginMapper.map(task.type)
  │                 │     → pluginId (e.g., "git/checkout" → "orion/git-clone@v1")
  │                 │
  │                 ├── 3b. PluginManagerService.getPlugin(pluginId)
  │                 │     → Plugin 元数据（安全等级、版本、配置）
  │                 │
  │                 ├── 3c. PluginExecutorService.executeTask({
  │                 │       taskId, pipelineRunId, stageId, pluginId,
  │                 │       workspace, env, tenantId, resourceQuota
  │                 │     })
  │                 │     │
  │                 │     ├── 安全等级 HIGH  → WASM 沙箱执行
  │                 │     ├── 安全等级 MEDIUM → 容器隔离执行 (docker run)
  │                 │     └── 安全等级 LOW  → 独立进程执行 (child_process)
  │                 │     │
  │                 │     └── TaskExecutionResult { taskId, status, exitCode, stdout, stderr, outputs }
  │                 │
  │                 ├── 3d. ResultFormatAdapter.unify(result)
  │                 │     → UnifiedTaskResult
  │                 │
  │                 └── 3e. runService.updateTask(unifiedResult)  // 更新内存状态
  │
  ├── 4. PipelineEventPublisher 发布事件到 NATS EventBus
  │     │
  │     ├── pipeline.run.created
  │     ├── stage.started / stage.completed / stage.failed
  │     ├── task.started / task.completed / task.failed
  │     └── pipeline.run.completed / pipeline.run.failed
  │
  ├── 5. PluginManagerService / PluginExecutorService 发布插件事件到 EventBus
  │     │
  │     ├── plugin.installed / plugin.activated / plugin.deactivated
  │     └── plugin.task.completed / plugin.task.failed
  │
  ├── 6. SSE Gateway 消费 NATS EventBus 事件，推送给前端
  │     │
  │     ├── SSE 路由: GET /api/pipelines/:runId/log
  │     ├── Content-Type: text/event-stream
  │     └── 事件格式:
  │           event: task-log
  │           data: { runId, stageId, taskId, type: "stdout"|"stderr"|"status", content }
  │
  └── 7. 前端 SSE 消费
        │
        ├── PipelineRun 详情页建立 EventSource 连接
        ├── 实时接收 task 日志和状态更新
        ├── 日志按 Stage 分组展示
        └── 状态变更实时更新 UI（运行中 → 成功/失败）
```

### 4.2 事件统一策略

两套事件系统（`PipelineEventPublisher` 和 `PluginExecutorService`）通过统一的事件格式和 SSE Gateway 整合：

```typescript
// 统一事件格式
interface PipelineEvent {
  eventId: string;
  eventType: 'pipeline' | 'stage' | 'task' | 'plugin' | 'deploy' | 'canary';
  action: 'created' | 'started' | 'completed' | 'failed' | 'cancelled';
  pipelineRunId: string;
  stageId?: string;
  taskId?: string;
  timestamp: number;
  payload: Record<string, unknown>;
  tenantId: string;
}

// SSE Gateway 统一消费 NATS 所有事件，按 eventType + action 路由
// 前端通过 EventSource 接收统一格式事件
```

### 4.3 部署数据流

```
Pipeline deploy stage
  │
  ├── DeployStageExecutor 读取 deploy 配置
  │     → strategy, environment, artifact reference
  │
  ├── 获取制品信息 (PipelineContext.artifacts)
  │     → Docker image tag, npm package version, etc.
  │
  ├── SmartDeployService.createDeployment({
  │     strategy: 'canary',
  │     artifact: { type: 'docker', image: 'my-app', tag: 'sha-abc123' },
  │     environment: 'production',
  │     riskAssessment: true,
  │     canaryAnalysis: true
  │   })
  │     │
  │     ├── DeploymentStrategyEngine 编排部署步骤
  │     ├── RiskAssessmentService 评估风险
  │     ├── CanaryAnalysisService 执行灰度分析（如启用）
  │     └── DeploymentVerifier 验证部署结果
  │
  ├── 部署结果反馈 → PipelineRun 状态更新
  │     → SUCCESS: Pipeline 标记为 completed
  │     → FAILED: Pipeline 标记为 failed，触发自动回滚
  │
  └── 审计关联
        → PipelineRun.id ↔ Deployment.auditTrail
```

---

## 5. 实施优先级与依赖关系图

### 5.1 实施路线图总览

全部 Gap 按优先级分为三个实施阶段，总计 **22-26 周**（约 5.5-6.5 个月）。

| 阶段 | 优先级 | 包含 Gap | 工期 | 累计工期 |
|------|--------|----------|------|----------|
| Phase 1 | P0 | Gap 1: 插件系统桥接 | 6-8 周 | 第 1-8 周 |
| Phase 2 | P1 | Gap 2: 容器化构建<br>Gap 3: 缓存升级<br>Gap 4: 制品库<br>Gap 5: SmartDeploy 集成<br>Gap 6: Canary Analysis<br>Gap 7: AI Review | 10-12 周 | 第 9-20 周 |
| Phase 3 | P2 | Gap 8: YAML 高级语法<br>Gap 9: Git 增强<br>Gap 10: Plugin Marketplace + 前端<br>Gap 11: 前端 Pipeline 页面增强 | 6 周 | 第 21-26 周 |

### 5.2 Phase 1: 插件系统桥接 (P0, 6-8 周)

**目标：** 将已有 `PluginExecutorService` 桥接到 Pipeline 执行链路，统一两种执行路径和结果格式。

**里程碑：**

| 周次 | 交付物 |
|------|--------|
| Week 1 | 分析现有 `PluginManagerService` 和 `PluginExecutorService` 接口；定义 `TaskTypeToPluginMapper` 映射规则；定义 `UnifiedTaskResult` 统一格式 |
| Week 2 | 实现 `TaskTypeToPluginMapper` 和 `ResultFormatAdapter`；创建状态映射表（PluginExecutorService 状态 → PipelineEngine 状态） |
| Week 3 | 在 `StageExecutor` 中增加 `PluginExecutorService` 作为可选执行后端，保持 `TaskRunner` 作为 fallback；修复 `StageExecutor.cancelStage()` Bug |
| Week 4 | 将 5 种硬编码任务类型映射到对应插件 ID，通过 `PluginExecutorService` 执行；统一 `PipelineEngine` 和 `PipelineSaga` 的 Stage/Task 初始化逻辑 |
| Week 5 | 替换 `PluginExecutorService` 中 LOW 安全等级的 `simulateExecution()` 为真实子进程/shell 执行 |
| Week 6 | 插件热加载支持（走 `PluginManagerService` install → activate 状态机，而非直接文件读取）；集成测试 |
| Week 7-8 | 完整回归测试：所有现有 Pipeline 行为等价验证；AbortController 取消传播验证；插件加载失败降级到 fallback 验证 |

**验收标准：**

- 插件执行引擎与 Pipeline 执行链路完全桥接，`StageExecutor` 通过 `PluginExecutorService` 分发执行
- 现有 5 种硬编码任务类型功能完全等价，通过插件映射执行
- `UnifiedTaskResult` 格式统一，PipelineEngine 能正确处理所有插件状态（包括 `QUOTA_EXCEEDED`、`VALIDATION_FAILED`）
- `StageExecutor.cancelStage()` 正确取消正在执行的任务
- 插件加载失败时降级到 `TaskRunner` fallback，不阻断 Pipeline
- AbortController 可正确取消正在运行的插件任务
- `PipelineEngine` 和 `PipelineSaga` 共享统一的 Stage/Task 初始化逻辑

**风险分析：**

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| `PluginExecutorService` 的容器/WASM 执行模式目前是模拟实现 | 高 | 高 | Phase 1 先替换 LOW 安全等级为真实子进程执行；容器/WASM 真实实现推迟到 Phase 2 |
| `PipelineEngine` 和 `PipelineSaga` 双引擎统一重构复杂度被低估 | 中 | 高 | 提取共享初始化逻辑为独立模块，双引擎引用同一模块 |
| `TaskTypeToPluginMapper` 的 type-to-pluginId 映射与现有 `uses` 格式不兼容 | 中 | 高 | 保持 `type` 字段向后兼容，映射层内部做格式转换 |
| 插件版本冲突（同一 Pipeline 内引用同一插件的不同版本） | 低 | 中 | 各自独立沙箱隔离执行；`PluginRegistry.resolve()` 精确匹配版本号 |

### 5.3 Phase 2: 容器化构建 + 缓存升级 + 制品库 + 部署集成 (P1, 10-12 周)

**目标：** 六个 P1 Gap 并行推进，共享基础设施。

#### 5.3.1 Gap 2: 容器化构建 (Week 9-13, 与 Gap 3/4/5/6/7 并行)

**里程碑：**

| 周次 | 交付物 |
|------|--------|
| Week 9 | 增强 `PluginExecutorService.executeContainerPlugin()`：替换模拟为真实 `dockerode` 调用 |
| Week 10 | `WorkspaceManager` 服务：workspace Volume 挂载管理；并行 Stage 独立 workspace 隔离 |
| Week 11 | `container` 字段 YAML 解析（image / workingDir / env）；`runsOn` 向后兼容映射 |
| Week 12 | `Task.resourceQuota` 映射到容器 `--cpus` / `--memory` 参数；网络隔离配置 |
| Week 13 | 容器预热池（预拉取常用镜像）；与插件系统端到端集成测试 |

**风险分析：**

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Docker-in-Docker 权限问题 | 中 | 高 | 降级模式：使用宿主 Node.js 进程执行 + 日志警告 |
| 容器启动延迟影响 Pipeline 整体耗时 | 高 | 中 | 容器预热池；支持 `runsOn` 快速路径跳过容器化 |
| 并行 Stage 共享 workspace 写竞争 | 中 | 高 | 各并行 Stage 使用独立 workspace volume，完成后合并 |

#### 5.3.2 Gap 3: 缓存系统升级 (Week 9-14, 与 Gap 2/4/5/6/7 并行)

**里程碑：**

| 周次 | 交付物 |
|------|--------|
| Week 9-10 | 复用 `PipelineStage.cache` 模型；缓存 Key 生成（用户指定 + lockfile hash） |
| Week 11 | OverlayFS mount / unmount 生命周期管理（Linux）；tarball 降级方案（macOS/Windows） |
| Week 12 | 磁盘持久化缓存目录结构；LRU 淘汰策略 |
| Week 13 | 租户隔离缓存 key 前缀；跨 Pipeline 缓存复用 |
| Week 14 | 与容器化构建集成：容器启动时挂载 overlayfs；缓存命中率监控 |

#### 5.3.3 Gap 4: 多类型制品库 (Week 11-17, 依赖 Gap 2)

**里程碑：**

| 周次 | 交付物 |
|------|--------|
| Week 11 | 定义 `ArtifactProvider` 接口；`ArtifactService` 路由层 |
| Week 12-13 | Docker Registry Provider（v2 API push / pull / list / delete） |
| Week 14-15 | npm Registry Provider（publish / install / search） |
| Week 16 | MinIO / S3 后端存储集成；租户隔离命名空间 |
| Week 17 | 制品版本管理、生命周期策略；前端制品库页面原型 |

#### 5.3.4 Gap 5: SmartDeploy 集成 (Week 11-15, 与 Gap 2/3 并行)

**里程碑：**

| 周次 | 交付物 |
|------|--------|
| Week 11-12 | `DeployStageExecutor`：桥接 `StageExecutor` 和 `SmartDeployService` |
| Week 13 | Pipeline YAML `deploy` 字段支持（strategy / environment / artifact reference） |
| Week 14 | 制品传递（`PipelineContext.artifacts` → SmartDeployService） |
| Week 15 | 部署结果反馈闭环（`DeploymentVerifier` → `PipelineRun` 状态）；审计关联 |

#### 5.3.5 Gap 6: Canary Analysis 集成 (Week 13-16)

**里程碑：**

| 周次 | 交付物 |
|------|--------|
| Week 13-14 | `CanaryAnalysisStageExecutor`：新建 stage 类型，调用 Canary Analysis 服务 |
| Week 15 | YAML 指标配置（延迟、错误率、饱和度等阈值） |
| Week 16 | 与 deploy stage 联动（`canary_analysis: true` 自动插入）；PROMOTE / ABORT 决策 |

#### 5.3.6 Gap 7: AI Review 集成 (Week 14-16)

**里程碑：**

| 周次 | 交付物 |
|------|--------|
| Week 14-15 | `AIReviewStageExecutor`：新建 stage 类型，调用 `AIReviewService` |
| Week 16 | 全量/增量扫描模式；gate 配置（阻塞/非阻塞）；PR/MR 评论集成 |

### 5.4 Phase 3: YAML 高级语法 + Git 增强 + 前端页面 (P2, 6 周)

#### 5.4.1 Gap 8: YAML 高级语法 (Week 21-22)

**里程碑：**

| 周次 | 交付物 |
|------|--------|
| Week 21 | 确认 `js-yaml` anchors/aliases/merge 正确工作；前端 YAML anchors 编辑器支持 |
| Week 22 | `parsePipelineYaml()` 兼容 merge 后展开结果；向后兼容回归测试 |

#### 5.4.2 Gap 9: Git 增强 (Week 22-23)

**里程碑：**

| 周次 | 交付物 |
|------|--------|
| Week 22 | GitLab 适配器增强：Webhook 自动触发 Pipeline；MR 关联 Pipeline 状态 |
| Week 23 | Gerrit 适配器增强：`refs/changes` 自动检出；GitHub 适配器 |

#### 5.4.3 Gap 10 + 11: 前端页面 (Week 23-26)

**里程碑：**

| 周次 | 交付物 |
|------|--------|
| Week 23 | 插件管理页面：已安装插件列表、插件市场、安装/卸载操作 |
| Week 24 | 制品库页面：上传/下载/列表/版本管理 |
| Week 25 | PipelineRun 详情页：运行历史、Stage 状态、SSE 实时日志流 |
| Week 26 | PipelineList 增强：最近运行状态展示；Stage 类型动态发现；容器配置 UI；部署策略 UI |

### 5.5 依赖关系图

```
                    ┌───────────────────────────┐
                    │  Gap 1: 插件系统桥接       │  Phase 1 (Week 1-8)
                    │  (桥接已有 PluginExecutor)  │
                    └─────────────┬─────────────┘
                                  │
          ┌──────────────┬────────┴────────┬──────────────┐
          ▼              ▼                 ▼              ▼
┌─────────────────┐ ┌────────────────┐ ┌─────────────┐ ┌──────────────────┐
│ Gap 2: 容器化构建 │ │ Gap 3: 缓存升级 │ │ Gap 4: 制品库│ │ Gap 5: SmartDeploy│  Phase 2
│   (增强已有容器  │ │  (复用已有cache │ │  (Phase 2   │ │   集成            │  (Week 9-20)
│    执行模式)     │ │   模型)         │ │   中后期)    │ │                  │
└────────┬────────┘ └────────┬───────┘ └──────┬──────┘ └────────┬─────────┘
         │                   │                │                  │
         ▼                   │                │                  │
┌─────────────────┐          │                │                  │
│ Gap 6: Canary   │◄─────────┘                │                  │
│   Analysis 集成  │                           │                  │
└────────┬────────┘                           │                  │
         │                                    │                  │
         ▼                                    ▼                  ▼
┌─────────────────┐                    ┌─────────────┐ ┌──────────────────┐
│ Gap 7: AI Review │                    │ Gap 8: YAML  │ │ Gap 9: Git 增强   │  Phase 3
│   集成           │                    │   高级语法    │ │                  │  (Week 21-26)
└─────────────────┘                    └──────┬──────┘ └────────┬─────────┘
                                              │                  │
                                              ▼                  ▼
                                    ┌─────────────────────────────────┐
                                    │ Gap 10: Plugin Marketplace      │
                                    │         + 前端管理页面            │
                                    │ Gap 11: 前端 Pipeline 页面增强   │
                                    └─────────────────────────────────┘
```

**依赖说明：**

- **Gap 1** 是全部后续工作的基础。必须先将已有 `PluginExecutorService` 桥接到 Pipeline 执行链路
- **Gap 2/3** 可以在 Gap 1 完成后立即开始，共享容器和 workspace 基础设施
- **Gap 4** 依赖 **Gap 2**（Docker 镜像 push/pull 需要容器环境），但 npm 制品可独立于 Gap 2 开发
- **Gap 5/6/7** 依赖 **Gap 1**（需要通过桥接后的执行链路）和 **Gap 4**（制品传递）
- **Gap 8** 独立于 Gap 1-7，可以提前启动（`js-yaml` 已在使用）
- **Gap 9** 独立，可以提前启动
- **Gap 10/11** 依赖 **Gap 1**（插件列表）和 **Gap 4**（制品库 API）

### 5.6 测试策略

#### 5.6.1 测试金字塔

```
           ┌─────────┐
           │  E2E     │  每个 Phase 结束时执行端到端 Pipeline 测试
           ├─────────┤
           │ 集成测试  │  插件间交互、容器与缓存交互、制品库端到端、部署闭环
           ├─────────┤
           │ 单元测试  │  每个接口/服务的独立测试（覆盖率 >= 80%）
           └─────────┘
```

#### 5.6.2 各阶段测试重点

| 阶段 | 单元测试 | 集成测试 | E2E 测试 |
|------|----------|----------|----------|
| Phase 1 | `TaskTypeToPluginMapper.map()` / `ResultFormatAdapter.unify()`；插件 execute 生命周期 | 插件桥接流程；AbortController 取消传播；5 种硬编码任务迁移后行为等价性；双引擎统一 | 完整 Pipeline 执行（含多 Stage），验证向后兼容 |
| Phase 2 | `PluginExecutorService.executeContainerPlugin()` 真实实现；overlayfs mount / unmount；`DeployStageExecutor` 桥接；`CanaryAnalysisStageExecutor` | 容器间 workspace 共享；缓存命中 / 未命中场景；Docker / npm 制品 push / pull 全流程；deploy stage → SmartDeployService 闭环 | 容器化 Pipeline 完整运行；缓存复用验证；制品发布后拉取验证；部署-灰度分析-验证端到端 |
| Phase 3 | `js-yaml` anchor / alias / merge 解析结果；Git 适配器 Webhook 转换；插件元数据 CRUD | YAML merge 展开后 Pipeline 正确执行；GitHub / GitLab Webhook 触发 Pipeline；插件安装后立即可用；SSE 实时日志流 | 含 anchors 的 YAML Pipeline 端到端；Webhook 自动触发完整流程；插件市场安装-使用闭环；实时日志 SSE 推送 |

#### 5.6.3 回归测试保障

- **Phase 1 完成后**：运行现有全部测试用例，确保 5 种硬编码任务迁移后零回归
- **Phase 2 完成后**：验证非容器化 Pipeline 仍可正常运行（`runsOn` 回退路径）；验证 deploy stage 向后兼容（旧 `k8s/*` type 仍可用）
- **Phase 3 完成后**：验证简单 YAML（无 anchors）仍可正确解析执行
- **全阶段**：维护一组标准 Pipeline YAML 样本库，每个 Phase 完成后全部跑通

#### 5.6.4 性能基准

| 指标 | 当前基线 | Phase 1 目标 | Phase 2 目标 | Phase 3 目标 |
|------|----------|-------------|-------------|-------------|
| Pipeline 启动延迟 | ~500ms | ~500ms | < 2s（含容器启动） | < 2s |
| 缓存命中率（重复构建） | 0% | -- | > 70% | > 80% |
| 单次构建耗时（对比非容器化） | 基准 | ~1.0x | < 1.5x | < 1.3x（缓存命中时 < 0.5x） |
| 制品上传（100MB） | N/A | N/A | < 30s | < 30s |
| SSE 日志延迟 | N/A（未实现） | -- | < 500ms | < 200ms |

### 5.7 向后兼容与迁移策略

#### 5.7.1 兼容性承诺

| 变更项 | 兼容策略 |
|--------|----------|
| 现有 Pipeline YAML 格式 | 完全兼容，`TaskTypeToPluginMapper` 内部做 type-to-plugin 映射，用户无需修改 YAML |
| `runsOn` 字段 | 保留，映射到预定义容器镜像；未配置容器化时回退到 Node.js 进程 |
| 现有 Task API | `Task` 模型不变，`UnifiedTaskResult` 扩展新字段（可选），不破坏现有消费者 |
| 制品元数据 | `artifactPath` 继续可用；新 `ArtifactService` 同时更新元数据和实际存储 |
| SSE 日志流 | 新建 NATS → SSE Gateway，容器化后通过 stdout 转发到 SSE |
| DAG / Saga | 不受影响，编排引擎在插件执行层之上 |
| SmartDeploy 独立使用 | 保持不变，Pipeline 集成不破坏现有 API |

#### 5.7.2 迁移路径

```
Phase 1 上线
    │
    ├── 步骤 1: 实现 TaskTypeToPluginMapper + ResultFormatAdapter（与现有 TaskRunner 并存）
    ├── 步骤 2: 在 StageExecutor 中增加 PluginExecutorService 作为可选后端
    ├── 步骤 3: 将 5 种硬编码任务映射到插件 ID，通过 PluginExecutorService 执行
    ├── 步骤 4: 验证所有现有 Pipeline 正常运行（行为等价）
    ├── 步骤 5: 统一 PipelineEngine 和 PipelineSaga 的初始化逻辑
    └── 步骤 6: 修复 cancelStage Bug，保留 TaskRunner 作为 fallback
         │
Phase 2 上线
    │
    ├── 步骤 1: 增强 PluginExecutorService 容器执行模式（feature flag 控制，默认关闭）
    ├── 步骤 2: 用户通过 container.runsOn 或 container.image 选择启用容器化
    ├── 步骤 3: 部署 overlayfs 缓存（Linux 环境自动启用）
    ├── 步骤 4: 部署 ArtifactService（Docker + npm 优先）
    ├── 步骤 5: 部署 DeployStageExecutor，桥接 SmartDeployService
    ├── 步骤 6: 部署 CanaryAnalysisStageExecutor 和 AIReviewStageExecutor
    └── 步骤 7: 验证制品 push / pull 全流程；验证部署-验证闭环
         │
Phase 3 上线
    │
    ├── 步骤 1: 确认 YAML anchors/aliases/merge 正确工作
    ├── 步骤 2: 部署 Git 增强适配器（向后兼容，不破坏现有集成）
    ├── 步骤 3: 上线前端插件管理页面和制品库页面
    └── 步骤 4: 上线 PipelineRun 详情页 + SSE 实时日志流
```

#### 5.7.3 回滚方案

- **Phase 1 回滚**：保留 `TaskRunner` 作为 fallback，StageExecutor 可通过配置切回纯 TaskRunner 模式
- **Phase 2 回滚**：容器化通过 feature flag 控制，关闭后自动回退到 Node.js 进程执行；SmartDeploy 集成通过 deploy stage type 判断，不启用则使用原有 k8s/* 路径
- **Phase 3 回滚**：YAML 解析保留双引擎验证，Git 增强为纯新增不修改现有逻辑，前端新页面独立路由不影响现有页面

### 5.8 资源需求与团队分工

| 角色 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| 后端开发 (2 人) | 桥接层 + TaskTypeToPluginMapper + ResultFormatAdapter + 双引擎统一 | PluginExecutorService 容器真实实现 + overlayfs + ArtifactProvider + DeployStageExecutor + CanaryAnalysis/AIReview stage | YAML 验证 + Git 适配器 + SSE Gateway |
| 前端开发 (1 人) | -- | 制品库页面原型 | 插件管理页面 + 制品库页面 + PipelineRun 详情页 + SSE 日志 + PipelineList 增强 |
| DevOps / Infra (1 人) | -- | MinIO 部署 + Docker 环境配置 + 缓存策略 | CI/CD 流水线配置 + 监控告警 |
| 测试 (1 人) | 单元测试 + 回归测试 | 集成测试 + 性能基准 | E2E 测试 + 用户验收 |

### 5.9 成功指标

| 指标 | Phase 1 完成时 | Phase 2 完成时 | Phase 3 完成时 |
|------|---------------|---------------|---------------|
| 新增任务类型所需时间 | 从"改代码+部署"降至"注册插件+配置映射"（< 1 小时） | -- | 插件市场安装（< 5 分钟） |
| 构建环境隔离性 | -- | 100% Pipeline 支持容器隔离 | -- |
| 缓存命中率 | -- | > 70%（重复构建） | > 80% |
| 制品管理 | 仅元数据 | Docker + npm 真实存储 | 6 种制品库全部可用 |
| 部署集成 | -- | Pipeline deploy stage 可调用 SmartDeploy | 部署策略可在 YAML 中声明 |
| YAML 配置效率 | -- | -- | 减少 30%+ 重复配置（通过 anchors） |
| CI 触发方式 | 手动 | 手动 + 定时 | 手动 + 定时 + Webhook（GitHub/GitLab/Gerrit） |
| 实时日志 | -- | SSE 基础设施就绪 | PipelineRun 详情页实时日志流 |
