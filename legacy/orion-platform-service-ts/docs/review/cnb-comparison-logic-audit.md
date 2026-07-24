# CNB 对比设计文档 - 逻辑完整性审计报告

> **审计日期**: 2026-04-19
> **审计范围**: 设计文档是否覆盖当前系统的所有逻辑方面
> **前置文档**: [架构审计报告](./cnb-comparison-architecture-audit.md)

---

## 1. 前后端契约缺口 (Frontend-Backend Contract Gaps)

### 1.1 [严重] PipelineEditor YAML 生成不包含 container 字段

设计文档 Gap 2 定义了 `container: { image, workingDir, env }` YAML 结构，但 `PipelineEditor/index.tsx` 的 `generateYaml()` 方法硬编码 `runsOn: ubuntu-latest`（第 153 行），完全没有 `container` 字段的生成逻辑。

**前端需要的变更：**
- StageModal 增加容器配置表单（image 输入、workingDir、环境变量）
- `generateYaml()` 需要条件生成 `container` 或 `runsOn`
- `StageConfig` 接口需要新增 `container?: { image, workingDir, env }` 字段

### 1.2 [严重] Stage 类型硬编码，无法适配插件系统

`PipelineEditor/index.tsx` 第 55-62 行：

```typescript
const STAGE_TYPES = [
  { label: '构建 (Build)', value: 'build' },
  { label: '测试 (Test)', value: 'test' },
  { label: '代码扫描 (Scan)', value: 'scan' },
  { label: '部署 (Deploy)', value: 'deploy' },
  { label: '通知 (Notify)', value: 'notify' },
  { label: '自定义 (Custom)', value: 'custom' },
];
```

设计文档提出插件注册机制后，Stage 类型应该是动态发现的（通过 PluginRegistry.list()），而非前端硬编码。设计文档未提及前端需要增加"从后端拉取可用插件列表"的逻辑。

### 1.3 [严重] YAML anchors/aliases/merge 编辑器支持缺失

设计文档 Gap 5 支持 YAML 高级语法，但 PipelineEditor 的 YAML 生成完全用字符串拼接（第 131-190 行），没有 anchors/aliases 的概念。前端需要：
- 增加 `definitions` 区域管理
- Stage 表单支持"引用定义"
- YAML 预览展示合并后的结果
- 设计文档未涉及任何这些前端改动

### 1.4 [重要] 缺少插件管理前端页面

设计文档 Gap 7 提到"前端展示已安装/可用插件列表"和"插件 Marketplace 页面"，但具体页面结构、API 调用、路由配置完全没有定义。

### 1.5 [重要] 缺少制品库前端页面

设计文档 Gap 4 提到"制品库前端（上传/下载/列表）"，但：
- 当前 `PipelineList` 页面只显示 pipeline 定义列表，不显示运行历史
- 不存在 PipelineRun 详情页面（只有测试文件 `DeploymentDetail.test.tsx` 等）
- `pipelines.ts` 已有 `uploadArtifact` / `downloadArtifact` / `listArtifacts` API，但没有任何页面消费这些 API

### 1.6 [轻微] PipelineList 不显示 Run 状态

`PipelineList/index.tsx` 显示的是 `Pipeline.status`（active/inactive/deleted），而非最近一次 PipelineRun 的状态。CNB 列表通常展示最近运行状态（success/failed/running），设计文档未提及这一 UX 改进。

---

## 2. 数据流完整性 (Data Flow Completeness)

### 2.1 [严重] 插件执行结果流向完全未追踪

当前实际数据流：

```
PipelineEngine.execute()
  → StageExecutor.executeTask()
    → TaskRunner.run()              // 硬编码 5 种类型，返回 TaskExecutionResult
    → TaskRunner 内部 result 对象
  → runService.updateTask(result)   // 写入内存
  → eventPublisher.publishTaskCompleted()  // 发布到 NATS EventBus
```

PluginExecutorService 的完整数据流（从未被调用）：

```
PluginExecutorService.executeTask()
  → 根据安全等级选择 WASM/Container/Process 运行时
  → 返回 TaskExecutionResult（不同格式：exitCode, stdout, stderr, outputs）
  → 发布 plugin.task.completed 到 EventBus
```

