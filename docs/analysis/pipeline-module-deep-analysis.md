# Pipeline 模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/pipeline/` 及引擎层

---

## 模块概览

Pipeline 模块是 Orion 的核心 CI/CD 引擎，实现了一个完整的 Pipeline 执行系统，支持 YAML 定义、多 Stage 编排、多种 Task 执行后端（shell/Docker/Plugin/Skill）、SSE 实时日志推送、Saga 分布式事务、崩溃恢复、灰度发布等能力。

### 核心文件

| 文件 | 职责 |
|------|------|
| `PipelineService.ts` | Pipeline CRUD、版本管理、触发执行 |
| `PipelineRunService.ts` | PipelineRun 生命周期管理 |
| `PipelineRepository.ts` / `PipelineRunRepository.ts` | PostgreSQL 数据访问层 |
| `PipelineEngine.ts` | 执行编排 Facade，协调所有执行组件 |
| `StageExecutor.ts` | Stage 内 Task 逐个执行、超时控制 |
| `TaskRunner.ts` | Task 实际执行（shell/spawn/Docker/Skill/Plugin） |
| `StageOrchestrator.ts` | Stage 并行/串行编排、条件路由、重试、SubPipeline |
| `PipelineSaga.ts` | Pipeline 执行分布式事务（5 步骤 + 补偿） |
| `PipelineEventSSEBridge.ts` | 引擎事件桥接到 SSE 推送服务 |
| `PipelineLogSSEService.ts` | SSE 连接管理、日志/状态实时推送 |
| `PipelineTriggerService.ts` | 触发器引擎（git/webhook/schedule/manual） |
| `PipelineExecutionQueue.ts` | 全局执行队列、背压控制、优先级调度 |

---

## 架构设计

### 执行引擎架构

```
PipelineEngine (Facade)
  ├── StageInitializer        → 从 YAML 创建 Stage/Task 对象
  ├── StageOrchestrator       → Stage 级编排（并行/串行/条件/重试）
  │     ├── ConditionRouter   → if/unless 条件评估
  │     ├── AutoRetryService  → 自动重试（指数退避）
  │     └── GrayScaleController + MultiTargetExecutor → 灰度/多目标
  ├── StageExecutor           → 单个 Stage 内 Task 顺序执行
  │     ├── TaskRunner        → 实际任务执行（shell/Docker/Plugin/Skill）
  │     ├── WorkspaceIsolator → 工作区隔离
  │     └── VariableContext   → 变量上下文
  ├── PipelineGateController  → 质量门禁/审批网关/部署策略
  ├── PipelineLifecycleHandler → 完成/取消/审批生命周期
  ├── PipelineCrashRecovery   → 崩溃恢复 + Checkpoint
  └── PipelineExecutionQueue  → 全局队列 + 背压控制
```

### SSE 实时推送链路

```
TaskRunner / StageExecutor / PipelineEngine
  ↓ 调用
PipelineEventPublisher.publishTaskStarted/Completed/Failed()
  ↓ 同时调用
PipelineEventSSEBridge
  ↓ 调用
PipelineLogSSEService.publishLogEvent() / publishStatusEvent()
  ↓ 推送到
HTTP SSE 连接
```

---

## 功能完整性评估

| 功能 | 状态 | 说明 |
|------|------|------|
| Pipeline CRUD | ✅ | PipelineRepository + PipelineService |
| Pipeline 版本管理 | ✅ | PipelineVersionService，diff/rollback/tag |
| Pipeline 模板 | ✅ | PipelineTemplateService |
| Pipeline 验证 | ✅ | PipelineValidator，YAML 语法 + 依赖检查 |
| Pipeline 触发（手动/Git/Schedule/API） | ✅ | 四种触发方式完整 |
| Pipeline 执行引擎 | ✅ | PipelineEngine → StageOrchestrator → StageExecutor → TaskRunner |
| Stage 并行/串行/条件/重试 | ✅ | StageOrchestrator 完整支持 |
| Task 实际执行（shell/Docker/Plugin/Skill） | ✅ | TaskRunner 支持多种后端 |
| SubPipeline / Matrix / 灰度 | ✅ | SubPipelineService / MatrixExpander / GrayScaleController |
| 质量门禁 / 审批网关 / 部署策略 | ✅ | QualityGateService + ApprovalGateService + DeploymentStrategyService |
| 执行队列（背压） | ✅ | PipelineExecutionQueue |
| SSE 实时日志/状态 | ✅ | PipelineLogSSEService + pipeline-sse-routes |
| 崩溃恢复 + Checkpoint | ✅ | PipelineCrashRecovery + PipelineCheckpointManager |
| Debug 模式（pause/step/resume） | ✅ | DebugController |
| Secrets 管理 / 全局参数 / 环境变量 | ✅ | SecretsService + GlobalParamService + EnvironmentService |
| Script 版本管理 | ✅ | ScriptVersionService |
| 审计日志 | ✅ | PipelineAuditLogService |
| 执行控制（pause/resume/abort/retry） | ✅ | PipelineExecutionControlService |
| DAG 可视化 API | ✅ | PipelineGraphBuilder + YamlConverter |
| RBAC 权限 / 通知 / SCM 状态回写 | ✅ | PipelineRBACService + IMNotifier + ScmStatusReporter |
| PipelineSaga 持久化 | ❌ | 模块级 Map 存储，进程重启丢失 |
| PipelineEngine.executions 持久化 | ❌ | private executions = new Map()，内存态 |
| ResourceService | ❌ | Saga 步骤 2 显式抛出 ResourceService not implemented |
| retryRun 实现 | ❌ | 返回 mock ID，无实际重试逻辑 |
| PipelineTriggerService 持久化 | ❌ | triggers/executionHistory/cronSchedules 均为内存 Map |

