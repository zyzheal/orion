# CI/CD 流水线编排能力对比分析

**Date**: 2026-05-08
**Scope**: Orion Pipeline Engine vs 业界主流 CI/CD 系统
**对比对象**:
- 国际: GitHub Actions, GitLab CI, Tekton, Jenkins, Argo Workflows, CircleCI, Azure DevOps
- 国内: 阿里云效（Flow）, 腾讯云 CODING DevOps, 华为云 DevCloud, 火山引擎 CI/CD, 百度效率云, 中国电子云 DevOps

---

## 1. 业界 CI/CD 编排能力全景图

### 1.1 能力矩阵总览

| 能力维度 | GitHub Actions | GitLab CI | Tekton | Jenkins | Argo Workflows | CircleCI | **Orion 当前** |
|----------|---------------|-----------|--------|---------|----------------|----------|---------------|
| DAG 编排 | `needs` | `needs` + DAG | Pipeline/Task DAG | `build flow` | DAG/Steps 模板 | `requires` | `dependsOn` |
| 并行执行 | 独立 job 并行 | `parallel` + DAG | 并发 Task | `parallel` | 并行节点 | 独立 job 并行 | `Promise.allSettled` |
| Matrix 构建 | `strategy.matrix` | `parallel:matrix` | 无原生 | Matrix plugin | `withItems` | `matrix` | **缺失** |
| 可复用工作流 | `uses` + composite | `include` + templates | Task 复用 | Shared Libraries | DAG 模板 | Orbs | **部分**（仅模板） |
| 条件引擎 | `if` 完整表达式 | `rules` + `when` | `when` 表达式 | Groovy 脚本 | `when` | 完整表达式 | **仅 `==`** |
| 变量传播 | `outputs` + `env` | `artifacts` + `dotenv` | Task `results` | 环境变量/文件 | `outputs` | `save_cache` | **缺失** |
| Artifact 传递 | `upload/download` | `artifacts` | Workspaces | Archive | S3/Artifacts | Workspace/Cache | `ArtifactService` |
| 手动审批 | Environments | `when: manual` | 无原生 | Input step | Suspend/Resume | Hold | `ApprovalGateService` |
| Secrets 管理 | `secrets.*` 遮蔽 | CI/CD Variables | External Secrets | Credentials | External Secrets | Context/Env | **缺失** |
| 缓存机制 | `actions/cache` | `cache: key` | 无原生 | Workspace | 无原生 | `save_cache` | **部分**（stage cache） |
| 从阶段重跑 | Re-run failed | Retry from stage | 无原生 | Replay | Resubmit | Rerun | **缺失** |
| 持久化执行 | K8s CRD | DB | K8s CRD | File/DB | K8s CRD | DB | DB | DB | DB | **Map 内存** |
| 事件导出 | Webhooks + Events | Webhooks + Events | Events | Webhooks | Webhooks | Webhooks | 事件总线 + 消息队列 | 事件总线 | 事件总线 | EventBus（未接 NATS） |
| 外部通知 | GitHub Status API | Webhooks/Slack | Triggers | Plugins | Webhooks | Slack/Email | 钉钉/企微/飞书 | 企微/邮件 | 钉钉/邮件 | **缺失** |

---

### 1.2 国内大厂 CI/CD 编排能力对比矩阵