**设计文档的问题：**
- 没有描述 `StageExecutor` 如何桥接到 `PluginExecutorService`
- 没有说明两种 `TaskExecutionResult` 格式如何统一（TaskRunner 返回 `{ status, result, log, error }`，PluginExecutorService 返回 `{ taskId, status, exitCode, stdout, stderr, outputs, errorMessage }`）
- 没有描述事件从 EventBus → SSE → 前端的传递链路

### 2.2 [严重] SSE 日志流方案缺失

设计文档将 "SSE 实时日志流" 列为 Orion 优势（第 3 节第 1 条），向后兼容承诺说"容器化后通过 stdout 转发到 SSE"，但：

- 后端没有 pipeline 相关的 SSE 路由（搜索 `text/event-stream`、`streamResponse`、`EventSource` 均未找到 pipeline 相关的流式端点）
- `PipelineEventPublisher` 发布到 NATS EventBus，但没有消费方将 NATS 事件转换为 SSE 推送给前端
- 前端没有使用 EventSource 或 SSE 消费 pipeline 日志的代码
- 设计文档完全没有描述这个关键基础设施组件

### 2.3 [重要] PluginExecutorService 的 EventBus 集成与 PipelineEventPublisher 冲突

- `PluginManagerService` 和 `PluginExecutorService` 使用 `EventBusService` 直接发布事件（`plugin.installed`, `plugin.task.completed` 等）
- `PipelineEngine` 使用 `PipelineEventPublisher` 发布 pipeline 级别的事件（`pipeline.run.created`, `stage.completed` 等）
- 两套事件系统没有整合设计，前端需要同时消费两种格式的事件
- 设计文档未提及事件统一或转换策略

### 2.4 [重要] PipelineRun 状态更新链路不完整

设计文档验收标准提到"插件 execute() 返回标准 TaskResult，由上层统一处理状态"，但：
- 当前 `PipelineEngine.executeStage()` 中，task 失败直接 throw error（第 209-211 行）
- 如果插件返回 `QUOTA_EXCEEDED`、`VALIDATION_FAILED` 等 PluginExecutorService 特有的状态，PipelineEngine 无法识别这些状态
- 设计文档没有定义状态映射表

---

## 3. 边界情况 (Edge Cases)

### 3.1 [严重] 插件执行中失败的恢复策略

设计文档提到"插件加载失败时降级到 mock 插件"，但未覆盖：
- 插件执行中途崩溃（进程被 kill、容器退出码非 0）
- 插件输出格式不符合 schema 验证
- 插件消耗资源超过配额（`resourceQuota`）时的处理方式
- 当前 `StageExecutor.executeTask()` 对所有异常统一处理为 `TaskStatus.FAILED`，不区分失败原因

### 3.2 [重要] 并发插件执行的资源竞争

- `PipelineEngine.executePendingStages()` 使用 fire-and-forget 模式（第 178 行），没有并发度控制
- 多个 Stage 并行执行时，如果都使用同一个 workspace volume，会产生写竞争
- 设计文档 Gap 2 提到"容器间通过 Volume 共享 workspace"，但未说明并行 Stage 如何隔离 workspace
- `PluginExecutorService` 的 `simulateExecution()` 中也没有并发安全机制

### 3.3 [重要] 插件版本冲突处理

设计文档 Gap 7 提到"插件沙箱隔离，各自独立 node_modules"，但：
- 同一 pipeline 内两个 Stage 引用同一插件的不同版本（`orion/docker-build@v1` vs `orion/docker-build@v2`），如何处理？
- `PluginRegistry.resolve("orion/docker-build@v1")` 的精确匹配逻辑未定义
- 当前代码 `PipelineEngine.initializeTasks()` 用 `step.uses.split('@')[0]` 丢弃版本号（第 137 行），版本信息完全丢失

### 3.4 [重要] 插件热加载与正在执行的 Pipeline 冲突

