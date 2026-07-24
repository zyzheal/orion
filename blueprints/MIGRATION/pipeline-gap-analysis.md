# Pipeline TS→Go 差距分析

> 分析日期: 2026-07-24 | 校准后数据 | TS 源文件: 117 | Go 文件: 115
> **注意**: 此前统计 351 TS 文件包含了 `dist/` 编译产物，实际源文件为 117。

## 功能对照

### 🟢 Go 已实现的域（共 20 个）

| Go 域 | 说明 | 状态 |
|-------|------|------|
| pipeline | 核心 CRUD | ✅ |
| pipeline-run | 运行管理 | ✅ |
| pipeline-template | 模板管理 | ✅ |
| pipeline-version | 版本管理 | ✅ |
| pipeline-graph | DAG 图 | ✅ |
| pipeline-sse | SSE 推送 | ✅ |
| pipeline-budget | 预算管控 | ✅ |
| pipeline-batch | 批量执行 | ✅ |
| pipeline-control | 执行控制 | ✅ |
| pipeline-trigger | 触发器 | ✅ |
| pipeline-audit-log | 审计日志 | ✅ |
| pipeline-rbac | RBAC 权限 | ✅ |
| approval-gate | 审批门禁 | ✅ |
| autonomous | 自主 Pipeline | ✅ |
| metrics | 指标监控 | ✅ |
| runner | Runner 管理 | ✅ |
| deploy | 部署 | ✅ |
| build | 构建 | ✅ |
| canary | 金丝雀 | ✅ |
| template | 模板 | ✅ |

### 🔴 TS 有但 Go 缺的域（共 30 个）

| 缺失域 | 优先级 | 说明 | 阶段 |
|--------|--------|------|------|
| PipelineEngine | P0 | 核心执行引擎 | Phase 1 |
| ArtifactRegistry | P0 | 制品注册 | Phase 1 |
| ArtifactVersion | P0 | 制品版本管理 | Phase 1 |
| DeploymentStrategy | P0 | 部署策略（蓝绿/金丝雀/滚动） | Phase 1 |
| DockerBuild | P0 | Docker 构建 | Phase 1 |
| HelmDeployment | P0 | Helm 部署 | Phase 1 |
| KubernetesDeploy | P0 | K8s 原生部署 | Phase 1 |
| QualityGate | P0 | 质量门禁 | Phase 1 |
| TaskExecutor | P0 | 任务执行器 | Phase 1 |
| ExecutionQueue | P0 | 执行队列 | Phase 1 |
| ArtifactSignature | P1 | 制品签名 | Phase 2 |
| ObjectStorage | P1 | 对象存储（制品/缓存） | Phase 2 |
| AutoRetry | P1 | 自动重试 | Phase 2 |
| DynamicParams | P1 | 动态参数解析 | Phase 2 |
| ErrorClassifier | P1 | 错误分类/智能分析 | Phase 2 |
| IMNotifier | P1 | 即时通讯通知 | Phase 2 |
| PullRequest | P1 | PR 集成 | Phase 2 |
| RunnerCache | P1 | Runner 缓存 | Phase 2 |
| SCMWebhook | P1 | SCM Webhook | Phase 2 |
| Secrets | P1 | 密钥管理 | Phase 2 |
| SubPipeline | P1 | 子 Pipeline | Phase 2 |
| TestReport | P1 | 测试报告 | Phase 2 |
| VisualPipeline | P1 | 可视化 Pipeline | Phase 2 |
| WebhookNotifier | P1 | Webhook 通知 | Phase 2 |
| CacheStrategy | P1 | 缓存策略 | Phase 2 |
| PathFilter | P2 | 路径过滤器 | Phase 3 |
| SharedAction | P2 | 共享 Action | Phase 3 |
| Traceability | P2 | 可追溯性 | Phase 3 |
| YamlConverter | P2 | YAML 转换 | Phase 3 |
| AdaptiveTimeout | P2 | 自适应超时 | Phase 3 |

## 迁移优先级

### Phase 1（P0，10 域，3 天）
1. PipelineEngine — 核心执行引擎（最核心）
2. ArtifactRegistry + ArtifactVersion — 制品管理
3. DeploymentStrategy — 部署策略（蓝绿/滚动）
4. DockerBuild + HelmDeployment — 构建部署
5. KubernetesDeployment — K8s 部署
6. QualityGate — 质量门禁
7. TaskExecutor — 任务执行器
8. ExecutionQueue — 执行队列

### Phase 2（P1，15 域，2 天）
ArtifactSignature, ObjectStorage, AutoRetry, DynamicParams, ErrorClassifier,
IMNotifier, PullRequest, RunnerCache, SCMWebhook, Secrets, SubPipeline,
TestReport, VisualPipeline, WebhookNotifier, CacheStrategy

### Phase 3（P2，5 域，1 天）
PathFilter, SharedAction, Traceability, YamlConverter, AdaptiveTimeout

## 总工作量
- Phase 1: 10 个 P0 域 → 3 天
- Phase 2: 15 个 P1 域 → 2 天
- Phase 3: 5 个 P2 域 → 1 天
- **合计**: 约 6 天