| 能力维度 | 阿里云效 Flow | 腾讯云 CODING | 华为云 DevCloud | 火山引擎 CI/CD | 百度效率云 | **Orion 当前** |
|----------|---------------|---------------|-----------------|----------------|------------|---------------|
| DAG 编排 | 可视化 DAG + YAML | 可视化 + YAML | 可视化 + YAML | YAML + 可视化 | 可视化拖拽 | `dependsOn` |
| 并行执行 | 并行任务组 | 并行 job | 并行阶段 | 并行执行 | 并行节点 | `Promise.allSettled` |
| Matrix 构建 | ✅ 参数化并行 | ✅ 矩阵配置 | ✅ 并行策略 | ❌ | ❌ | **缺失** |
| 可复用工作流 | ✅ 流水线模板库 | ✅ 模板市场 | ✅ 共享组件库 | ✅ 模板引用 | ✅ 模板管理 | **部分**（仅模板） |
| 条件引擎 | ✅ 完整表达式 | ✅ 规则引擎 | ✅ 条件判断 | ✅ 表达式 | ✅ 条件判断 | **仅 `==`** |
| 变量传播 | ✅ 环境变量传递 | ✅ 输出参数 | ✅ 变量传递 | ✅ 环境变量 | ✅ 变量传递 | **缺失** |
| Artifact 传递 | ✅ 构建物管理 | ✅ 制品库 | ✅ 发布包管理 | ✅ 构建物 | ✅ 构建产物 | `ArtifactService` |
| 手动审批 | ✅ 审批节点 | ✅ 人工卡点 | ✅ 审批流 | ✅ 人工审核 | ✅ 审批流程 | `ApprovalGateService` |
| Secrets 管理 | ✅ 变量加密 | ✅ 安全变量 | ✅ 凭据管理 | ✅ 密钥管理 | ✅ 加密变量 | **缺失** |
| 缓存机制 | ✅ 缓存配置 | ✅ 缓存策略 | ✅ 构建缓存 | ✅ 缓存 | ✅ 缓存 | ⚠️ 部分 |
| 从阶段重跑 | ✅ 重试指定节点 | ✅ 重跑失败阶段 | ✅ 断点续跑 | ✅ 重跑 | ✅ 重试 | **缺失** |
| 持久化执行 | ✅ 全量持久化 | ✅ DB 持久化 | ✅ 全量持久化 | ✅ 持久化 | ✅ 持久化 | **Map 内存** |
| 事件导出 | ✅ 事件总线 | ✅ 事件通知 | ✅ 事件订阅 | ✅ 事件中心 | ✅ 事件通知 | EventBus（未接 NATS） |
| 外部通知 | ✅ 钉钉/企微/飞书 | ✅ 企微/邮件 | ✅ 钉钉/邮件 | ✅ 飞书/企微 | ✅ 企微/邮件 | **缺失** |
| 可视化编排 | ✅ 拖拽式 DAG | ✅ 可视化编排 | ✅ 可视化流水线 | ✅ 流水线设计器 | ✅ 拖拽编排 | **缺失** |
| 多环境部署 | ✅ 环境管理 | ✅ 环境分组 | ✅ 环境隔离 | ✅ 环境配置 | ✅ 环境管理 | **缺失** |
| 灰度/蓝绿 | ✅ 金丝雀/蓝绿 | ✅ 灰度发布 | ✅ 灰度策略 | ✅ 灰度发布 | ❌ | **缺失** |
| 代码质量集成 | ✅ 代码扫描 | ✅ 代码检查 | ✅ 代码检查 | ✅ 代码质量 | ✅ 代码扫描 | **缺失** |
| 安全扫描 | ✅ 安全检测 | ✅ 安全扫描 | ✅ 安全服务 | ✅ 安全扫描 | ✅ 安全检查 | **缺失** |
| 多租户隔离 | ✅ 企业/项目级 | ✅ 项目级 | ✅ 项目级 | ✅ 项目级 | ✅ 项目级 | `TenantIsolation` |

---

### 1.3 国内平台特色能力对比（Orion 缺失的关键能力）

| 特色能力 | 阿里云效 | 腾讯云 CODING | 华为云 DevCloud | 火山引擎 | 百度 | **Orion** | 说明 |
|----------|---------|--------------|----------------|---------|------|-----------|------|
| **可视化 DAG 编排** | ✅ 拖拽式 | ✅ 拖拽式 | ✅ 拖拽式 | ✅ 可视化 | ✅ 拖拽式 | **缺失** | 国内平台标配，可视化流水线编排 |
| **流水线模板市场** | ✅ 官方+社区 | ✅ 模板市场 | ✅ 共享组件库 | ✅ 模板中心 | ✅ 模板库 | **部分** | 可复用流水线模板，开箱即用 |
| **多环境管理** | ✅ 开发/测试/预发/生产 | ✅ 环境分组 | ✅ 环境隔离 | ✅ 环境配置 | ✅ 环境管理 | **缺失** | 同一流水线适配多环境部署 |
| **灰度/金丝雀发布** | ✅ 内置 | ✅ 内置 | ✅ 内置 | ✅ 内置 | ❌ | **缺失** | 渐进式发布策略 |
| **蓝绿部署** | ✅ 内置 | ✅ 支持 | ✅ 支持 | ✅ 支持 | ❌ | **缺失** | 无停机发布策略 |
| **代码质量门禁** | ✅ 集成 | ✅ 内置 | ✅ 内置 | ✅ 集成 | ✅ 集成 | **缺失** | 代码覆盖率/质量阈值阻断 |
| **安全扫描集成** | ✅ SAST/DAST | ✅ 安全扫描 | ✅ 安全检查 | ✅ 安全扫描 | ✅ 安全检查 | **缺失** | 安全左移，流水线内嵌安全检测 |
| **制品版本管理** | ✅ 版本化 | ✅ 版本管理 | ✅ 发布包管理 | ✅ 构建物版本 | ✅ 制品管理 | **缺失** | 构建产物的版本化管理和追溯 |
| **钉钉/企微/飞书通知** | ✅ 全部支持 | ✅ 企微/邮件 | ✅ 钉钉/邮件 | ✅ 飞书/企微 | ✅ 企微/邮件 | **缺失** | 国内 IM 集成是刚需 |
| **审批流自定义** | ✅ 多级审批 | ✅ 审批流程 | ✅ 多级审批 | ✅ 审批配置 | ✅ 审批流程 | **部分** | 多级、多人、会签审批 |
| **资源池管理** | ✅ 多 Runner | ✅ 构建集群 | ✅ 资源池 | ✅ 构建资源 | ✅ 资源管理 | **缺失** | 构建资源调度和隔离 |
| **构建物溯源** | ✅ 完整溯源 | ✅ 制品溯源 | ✅ 发布追溯 | ✅ 构建追溯 | ✅ 制品管理 | **缺失** | 从代码到部署的完整追溯链 |