设计文档提到"从插件目录读取 .js/.ts 文件"实现热加载，但未考虑：
- 正在运行的 Pipeline 使用了旧版插件，同时新版本被加载
- `PluginManagerService` 的插件状态机（ACTIVE → INACTIVE）与热加载的关系
- 热加载是否需要等待当前使用该插件的 PipelineRun 完成

### 3.5 [中等] 容器化构建的网络分区

设计文档提到"Docker-in-Docker 权限问题"的降级方案，但未考虑：
- 容器内需要访问外部 Git 仓库（git clone），网络配置如何处理？
- 容器内需要拉取 Docker 镜像（docker build），Docker socket 挂载的安全问题
- 代理服务器环境下的容器网络配置

### 3.6 [中等] 租户隔离的边界情况

- 插件安装是租户级别还是全局级别？
- 缓存 key 是否需要租户前缀？
- 制品库的命名空间如何与租户隔离？
- 设计文档完全未提及租户隔离（架构审计 3.3 已指出）

---

## 4. 设计遗漏的 CNB 特性

### 4.1 [重要] CNB Buildpacks 自动语言检测

设计文档提到"语言自动检测：扫描项目根目录特征文件"（Gap 3），但 CNB 的核心是 **Buildpacks** 机制 —— 不仅是检测语言，而是自动构建完整依赖树和运行时环境。设计文档的"语言自动检测"只是缓存 key 生成的辅助功能，不是 Buildpacks 的等价替代。

### 4.2 [中等] CNB Pipeline 间的缓存跨 Pipeline 复用

CNB 的 OverlayFS 缓存是跨 Pipeline 复用的（不同 Pipeline 运行相同依赖时共享缓存层）。设计文档的缓存方案似乎只考虑了单 Pipeline 内的复用，`PipelineStage.cache` 模型的 `key` 是 stage 级别的，没有 Pipeline 级别的缓存共享设计。

### 4.3 [中等] CNB 的 PR/MR 评论集成

CNB 支持在 PR/MR 中直接显示 Pipeline 状态、构建产物预览。设计文档 Gap 6 只提到"Webhook 自动触发 Pipeline"和"MR 关联 Pipeline 状态"，没有设计 PR 评论内的交互能力。

### 4.4 [轻微] CNB 的 Build 结果可视化

CNB 可以查看构建输出（层大小、依赖树）。设计文档没有考虑构建产物的可视化展示。

---

## 5. 设计遗漏的 Orion 已有优势

除设计文档列出的 6 项优势外，Orion 还有以下未被提及的差异化能力：

### 5.1 [重要] SmartDeploy 智能部署系统

`SmartDeployService` 支持：
- Blue-Green / Canary / Rolling / Recreate 四种部署策略
- 部署前风险评估（集成 `RiskAssessmentService`）
- 部署验证（`DeploymentVerifier`）
- 自动回滚
- 部署审计追踪

这是 CNB 完全没有的能力，但设计文档未将其列入"Orion 优势"。

### 5.2 [重要] Canary Analysis 灰度分析

`canary-analysis-routes.ts` 存在完整的灰度分析系统，可以与 Canary 部署策略联动。

### 5.3 [中等] AI Review 服务

`AIReviewService` 提供代码 AI 审查能力，可集成到 Pipeline 的 scan stage。

### 5.4 [中等] Test Selector 测试影响分析

`TestSelectorService` 支持基于代码变更的智能测试选择，可以减少 Pipeline 执行时间。

### 5.5 [中等] Change Intelligence 变更智能分析

`ChangeIntelligenceService` 提供变更影响范围分析、风险评估。

### 5.6 [轻微] Policy Evaluation 策略评估

`PolicyEvaluationService` 提供部署前策略检查（合规、安全）。

---

## 6. 部署 Pipeline 集成 (Deployment Pipeline Integration)

### 6.1 [严重] Pipeline deploy stage 与 SmartDeployService 完全断开

当前状况：
- `deploy-routes.ts` 定义了完整的部署 API（创建、状态、回滚、取消、审计）
- `SmartDeployService` 是独立的部署编排引擎
- `PipelineEditor` 中 "deploy" 类型的 Stage 最终通过 `TaskRunner.executeK8sTask()` 执行（硬编码的 `k8s/*` 前缀匹配）
- **两者之间没有任何连接**：Pipeline 的 deploy stage 不会调用 SmartDeployService