---

## API 端点清单

核心 Pipeline 路由约 **60+ 个端点**，覆盖：
- Pipeline CRUD + 验证 + 版本管理
- Run 管理（创建/查询/取消/重试/暂停/恢复/中止/重启）
- Stage/Task 查询 + 重试
- SSE 实时日志/状态推送
- 审批网关
- 审计日志
- 模板管理
- DAG 可视化
- SCM Webhook

---

## 缺失功能

| 缺失项 | 严重程度 | 说明 |
|--------|---------|------|
| PipelineSaga 状态持久化 | P0 | 进程重启后 Saga 状态完全丢失 |
| PipelineEngine.executions 持久化 | P0 | 引擎崩溃后无法恢复执行上下文 |
| ResourceService 未实现 | P0 | Saga 步骤 2 直接抛异常 |
| retryRun 仅返回 mock | P0 | 无实际重试逻辑 |
| PipelineTriggerService 持久化 | P1 | triggers/cronSchedules 重启后丢失 |
| StageOrchestrator 运行时状态 | P1 | variableContexts 为内存 Map |
| Pipeline 参数 UI 绑定 | P1 | parameters 未透传到 config_snapshot |
| 批量操作 API | P2 | 缺少批量启停/删除/触发 |
| Pipeline 运行历史趋势 | P2 | 缺少按时间范围的趋势 API |

---

## 技术债务

| 问题 | 影响 | 建议 |
|------|------|------|
| PipelineSaga 使用模块级全局 Map | 进程重启后状态丢失 | 迁移到 PostgreSQL 或 Redis |
| PipelineEngine.executions 内存态 | 引擎崩溃后无法恢复 | 持久化到 PostgreSQL |
| PipelineService 兼容 Mock 和 Repository 双模式 | 代码复杂度高 | 统一使用 PostgreSQL Repository |
| PipelineSaga 与 PipelineEngine 双执行路径 | 维护成本翻倍 | 确定唯一执行入口 |
| StageOrchestrator 构造参数过多（16 个） | 依赖注入复杂 | 拆分为更小的编排器 |
| PipelineTriggerService 内存态触发器 | 多实例部署时重复触发 | 使用分布式调度 |
| TaskRunner 混合多种执行后端 | 单一文件过长 | 拆分为 Strategy 模式 |

---

## 与其他模块集成点

| 模块 | 集成方式 | 状态 |
|------|----------|------|
| Artifact | Stage 完成后传递制品 | ✅ |
| Deploy | DeploymentStrategyService 处理部署策略 | ✅ |
| Notification | IMNotifier + WebhookNotifier | ✅ |
| SCM | SCMWebhookService + CommitStatusService | ✅ |
| Approval | ApprovalGateService | ✅ |
| Quality | QualityGateService | ✅ |
| Cache | CacheRestoreSaveService | ✅ |
| Secrets | SecretsService | ✅ |
| Skill | SkillService | ✅ |
| EventBus | PipelineEventPublisher → NATS JetStream | ✅ |

---

## 建议优先级

1. **P0**: PipelineSaga 状态持久化重构
2. **P0**: PipelineEngine.executions 持久化
3. **P0**: ResourceService 实现
4. **P0**: retryRun 真实实现
5. **P1**: PipelineTriggerService 持久化
6. **P1**: 统一执行入口（废弃 PipelineSaga 作为执行入口）
7. **P2**: TaskRunner Strategy 重构