## 2. Orion 流水线能力差距详解

### 2.1 编排与调度能力

#### GAP-01: 条件表达式引擎过于简单

**业界标准：**
- GitHub Actions: `if: github.ref == 'refs/heads/main' && !cancelled()` — 支持 `&&`, `||`, `!`, `contains()`, `startsWith()`, `endsWith()`, `success()`, `failure()`, `cancelled()`, `always()` 等完整函数集
- GitLab CI: `rules: - if: '$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == "main"' when: always allow_failure: false` — 支持正则、变量引用、文件变更检测
- CircleCI: `when: and(equal(<< pipeline.git.branch >>, "main"), not(equal(<< parameters.skip_tests >>, "true")))` — 管道 + 参数化条件

**Orion 现状：**
- `PipelineEngine.evaluateCondition()` 仅支持 `/^(\S+)\s*==\s*'([^']+)'$/` 单等式匹配
- `DynamicParamsResolver` 增加了 `!=` 支持，但仅用于动态 stage 生成
- 无法表达：`github.ref == 'main' && contains(changedFiles, 'package.json')`

**影响：** 无法实现"仅在 main 分支且 package.json 变更时部署"、"非取消状态才重试"等真实场景。

**复杂度：** 低（引入受限表达式解析器即可）

---

#### GAP-02: Matrix 构建缺失

**业界标准：**
- GitHub Actions: `strategy: matrix: os: [ubuntu-latest, windows-latest] node: [18, 20, 22] fail-fast: false` — 自动生成 6 个并行 job
- GitLab CI: `parallel:matrix: - NODE_VERSION: ['18', '20', '22'] OS: ['linux', 'macos']` — 生成 6 个并行 job
- CircleCI: `matrix: parameters: version: ['18', '20', '22']` — 参数化并行

**Orion 现状：** `PipelineStage` 无 `matrix` 字段，引擎无矩阵展开逻辑。用户必须手动复制 6 个 stage。

**影响：** 多平台/多版本测试场景下 YAML 膨胀 5-10 倍，维护成本极高。

**复杂度：** 中（stage 展开 + DAG 重构）

---

#### GAP-03: 可复用工作流 / Pipeline 组合

**业界标准：**
- GitHub Actions: `uses: org/repo/.github/workflows/security-scan.yml@main` — 跨仓库调用可复用工作流
- GitLab CI: `include: - project: 'my-group/my-project' ref: main file: '/templates/.gitlab-ci.yml'` — 跨项目模板包含
- CircleCI: Orbs — 可发布、版本化、组合的 CI 配置包
- Tekton: `Task` 可作为独立 CRD 被多个 `Pipeline` 引用

**Orion 现状：** `PipelineTemplateService` 仅支持一次性模板实例化（`instantiateTemplate()`），无法运行时动态调用另一个 pipeline 作为子流程。

**影响：** 无法构建"标准安全扫描流程"、"标准部署流程"等组织级 CI 库。

**复杂度：** 高（需要子流程调用 + 状态隔离 + 结果回传）

---

#### GAP-04: Task 输出变量传播

**业界标准：**
- GitHub Actions: `steps.build.outputs.version` — step 设置 outputs，后续 step 引用 `${{ steps.build.outputs.version }}`
- Tekton: `task.results` — Task 写入 `/tekton/results/xxx`，下游 Task 通过 `$(tasks.build.results.version)` 引用
- GitLab CI: `dotenv` artifacts — 写入 `.env` 文件，下游 job 自动加载变量
- CircleCI: `BASH_ENV` / `pipeline values` — 跨 job 传递构建元数据

**Orion 现状：** `TaskRunner.run()` 返回 result 对象，但仅存储在 Task 记录中，未暴露到 pipeline context。下游 task 无法通过 `${tasks.build.outputs.version}` 引用上游输出。

**影响：** 无法实现"构建产出版本号，部署使用该版本号"的核心模式。

