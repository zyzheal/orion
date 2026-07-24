# Pipeline TS→Go 差距分析

> 分析日期: 2026-07-24 | TS: 351 文件 | Go: 115 文件

## 功能对照

### 🟢 Go 已实现的域（共 20 个）

| Go 域 | TS 对应 | 覆盖度 | 备注 |
|-------|---------|--------|------|
| pipeline | PipelineService | ✅ | 核心 CRUD |
| pipeline-run | PipelineRunService | ✅ | 运行管理 |
| pipeline-template | PipelineTemplateService | ✅ | 模板管理 |
| pipeline-version | PipelineVersionService | ✅ | 版本管理 |
| pipeline-graph | PipelineGraphBuilder | ✅ | DAG 图 |
| pipeline-sse | PipelineLogSSEService | ✅ | SSE 推送 |
| pipeline-budget | PipelineBudgetService | ✅ | 预算管控 |
| pipeline-batch | — | ✅ | 批量执行 |
| pipeline-control | — | ✅ | 执行控制 |
| pipeline-trigger | PipelineTriggerService | ✅ | 触发器 |
| pipeline-audit-log | — | ✅ | 审计日志 |
| pipeline-rbac | PipelineRBACService | ✅ | RBAC 权限 |
| approval-gate | ApprovalGateService | ✅ | 审批门禁 |
| autonomous | SelfAdaptivePipelineService | ✅ | 自主 Pipeline |
| metrics | PipelineMetricsService | ✅ | 指标监控 |
| runner | RunnerPoolService | ✅ | Runner 管理 |
| deploy | — | ✅ | 部署 |
| build | — | ✅ | 构建 |
| canary | — | ✅ | 金丝雀 |
| template | — | ✅ | 模板 |

### 🔴 TS 有但 Go 缺的域（共 30 个）

| 缺失域 | TS 文件 | 优先级 | 说明 |
|--------|---------|--------|------|
| **ArtifactRegistry** | ArtifactRegistryService.ts | P0 | 制品注册 |
| **ArtifactVersion** | ArtifactVersionService.ts | P0 | 制品版本管理 |
| **ArtifactSignature** | ArtifactSignatureService.ts | P1 | 制品签名 |
| **DeploymentStrategy** | DeploymentStrategyService.ts | P0 | 部署策略（蓝绿/金丝雀/滚动） |
| **DockerBuild** | DockerBuildService.ts | P0 | Docker 构建 |
| **HelmDeployment** | HelmDeploymentService.ts | P0 | Helm 部署 |
| **KubernetesDeploy** | KubernetesDeploymentService.ts | P0 | K8s 原生部署 |
| **ObjectStorage** | ObjectStorageService.ts | P1 | 对象存储（制品/缓存） |
| **PipelineEngine** | PipelineEngine.ts | P0 | 核心引擎执行 |
| **ExecutionQueue** | PipelineExecutionQueue.ts | P0 | 执行队列 |
| **AutoRetry** | AutoRetryService.ts | P1 | 自动重试 |
| **DynamicParams** | DynamicParamsResolver.ts | P1 | 动态参数解析 |
| **ErrorClassifier** | ErrorClassifier.ts | P1 | 错误分类/智能分析 |
| **IMNotifier** | IMNotifier (DingTalk/Feishu/WeCom) | P1 | 即时通讯通知 |
| **PathFilter** | PathFilter.ts | P2 | 路径过滤器 |
| **PullRequest** | PullRequestService.ts | P1 | PR 集成 |
| **QualityGate** | QualityGateService.ts | P0 | 质量门禁 |
| **RunnerCache** | RunnerCacheService.ts | P1 | Runner 缓存 |
| **SCMWebhook** | SCMWebhookService.ts | P1 | SCM Webhook |
| **Secrets** | SecretsService.ts | P1 | 密钥管理 |
| **SharedAction** | SharedActionService.ts | P2 | 共享 Action |
| **SubPipeline** | SubPipelineService.ts | P1 | 子 Pipeline |
| **TaskExecutor** | TaskExecutorService.ts | P0 | 任务执行器 |
| **TestReport** | TestReportService.ts | P1 | 测试报告 |
| **Traceability** | TraceabilityService.ts | P2 | 可追溯性 |
| **VisualPipeline** | VisualPipelineService.ts | P1 | 可视化 Pipeline |
| **WebhookNotifier** | WebhookNotifier.ts | P1 | Webhook 通知 |
| **YamlConverter** | YamlConverter.ts | P2 | YAML 转换 |
| **AdaptiveTimeout** | AdaptiveTimeoutService.ts | P2 | 自适应超时 |
| **CacheStrategy** | CacheStrategyService.ts | P1 | 缓存策略 |

## 迁移优先级

### Phase 1（P0，3 天）
1. PipelineEngine — 核心执行引擎（最核心）
2. ArtifactRegistry + ArtifactVersion — 制品管理
3. DeploymentStrategy — 部署策略（蓝绿/滚动）
4. DockerBuild + HelmDeployment — 构建部署
5. KubernetesDeployment — K8s 部署
6. QualityGate — 质量门禁
7. TaskExecutor — 任务执行器
8. ExecutionQueue — 执行队列

### Phase 2（P1，2 天）
9. ArtifactSignature — 制品签名
10. ObjectStorage — 对象存储
11. AutoRetry — 自动重试
12. DynamicParams — 动态参数
13. ErrorClassifier — 错误分类
14. IMNotifier — IM 通知
15. PullRequest — PR 集成
16. RunnerCache — Runner 缓存
17. SCMWebhook — SCM Webhook
18. Secrets — 密钥管理
19. SubPipeline — 子 Pipeline
20. TestReport — 测试报告
21. VisualPipeline — 可视化 Pipeline
22. WebhookNotifier — Webhook 通知
23. CacheStrategy — 缓存策略

### Phase 3（P2，1 天）
24. PathFilter — 路径过滤器
25. SharedAction — 共享 Action
26. Traceability — 可追溯性
27. YamlConverter — YAML 转换
28. AdaptiveTimeout — 自适应超时

## 总工作量
- Phase 1: 8 个 P0 域 → 3 天
- Phase 2: 15 个 P1 域 → 2 天
- Phase 3: 5 个 P2 域 → 1 天
- **合计**: 约 6 天