设计文档的问题：
- Gap 2（容器化构建）和 Gap 4（制品库）完成后，pipeline 最终产出 Docker 镜像，但如何触发 SmartDeployService 进行部署？
- 设计文档没有定义 "deploy stage → SmartDeployService" 的集成点
- 没有说明 pipeline 产出的制品（Docker image tag）如何传递给部署系统
- `DeploymentStrategyEngine` 可以创建 blue-green / canary 的部署阶段（`DeploymentStrategyEngine.ts` 第 116、198、406 行），但这些阶段与 Pipeline stages 是完全独立的两个系统

### 6.2 [重要] 部署策略无法在 Pipeline YAML 中声明

用户无法在 Pipeline YAML 中指定"使用 canary 策略部署到生产环境"。SmartDeployService 的 `DeploymentStrategyConfig` 完全独立于 Pipeline YAML schema。

### 6.3 [重要] 部署验证与 Pipeline 状态没有联动

`DeploymentVerifier` 验证部署结果后，结果无法反馈回 PipelineRun 状态。如果部署失败，Pipeline 可能已经标记为 success。

---

## 7. 设计文档内部逻辑矛盾

### 7.1 Gap 1 实现路径与向后兼容承诺矛盾

- 实现路径说"创建 TaskPlugin 接口 + PluginRegistry 服务"（全新构建）
- 向后兼容说"保持 type 字段向后兼容，PluginRegistry.resolve() 内部做 type-to-plugin 映射"
- 但 `TaskPlugin.execute()` 的签名是 `(params: TaskParams, signal?: AbortSignal) => Promise<TaskResult>`
- 当前 `TaskRunner.run()` 的签名是 `(task: Task, signal?: AbortSignal) => Promise<Task>`
- `Task` 对象包含 id/stageId/log 等上下文，`TaskParams` 是否包含这些？没有定义

### 7.2 Phase 1 周次计划与实际工作量不匹配

- Week 1 只定义接口
- Week 2 迁移 5 种硬编码任务
- 但架构审计发现 PluginExecutorService 已经存在且包含 3 种执行模式
- 实际需要的是"桥接"而非"迁移"，计划没有反映这一点

### 7.3 依赖关系图与 Gap 描述矛盾

- 依赖图显示 Gap 4 依赖 Gap 2（制品需要容器环境 push/pull）
- 但 npm 制品不需要容器环境，可以在 Gap 1 之后独立实现
- Gap 4 里程碑从 Week 7 开始，但 Gap 2/3 也从 Week 5 开始，实际可以更早启动部分工作

---

## 总结

| 维度 | 发现数量 | 严重程度 |
|------|----------|----------|
| 前后端契约缺口 | 6 项 | 3 严重 + 2 重要 + 1 轻微 |
| 数据流完整性 | 4 项 | 2 严重 + 2 重要 |
| 边界情况 | 6 项 | 1 严重 + 3 重要 + 2 中等 |
| 遗漏的 CNB 特性 | 4 项 | 1 重要 + 2 中等 + 1 轻微 |
| 遗漏的 Orion 优势 | 6 项 | 2 重要 + 3 中等 + 1 轻微 |
| 部署集成缺口 | 3 项 | 1 严重 + 2 重要 |
| 内部逻辑矛盾 | 3 项 | 中等 |

**核心结论：** 设计文档在功能 Gap 识别上是准确的，但存在以下重大逻辑缺口：

1. **数据流断裂**：从 PluginExecutorService 到前端 SSE 的完整链路未设计，尤其是 SSE 基础设施本身不存在
2. **前后端脱节**：前端需要的大量改动（容器配置 UI、插件管理页面、制品库页面、YAML anchors 编辑器）未被纳入实施计划
3. **部署系统孤岛**：SmartDeployService 与 Pipeline 系统完全断开，deploy stage 无法利用智能部署能力
4. **已有优势未识别**：SmartDeploy、Canary Analysis、AI Review 等企业级能力未被列入 Orion 优势清单

建议设计文档 v2 补充上述逻辑缺口后再进入实施阶段。