**复杂度：** 中（context 传播 + 变量解析增强）

---

### 2.2 状态与持久化

#### GAP-05: 执行状态内存存储

**业界标准：**
- Tekton/Argo: 执行状态存储在 Kubernetes CRD 中，pod 重启不丢失
- GitLab CI: pipeline/run 状态存储在 PostgreSQL
- Jenkins: Pipeline 状态序列化到磁盘（`flowNodeStore`）
- GitHub Actions: 状态存储在 GitHub 后端数据库

**Orion 现状：** `PipelineEngine` 的 `executions = new Map<string, PipelineExecution>()` 存储所有运行中状态。进程重启后：
- 所有 running 阶段的 pipeline 丢失
- 正在执行的构建/部署中断且不可恢复
- 用户看到 pipeline 突然消失

**影响：** 生产环境不可接受。任何部署/滚动更新都会杀死所有运行中 pipeline。

**复杂度：** 高（需要 checkpoint 持久化 + startup recovery）

---

#### GAP-06: 从指定 Stage 重跑

**业界标准：**
- GitHub Actions: "Re-run jobs" + "Re-run failed jobs" — 可选择重跑全部或仅失败 job
- GitLab CI: "Retry" 按钮 + `retry:` 配置，支持 `when: on_failure`
- Jenkins: Replay + 可从任意 stage 重新开始
- CircleCI: "Rerun" + "Rerun from failed"

**Orion 现状：** `PipelineService.retryRun()` 始终从 stage 0 开始创建全新 run。

**影响：** 部署阶段失败（已跑了 10 分钟构建+测试），必须从头重跑。

**复杂度：** 中（需要 `fromStage` 参数 + 已完成的 stage 状态复用）

---

### 2.3 安全与权限

#### GAP-07: Secrets 管理缺失

**业界标准：**
- GitHub Actions: `${{ secrets.DEPLOY_KEY }}` — 引用 org/repo/env 级 secret，日志中自动遮蔽为 `***`
- GitLab CI: `$SECRET_VARIABLE` — CI/CD settings 中配置，protected/masked 标志，日志遮蔽
- Tekton: External Secrets Operator + Vault integration — 运行时注入
- Jenkins: Credentials Plugin — `withCredentials { ... }` 块内注入，自动遮蔽
- CircleCI: Contexts + Project variables — 支持 masked variables

**Orion 现状：**
- `PluginExecutorService.buildCleanEnvironment()` 使用 blocklist 过滤含 `SECRET`/`PASSWORD`/`TOKEN`/`KEY` 的变量
- 无 secret 引用语法（如 `${secrets.DEPLOY_KEY}`）
- `appendTaskLog` 直接记录 task parameters，无 secret 遮蔽
- 无与 Vault/Secrets Manager 的集成

**影响：**
1. Pipeline 无法安全获取 API key、部署凭据、数据库密码
2. 即使通过其他方式传入 secret，也会在日志和审计中明文暴露

**复杂度：** 中（需要 secret store + 引用语法 + 日志遮蔽）

---

#### GAP-08: Workspace 隔离缺失

**业界标准：**
- GitHub Actions: 每 job 独立 workspace（`${{ github.workspace }}`），通过 `actions/checkout` 初始化
- Tekton: Workspaces — PVC 级别的隔离，可共享也可隔离
- GitLab CI: 每 job 独立 build dir，通过 `artifacts` 传递文件
- Argo: `artifact` — 每个 step 独立挂载

**Orion 现状：** 所有 task 默认共享 `/tmp` 目录。并行运行的不同租户的 pipeline 可以互相读写文件。

**影响：** 跨租户数据泄露、文件覆盖攻击、symlink 攻击。

**复杂度：** 低（`mkdtemp()` 创建 per-run workspace）

---

### 2.4 可观测性

#### GAP-09: Prometheus/OpenTelemetry 指标导出缺失

**业界标准：**
- GitLab CI: 内置 Prometheus metrics（`ci_runs_total`, `ci_duration_seconds` 等）
- Tekton: OpenTelemetry tracing + Prometheus metrics（`pipeline_run_duration_seconds`, `task_run_status` 等）
- Argo: Prometheus endpoint（`workflow_completion_latency`, `workflow_total` 等）
- CircleCI: Insights API — 按项目/分支的构建时间趋势、失败率分析

**Orion 现状：** `PipelineMetricsService` 在内存中聚合指标，`getPrometheusMetrics()` 返回文本格式，但：
- 无 Prometheus HTTP endpoint 暴露
- 无 OpenTelemetry SDK 集成
- 无告警规则配置
- 无 dashboard 数据来源

**影响：** SRE 团队无法设置"流水线失败率 > 10% 告警"、"构建时间超过阈值告警"等。

**复杂度：** 低（注册 Prometheus endpoint + 暴露 metrics）

---

#### GAP-10: 外部通知 Webhook 缺失

**业界标准：**
- GitHub Actions: Status API + repository dispatch — 自动通知 GitHub commit status
- GitLab CI: Webhooks（push pipeline events to external URLs）+ Slack/Jira integrations
- Tekton: Triggers + EventListener — 将 pipeline 事件推送到外部系统
- Jenkins: Post-build actions（Email、Slack、HTTP notification）
- CircleCI: Webhooks + Slack + GitHub Status

**Orion 现状：** `PipelineEventPublisher` 仅发布到内部 EventBus，无 outgoing webhook 机制。

**影响：** 无法在 pipeline 完成/失败时通知 Slack、更新 GitHub commit status、触发下游系统。

**复杂度：** 低（添加 outgoing webhook delivery service）

---

### 2.5 集成能力

#### GAP-11: Trigger 持久化缺失

**业界标准：**
- 所有对比系统均将 trigger/webhook 配置持久化到数据库

**Orion 现状：** `PipelineTriggerService.triggers = Map<string, Trigger>()` + `executionHistory = Map<string, TriggerExecutionRecord[]>()`。重启丢失所有触发器和执行历史。

**复杂度：** 中（TriggerRepository + 启动恢复）

---

#### GAP-12: EventBus NATS 集成未完成

**业界标准：**
- 事件驱动架构是现代 CI/CD 的基础

**Orion 现状：** `EventBusAdapter` 检查 `isJetStreamAvailable()`，不可用时返回 `deliveryMode: 'disabled'`，事件静默丢弃。

**复杂度：** 中（NATS JetStream 配置 + 可靠投递）

---

### 2.6 国内大厂特色能力差距（Orion 独有缺失）

#### GAP-CN-01: 可视化 DAG 编排器

**国内平台标准：**
- 阿里云效：拖拽式流水线编排，节点连线可视化，支持并行分支、条件分支、人工卡点
- 腾讯云 CODING：可视化流水线设计器，节点拖拽、连线、配置面板
- 华为云 DevCloud：可视化流水线编排，支持阶段拖拽、并行配置、审批节点插入
- 火山引擎：流水线可视化设计器，节点编排 + 属性配置

**Orion 现状：** 仅支持 YAML 文本编辑，无可视化编排界面。

**影响：** 国内企业用户已习惯可视化编排，纯 YAML 方式学习曲线陡峭，产品竞争力下降。

**复杂度：** 高（需要前端 DAG 可视化组件 + 后端 YAML↔JSON 转换 API）

---

#### GAP-CN-02: 多环境管理与部署策略

**国内平台标准：**
- 阿里云效：环境管理（开发/测试/预发/生产），同一流水线可配置多环境部署参数
- 腾讯云 CODING：环境分组管理，支持环境级变量隔离
- 华为云 DevCloud：环境隔离策略，不同环境使用不同资源池和审批流

**Orion 现状：** 无环境概念，每次运行独立执行，无环境级配置管理。

**影响：** 无法实现"同一套流水线，不同环境不同部署策略"的企业级需求。

**复杂度：** 中（环境实体 + 环境变量 + 环境级审批策略）

---

#### GAP-CN-03: 灰度/金丝雀/蓝绿发布

**国内平台标准：**
- 阿里云效：内置金丝雀发布（10% → 50% → 100%）、蓝绿发布、滚动发布
- 腾讯云 CODING：灰度发布策略，支持按流量比例控制
- 华为云 DevCloud：灰度策略配置，支持自定义发布比例和验证步骤

**Orion 现状：** 无渐进式发布能力，仅支持一次性部署。

**影响：** 生产环境部署风险高，无法实现灰度验证和快速回滚。

**复杂度：** 高（需要部署策略引擎 + 流量控制 + 健康检查集成）

---

#### GAP-CN-04: 代码质量门禁与安全扫描集成

**国内平台标准：**
- 阿里云效：集成代码扫描（SonarQube）、安全检测（SAST/DAST）、质量门禁（覆盖率阈值阻断）
- 腾讯云 CODING：内置代码检查、安全扫描、制品安全检测
- 华为云 DevCloud：代码检查服务、安全服务、质量门禁配置

**Orion 现状：** 无代码质量集成点，无安全扫描插件，无质量门禁机制。

**影响：** 安全左移无法实现，代码质量和安全漏洞无法在流水线中自动拦截。

**复杂度：** 中（需要质量扫描插件 + 门禁规则引擎 + 阻断机制）

---

#### GAP-CN-05: 国内 IM 通知集成（钉钉/企微/飞书）

**国内平台标准：**
- 阿里云效：钉钉机器人通知、企微 Webhook、飞书 Webhook
- 腾讯云 CODING：企微机器人、邮件通知
- 华为云 DevCloud：钉钉通知、邮件通知

**Orion 现状：** 无任何外部通知机制，仅支持 SSE 实时日志流。

**影响：** 国内团队依赖钉钉/企微/飞书进行日常沟通，流水线状态无法触达团队成员。

**复杂度：** 低（添加 Webhook 发送器 + IM 适配器）

---

#### GAP-CN-06: 制品版本管理与溯源

**国内平台标准：**
- 阿里云效：构建物版本化管理，支持从部署包追溯到代码提交
- 腾讯云 CODING：制品库（Docker/Maven/npm），版本管理和发布追溯
- 华为云 DevCloud：发布包管理，完整追溯链（代码 → 构建 → 部署）

**Orion 现状：** `ArtifactService` 仅存储文件，无版本化管理，无溯源能力。

**影响：** 无法回答"当前生产环境是哪个构建版本"、"这个版本包含了哪些代码提交"等问题。

**复杂度：** 中（制品元数据模型 + 溯源链构建 + 版本索引）

---

#### GAP-CN-07: 构建资源池管理

**国内平台标准：**
- 阿里云效：多 Runner 管理，支持自建 Runner、共享 Runner 池、Runner 标签路由
- 腾讯云 CODING：构建集群管理，支持多节点、资源隔离
- 华为云 DevCloud：资源池管理，支持专属资源、共享资源、标签匹配

**Orion 现状：** 所有任务在本地执行，无远程 Runner/Agent 机制，无资源调度。

**影响：** 无法水平扩展构建能力，无法实现"Linux 构建节点"、"Windows 构建节点"等场景。

**复杂度：** 高（需要 Runner Agent + 任务分发协议 + 资源调度器）

---

## 3. 能力差距优先级排序

### 3.1 按影响面排序

| 优先级 | 差距 | 影响 | 复杂度 | 工作量估算 |
|--------|------|------|--------|-----------|
| **P0** | GAP-05 执行状态持久化 | 进程重启丢失所有运行中 pipeline | 高 | 2-3 周 |
| **P0** | GAP-07 Secrets 管理 | 无法安全获取凭据，日志泄露 | 中 | 1-2 周 |
| **P0** | GAP-01 条件表达式引擎 | 无法实现复杂条件分支 | 低 | 2-3 天 |
| **P0** | GAP-08 Workspace 隔离 | 跨租户数据泄露风险 | 低 | 1-2 天 |
| **P0** | GAP-CN-05 IM 通知集成 | 流水线状态无法触达团队 | 低 | 2-3 天 |
| **P1** | GAP-02 Matrix 构建 | YAML 膨胀 5-10 倍 | 中 | 1 周 |
| **P1** | GAP-03 可复用工作流 | 无法构建组织级 CI 库 | 高 | 2-3 周 |
| **P1** | GAP-04 变量传播 | 无法传递构建产物元数据 | 中 | 3-5 天 |
| **P1** | GAP-06 从 Stage 重跑 | 失败后需全量重跑 | 中 | 3-5 天 |
| **P1** | GAP-09 Prometheus 导出 | 无可观测性，无法告警 | 低 | 2-3 天 |
| **P1** | GAP-10 外部通知 | 无法集成 Slack 等 | 低 | 2-3 天 |
| **P1** | GAP-11 Trigger 持久化 | 重启丢失触发器 | 中 | 3-5 天 |
| **P1** | GAP-CN-02 多环境管理 | 无法适配多环境部署 | 中 | 1 周 |
| **P1** | GAP-CN-06 制品溯源 | 无法追溯构建版本 | 中 | 1 周 |
| **P2** | GAP-12 EventBus NATS | 事件可能静默丢弃 | 中 | 1 周 |
| **P2** | GAP-CN-01 可视化编排 | 用户体验差，学习曲线陡 | 高 | 2-3 周 |
| **P2** | GAP-CN-03 灰度/蓝绿发布 | 生产部署风险高 | 高 | 2-4 周 |
| **P2** | GAP-CN-04 质量门禁 | 安全左移无法实现 | 中 | 1-2 周 |
| **P2** | GAP-CN-07 资源池管理 | 无法水平扩展构建 | 高 | 3-4 周 |

### 3.2 实施路线图建议

**Phase 1（1-2 周）: 安全与基础能力**
- GAP-01: 条件表达式引擎增强（最低 ROI 最高）
- GAP-08: Workspace 隔离（最低工作量，最高安全 ROI）
- GAP-07: Secrets 管理（最基础的安全需求）
- GAP-CN-05: IM 通知集成（钉钉/企微/飞书，国内刚需）

**Phase 2（2-3 周）: 可靠性与可观测性**
- GAP-05: 执行状态持久化 + startup recovery
- GAP-09: Prometheus 指标导出
- GAP-10: 外部通知 Webhook
- GAP-11: Trigger 持久化
- GAP-CN-02: 多环境管理
- GAP-CN-06: 制品版本溯源

**Phase 3（2-4 周）: 高级编排能力**
- GAP-02: Matrix 构建
- GAP-04: 变量传播
- GAP-06: 从 Stage 重跑
- GAP-CN-04: 代码质量门禁

**Phase 4（3-4 周）: 企业级能力**
- GAP-03: 可复用工作流 / Pipeline 组合
- GAP-12: EventBus NATS 完整集成
- GAP-CN-01: 可视化 DAG 编排器
- GAP-CN-03: 灰度/蓝绿发布策略

**Phase 5（4-6 周）: 基础设施扩展**
- GAP-CN-07: 构建资源池管理（Runner Agent + 调度器）

---

## 4. 与业界标杆的详细能力对比

### 4.1 条件表达式能力对比

| 能力 | GitHub Actions | GitLab CI | **Orion** |
|------|---------------|-----------|-----------|
| `==` 字符串相等 | ✅ | ✅ | ✅ |
| `!=` 不等 | ✅ | ✅ | ⚠️ 部分 |
| `&&` / `\|\|` 逻辑 | ✅ | ✅ | **缺失** |
| `!` 取反 | ✅ | ✅ | **缺失** |
| `contains()` | ✅ | ✅ | **缺失** |
| `startsWith()` / `endsWith()` | ✅ | ❌ | **缺失** |
| `success()` / `failure()` / `cancelled()` | ✅ | ✅（`when`） | **缺失** |
| `always()` | ✅ | ❌ | **缺失** |
| 文件变更检测 `changed-files` | ✅（action） | ✅（`changes`） | **缺失** |
| 正则匹配 | ❌ | ✅（`=~`） | **缺失** |

### 4.2 并行与扩展能力对比

| 能力 | GitHub Actions | GitLab CI | Tekton | **Orion** |
|------|---------------|-----------|--------|-----------|
| 独立 job 并行 | ✅ | ✅ | ✅ | ✅（Promise.allSettled） |
| Matrix 展开 | ✅ | ✅ | ❌ | **缺失** |
| 动态并行（运行时决定数量） | ❌ | ✅（`foreach`） | ✅（`withItems`） | **缺失** |
| Fan-out/Fan-in | ✅（`needs`） | ✅（`needs`） | ✅（DAG） | ✅（`dependsOn`） |
| 子流程调用 | ✅（`uses`） | ✅（`include`） | ✅（Task 引用） | **缺失** |

### 4.3 数据流能力对比

| 能力 | GitHub Actions | GitLab CI | Tekton | **Orion** |
|------|---------------|-----------|--------|-----------|
| Artifact 上传/下载 | ✅ | ✅ | ✅（Workspaces） | ✅（ArtifactService） |
| Task 输出变量 | ✅（`outputs`） | ✅（`dotenv`） | ✅（`results`） | **缺失** |
| Pipeline 级变量 | ✅（`env`） | ✅（`variables`） | ✅（`params`） | **缺失** |
| Stage 级变量 | ❌ | ✅ | ✅ | **缺失** |
| 缓存机制 | ✅（`actions/cache`） | ✅（`cache`） | ❌ | ⚠️ 部分（stage cache） |

---

## 5. 核心差距根因分析

### 5.1 架构层面的差距

| 根因 | 说明 |
|------|------|
| **YAML spec 设计不完整** | `PipelineStage` 缺少 `matrix`、`strategy`、`env`、`outputs` 等关键字段 |
| **执行引擎硬编码** | `evaluateCondition()` 使用简单正则而非表达式解析器，扩展性差 |
| **状态管理 Map-only** | 执行状态完全在内存中，无持久化 checkpoint |
| **数据流单向断裂** | Task result 存储后未暴露到 pipeline context，下游无法引用 |
| **安全设计缺失** | 无 secret 概念，仅用 blocklist 阻止特定环境变量名 |

### 5.2 与业界设计的根本差异

| 维度 | 业界设计 | Orion 设计 | 差距 |
|------|---------|-----------|------|
| **编排模型** | DAG + 动态展开 | 静态 DAG | 缺少运行时展开能力 |
| **数据流模型** | 显式 outputs/inputs | 隐式文件系统 | 缺少结构化数据传递 |
| **安全模型** | Secret 引用 + 自动遮蔽 | 环境变量 blocklist | 缺乏正向安全机制 |
| **持久化模型** | CRD/DB 存储执行状态 | Map 内存存储 | 缺乏故障恢复能力 |
| **事件模型** | Webhook + Pub/Sub | 内部 EventBus 仅 | 缺少外部事件集成 |

---

## 6. 建议的技术方案方向

### 6.1 条件表达式引擎

**推荐方案**: 集成受限表达式求值器（如 `expr-eval` 或自研 AST 解析器）

```yaml
# 目标语法
stages:
  - name: deploy-prod
    if: github.ref == 'refs/heads/main' && success() && contains(changedFiles, 'Dockerfile')
```

**安全要求:**
- 禁止 `Function`、`eval`、`require` 等 JS 内置函数
- 仅允许白名单操作符和函数
- 超时保护（表达式求值 < 10ms）

### 6.2 Secrets 管理

**推荐方案**: 三层设计

```yaml
# 1. Secret 引用语法
tasks:
  - uses: shell@v1
    with:
      script: echo $DEPLOY_KEY
    env:
      DEPLOY_KEY: ${secrets.deploy_key}

# 2. 日志遮蔽
# appendTaskLog 中自动替换 secret 值为 ***

# 3. 后端存储
# PostgreSQL encrypted column 或 HashiCorp Vault 集成
```

### 6.3 执行状态持久化

**推荐方案**: 定期 checkpoint + startup recovery

```typescript
// 关键状态变更时写入 PostgreSQL
// - stage 状态变更（PENDING → RUNNING → SUCCESS/FAILED）
// - task 完成时
// 启动时扫描 RUNNING 状态的 pipeline，根据 checkpoint 恢复
```

### 6.4 Workspace 隔离

**推荐方案**: 每 run 创建独立 workspace

```typescript
// 替代 /tmp
const workspaceRoot = `/tmp/orion-workspaces/${runId}/`;
// 每 task 子目录
const taskWorkspace = `${workspaceRoot}/${taskId}/`;
// run 完成后清理
```

---

## 7. 总结

### 7.1 国际平台对比总结

Orion Pipeline Engine 已具备基础 CI/CD 能力（YAML 定义、DAG 编排、并行执行、审批网关、Artifact 传递、SCM Webhook、RBAC、租户隔离），但在以下方面与 GitHub Actions/GitLab CI/Tekton 等国际标准存在显著差距：

1. **编排灵活性** — 缺少 Matrix、可复用工作流、动态并行
2. **数据流完整性** — 缺少变量传播、Task 输出、Pipeline 级变量
3. **执行可靠性** — 内存状态、无 crash recovery、无法从 Stage 重跑
4. **安全机制** — 无 Secrets 管理、Workspace 隔离缺失、条件表达式默认放行
5. **可观测性** — 无 Prometheus 导出、无外部通知 Webhook

### 7.2 国内平台对比总结

对比阿里云效、腾讯云 CODING、华为云 DevCloud、火山引擎等国内主流平台，Orion 额外缺失以下**国内企业刚需能力**：

1. **可视化 DAG 编排** — 国内平台标配，拖拽式流水线设计器
2. **多环境管理** — 同一流水线适配开发/测试/预发/生产多环境
3. **灰度/蓝绿发布** — 渐进式发布策略，降低生产部署风险
4. **代码质量门禁** — SAST/DAST 集成、覆盖率阈值阻断
5. **IM 通知集成** — 钉钉/企微/飞书通知是国内团队协作基础
6. **制品版本溯源** — 从部署追溯到代码提交的完整链路
7. **构建资源池** — Runner Agent + 任务分发，水平扩展构建能力

### 7.3 能力差距全景图

| 类别 | 差距数量 | 核心项目 |
|------|---------|---------|
| **国际通用差距** | 12 项 | 条件引擎、Matrix、Secrets、持久化、变量传播 |
| **国内特色差距** | 7 项 | 可视化编排、多环境、灰度发布、IM 通知、资源池 |
| **合计** | **19 项** | |

### 7.4 投入建议

**短期（1-2 周）优先投入:**
- 条件表达式引擎增强（2-3 天，ROI 最高）
- Workspace 隔离（1-2 天，安全 ROI 最高）
- Secrets 管理（1-2 周，安全基础）
- IM 通知集成（2-3 天，国内刚需）

**中期（2-4 周）重点突破:**
- 执行状态持久化（2-3 周，可靠性基础）
- Matrix 构建（1 周，编排灵活性）
- 多环境管理（1 周，企业级能力）
- 制品溯源（1 周，DevOps 追溯链）

**长期（4-8 周）战略投入:**
- 可视化 DAG 编排器（2-3 周，用户体验）
- 灰度/蓝绿发布（2-4 周，生产安全）
- 构建资源池（3-4 周，水平扩展）
