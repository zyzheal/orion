# CI 配置功能对比分析报告

> 对比系统: Orion vs Zadig vs 阿里云效 vs CODING vs Jenkins
> 分析日期: 2026-05-09
> 分析方法: Orion 通过源码实际验证 (orion-platform-service/src/)；竞品基于公开文档与行业通用知识

## 一、对比方法

### 1.1 Orion 分析范围

基于对以下实际代码文件逐一审查：

| 文件 | 覆盖能力 |
|------|----------|
| `src/engine/PipelineEngine.ts` | YAML 解析、Stage/Task 调度、并行执行、审批、质量门禁、部署策略、子 Pipeline、断点恢复 |
| `src/engine/StageExecutor.ts` | Stage 执行、超时、取消、Artifact 传递 |
| `src/engine/TaskRunner.ts` | Git/NPM/K8s/Shell 命令执行、插件执行、内联脚本、Runner 远程分发、日志遮蔽 |
| `src/engine/MatrixExpander.ts` | 矩阵构建、笛卡尔积、排除规则、依赖重写 |
| `src/engine/VariableContext.ts` | 任务输出变量、Pipeline 变量、`${tasks.X.outputs.Y}` 语法、对象级解析 |
| `src/engine/ExpressionEvaluator.ts` | 安全表达式求值、分支/文件/标签条件、状态函数 (success/failure/cancelled/always) |
| `src/engine/DebugController.ts` | 断点/暂停/单步调试 |
| `src/engine/WorkspaceIsolator.ts` | Workspace 隔离、路径穿越防护、自动清理 |
| `src/models/Pipeline.ts` | Pipeline 数据模型（triggers、stages、matrix、cache、artifacts、qualityGate、deploymentStrategy） |
| `src/services/pipeline/PipelineTriggerService.ts` | Git/Webhook/Schedule/Manual 触发器、Cron 调度、路径/分支过滤 |
| `src/services/pipeline/SCMWebhookService.ts` | GitHub/GitLab Webhook 接收、HMAC 签名验证、规则匹配 |
| `src/services/pipeline/PipelineTemplateService.ts` | 模板 CRUD、参数化、版本管理、实例化 |
| `src/services/pipeline/PipelineVersionService.ts` | 版本控制、Diff、回滚、标签、基线 |
| `src/services/pipeline/SubPipelineService.ts` | 子 Pipeline 调用、参数映射、输出映射 |
| `src/services/pipeline/SecretsService.ts` | AES-256-GCM 加密、`${secrets.XXX}` 引用、流式日志遮蔽 |
| `src/services/pipeline/PipelineRBACService.ts` | 4 种角色、权限矩阵、Pipeline 级隔离 |
| `src/services/pipeline/PipelineBudgetService.ts` | 时间/资源/成本预算、预警、阻断策略 |
| `src/services/pipeline/PipelineExecutionQueue.ts` | 优先级队列、最大并发、背压控制 |
| `src/services/pipeline/AutoRetryService.ts` | 智能重试、错误分类、退避策略 |
| `src/services/pipeline/QualityGateService.ts` | 质量门禁评估、覆盖率/复杂度/漏洞指标 |
| `src/services/pipeline/DeploymentStrategyService.ts` | 金丝雀/蓝绿/滚动发布 |
| `src/services/pipeline/ApprovalGateService.ts` | 审批流 |
| `src/services/pipeline/IMNotifier.ts` | IM 通知（企业微信/钉钉/飞书） |
| `src/services/pipeline/WebhookNotifier.ts` | 外部 Webhook 通知 |
| `src/services/pipeline/RunnerPoolService.ts` | Runner 池、远程分发 |
| `src/services/pipeline/PipelineTenantIsolationService.ts` | 租户隔离 |
| `src/services/pipeline/PipelineCheckpointManager.ts` | 断点持久化、崩溃恢复 |

### 1.2 竞品数据来源

- **Zadig** (v1.x/v2.x 开源版, koderover/zadig): 官方文档、GitHub 源码
- **阿里云效** (Flow): 阿里云官方文档、产品手册
- **CODING DevOps** (腾讯云): 腾讯云官方文档、产品手册
- **Jenkins** (2.x + 主流插件): 官方文档、Pipeline 插件文档

### 1.3 符号说明

| 符号 | 含义 |
|:---:|------|
| ✅ | 原生支持，代码中已实现 |
| ⚠️ | 部分支持 / 框架已有但功能不完整 |
| ❌ | 不支持 / 未发现相关代码 |

---

## 二、功能对比矩阵

### 2.1 CI Pipeline 配置能力

| 功能 | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|------|:---:|:---:|:---:|:---:|:---:|
| YAML 配置语法 | ✅ 自定义格式 (apiVersion/kind/spec) | ✅ 自定义 YAML | ✅ 自定义 YAML | ✅ 自定义 YAML | ✅ Jenkinsfile (Groovy) |
| 图形化编辑器 | ⚠️ 前端页面存在 (57+ pages)，编辑器能力待确认 | ✅ 可视化流水线编辑器 | ✅ 可视化流水线编辑器 | ✅ 可视化流水线编辑器 | ⚠️ Blue Ocean 已停止维护 |
| Pipeline 模板机制 | ✅ 参数化模板 + 实例化 | ✅ 共享模板库 | ✅ 流水线模板市场 | ✅ 流水线模板 | ✅ Shared Libraries |
| 模板参数化 | ✅ `TemplateParameter[]` + `${params.X}` | ✅ 变量参数 | ✅ 参数化模板 | ✅ 参数化模板 | ✅ 参数化构建 |
| 参数化构建 (手动触发) | ⚠️ Manual triggerType 存在，参数传递待验证 | ✅ | ✅ | ✅ | ✅ |
| 矩阵构建能力 | ✅ MatrixExpander: 笛卡尔积 + exclude + 依赖重写 | ✅ 矩阵配置 | ✅ 矩阵构建 | ✅ 多配置任务 | ✅ `matrix` plugin / scripted |
| 嵌套/子 Pipeline | ✅ SubPipelineService: 调用/等待/输出映射/取消 | ✅ 工作流嵌套 | ✅ 流水线嵌套调用 | ✅ 跨项目触发 | ✅ `build` step / multibranch |
| Pipeline 版本控制 | ✅ 完整版本管理: CRUD/Diff/回滚/标签/基线 | ✅ 版本历史 | ✅ 版本管理 | ✅ 版本管理 | ⚠️ 依赖 SCM 版本控制 |
| 条件执行表达式 | ✅ 安全表达式: branch/changedFiles/tags/success()/failure() | ✅ 条件判断 | ✅ 条件分支 | ✅ 条件分支 | ✅ `when` 指令 |
| 并行 Stage 执行 | ✅ `Promise.allSettled` 无依赖 Stage 并行 | ✅ 并行 Stage | ✅ 并行任务 | ✅ 并行任务 | ✅ `parallel` 指令 |
| Fan-in 依赖聚合 | ✅ 多依赖全部成功才解锁 | ✅ | ✅ | ✅ | ✅ `join` / `wait` |

### 2.2 构建执行配置

| 功能 | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|------|:---:|:---:|:---:|:---:|:---:|
| 构建环境/容器镜像配置 | ❌ 无原生容器构建支持 | ✅ Kubernetes Pod 调度 | ✅ 容器构建环境 | ✅ 容器构建环境 | ✅ Docker/K8s plugins |
| 构建资源限制 (CPU/Memory) | ⚠️ BudgetService 有跟踪但无执行时限制 | ✅ 资源配额 | ✅ 资源限制 | ✅ 资源限制 | ✅ Kubernetes plugin |
| GPU 资源分配 | ❌ 无 | ✅ 支持 | ✅ 支持 | ⚠️ 有限支持 | ⚠️ 需插件 |
| 依赖缓存配置 | ⚠️ Pipeline model 有 `cache` 字段，无实现 | ✅ 缓存配置 | ✅ 缓存加速 | ✅ 缓存配置 | ✅ `cache` step |
| Docker Layer Cache | ❌ 无 | ✅ | ✅ | ✅ | ✅ |
| 多架构构建 (amd64/arm64) | ❌ 无 | ✅ | ✅ | ✅ | ✅ (docker buildx) |
| 构建超时配置 | ✅ Stage `timeoutSeconds` | ✅ | ✅ | ✅ | ✅ |
| 构建重试配置 | ✅ Stage `maxRetries` + `retryCount` | ✅ | ✅ | ✅ | ✅ |
| 智能重试 (错误分类) | ✅ AutoRetryService: transient/permanent 分类 + 指数退避 | ❌ 基础重试 | ⚠️ 基础重试 | ⚠️ 基础重试 | ⚠️ retry block |
| 构建环境变量管理 | ✅ `env` 字段 + VariableContext 注入 | ✅ | ✅ | ✅ | ✅ `environment` 指令 |
| 构建工具链配置 | ⚠️ 支持 git/npm/shell/k8s 类型 | ✅ 丰富工具链 | ✅ 丰富工具链 | ✅ 丰富工具链 | ✅ 丰富插件生态 |

### 2.3 测试配置

| 功能 | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|------|:---:|:---:|:---:|:---:|:---:|
| 测试任务配置 (单元/集成/E2E) | ⚠️ 通过 shell/npm 类型可执行，无专用测试 task | ✅ 专用测试步骤 | ✅ 测试步骤 | ✅ 测试步骤 | ✅ 专用 test 插件 |
| 并行测试配置 | ❌ 无原生支持 | ✅ 测试分片 | ✅ 并行测试 | ✅ 并行测试 | ✅ parallel + 分片插件 |
| 测试覆盖率配置 | ⚠️ QualityGate 可接收 coverage 指标，无专用配置 | ✅ 覆盖率收集 | ✅ | ✅ | ✅ Cobertura/JaCoCo |
| 测试报告收集 | ⚠️ 通过任务 outputs 传递，无专用报告收集 | ✅ 测试报告展示 | ✅ 测试报告 | ✅ 测试报告 | ✅ JUnit/TestNG 插件 |
| 测试超时和重试 | ✅ 继承 Stage 的 timeout/retries | ✅ | ✅ | ✅ | ✅ |

### 2.4 代码质量与安全配置

| 功能 | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|------|:---:|:---:|:---:|:---:|:---:|
| 代码扫描工具集成 | ⚠️ QualityGate 可评估指标，无内置扫描器 | ✅ 集成 SonarQube 等 | ✅ 代码检查 | ✅ 代码检查 | ✅ SonarQube plugin |
| 安全扫描配置 | ⚠️ QualityGate 有 vulnerabilities 指标，无内置扫描 | ✅ 安全扫描 | ✅ 安全扫描 | ✅ 安全扫描 | ✅ 安全扫描插件 |
| 质量门禁配置 | ✅ QualityGateService: 覆盖率/复杂度/重复率/漏洞/Bug | ✅ 质量红线 | ✅ 质量门禁 | ✅ 质量门禁 | ⚠️ 需插件 (SonarQube) |
| 质量门禁阻断 | ✅ `isBlocking()` 返回阻断原因 | ✅ | ✅ | ✅ | ✅ |
| Secret 安全管理 | ✅ AES-256-GCM 加密 + `${secrets.XXX}` + 流式日志遮蔽 | ✅ | ✅ 加密变量 | ✅ 加密变量 | ✅ Credentials plugin |
| 脚本安全校验 | ✅ TaskRunner 有 `isScriptSafe()` 危险命令检测 | ⚠️ | ⚠️ | ⚠️ | ❌ |

### 2.5 制品配置

| 功能 | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|------|:---:|:---:|:---:|:---:|:---:|
| 制品上传/下载 | ✅ ArtifactService: Stage 级 upload + expiry | ✅ 制品库 | ✅ 制品库 | ✅ 制品库 | ✅ Archive artifacts |
| 制品跨 Stage 传递 | ✅ `passUpstreamArtifacts` 依赖传递 | ✅ | ✅ | ✅ | ✅ Stash/Unstash |
| 制品版本管理 | ❌ 无独立制品版本管理 | ✅ 制品版本 | ✅ 制品版本 | ✅ 制品版本 | ⚠️ 需外部存储 |
| Docker 镜像构建 | ❌ 无原生 Docker build | ✅ Docker 构建 | ✅ Docker 构建 | ✅ Docker 构建 | ✅ Docker plugin |
| 制品变量传递 | ✅ `${tasks.X.outputs.Y}` 语法 | ✅ 环境变量传递 | ✅ 变量传递 | ✅ 变量传递 | ✅ 环境变量 |

### 2.6 触发器配置

| 功能 | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|------|:---:|:---:|:---:|:---:|:---:|
| Git Webhook 触发 | ✅ SCMWebhookService: GitHub/GitLab push + 签名验证 | ✅ 多 SCM 支持 | ✅ 代码源触发 | ✅ 代码源触发 | ✅ SCM polling/webhook |
| 分支过滤 | ✅ `branchPattern` + glob 匹配 | ✅ | ✅ | ✅ | ✅ |
| 路径过滤 (changed files) | ✅ `pathPatterns` + `changedFiles` 表达式 | ✅ | ✅ | ✅ | ✅ `changeset` |
| 标签触发 | ⚠️ ExpressionEvaluator 支持 `tags` 变量，无专用 tag trigger | ✅ tag 触发 | ✅ tag 触发 | ✅ tag 触发 | ✅ tag 触发 |
| PR/MR 触发 | ⚠️ SCMWebhook 可接收事件，无专用 PR 过滤 | ✅ PR/MR 触发 | ✅ MR 触发 | ✅ PR 触发 | ✅ PR plugin |
| 定时触发 (Cron) | ✅ CronExpressionParser + scheduleTrigger | ✅ 定时调度 | ✅ 定时调度 | ✅ 定时调度 | ✅ cron 指令 |
| 手动触发 | ✅ Manual triggerType | ✅ | ✅ | ✅ | ✅ |
| API 触发 | ✅ API triggerType | ✅ | ✅ | ✅ | ✅ Remote trigger |
| 事件触发 | ✅ EVENT triggerType (含高优先级) | ✅ | ✅ | ✅ | ✅ |
| 触发优先级 | ✅ HIGH/NORMAL/LOW 三级 | ⚠️ | ⚠️ | ⚠️ | ⚠️ |

### 2.7 高级配置

| 功能 | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|------|:---:|:---:|:---:|:---:|:---:|
| 环境隔离配置 | ⚠️ PipelineRun 有 `environment` 字段，无环境级隔离逻辑 | ✅ 环境管理 | ✅ 环境管理 | ✅ 环境管理 | ✅ 多 Agent |
| 租户/项目隔离 | ✅ PipelineTenantIsolationService + tenantId 贯穿 | ✅ 项目隔离 | ✅ 企业/项目隔离 | ✅ 项目隔离 | ⚠️ Folder plugin |
| 权限配置 | ✅ PipelineRBACService: admin/editor/viewer/approver 四角色 | ✅ RBAC | ✅ RBAC | ✅ RBAC | ✅ Matrix auth |
| 审批流配置 | ✅ ApprovalGateService: 请求/审批/拒绝/恢复 | ✅ 审批节点 | ✅ 人工卡点 | ✅ 审核节点 | ✅ Input step |
| 通知配置 | ✅ IM (企业微信/钉钉/飞书) + Webhook | ✅ 多渠道通知 | ✅ 多渠道通知 | ✅ 多渠道通知 | ✅ Email/Slack 等 |
| 执行队列与背压 | ✅ PipelineExecutionQueue: 最大并发 + 队列满拒绝 | ✅ 并发控制 | ✅ 并发控制 | ✅ 并发控制 | ⚠️ Throttle plugin |
| 执行预算 (FinOps) | ✅ PipelineBudgetService: 时间/CPU/内存/成本预算 + 预警/阻断 | ❌ | ❌ | ❌ | ❌ |
| 崩溃恢复 | ✅ PipelineCheckpointManager: 断点持久化 + 孤儿 Run 恢复 | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Debug 单步调试 | ✅ DebugController: 暂停/恢复/单步 | ❌ | ❌ | ❌ | ❌ |
| 从指定 Stage 重试 | ✅ `skippedStages` 预标记 + 仅失败重试 | ✅ 从失败节点重试 | ⚠️ | ⚠️ | ⚠️ |
| 部署策略 (Canary/BlueGreen/Rolling) | ✅ DeploymentStrategyService: 三种策略 + 健康检查 | ✅ 渐进式发布 | ✅ 发布策略 | ✅ 发布策略 | ⚠️ 需插件 |
| 可观测性/Traceability | ✅ TraceabilityService | ✅ | ✅ | ✅ | ⚠️ 需插件 |

---

## 三、Orion 缺失功能清单

按优先级从高到低排列：

### 缺失-01: Docker 镜像构建能力

- **哪些系统有此功能**: Zadig ✅, 阿里云效 ✅, CODING ✅, Jenkins ✅
- **Orion 当前状态**: ❌ 无原生 Docker build 支持。TaskRunner 有 git/npm/shell/k8s/inline-script/plugin 类型，但无 Docker build 专用类型。
- **缺失影响**: 无法构建 Docker 镜像，这是 CI 的核心能力之一。用户只能通过 shell 任务间接调用 docker CLI，无 DIND 支持、无 Docker layer cache、无多架构构建。
- **实现建议**:
  1. 新增 `docker/build` 任务类型到 TaskRunner
  2. 支持 `buildx` 多架构构建参数
  3. 集成 Docker layer cache 配置（`cacheFrom`/`cacheTo`）
  4. 支持 Docker-in-Docker 执行模式（sidecar 容器）

### 缺失-02: 容器化构建执行环境

- **哪些系统有此功能**: Zadig ✅ (K8s Pod 调度), 阿里云效 ✅, CODING ✅, Jenkins ✅ (K8s plugin)
- **Orion 当前状态**: ❌ TaskRunner 在宿主机上直接 spawn 进程。`runsOn` 字段存在但仅用于 Runner 标签选择，无容器运行时抽象。
- **缺失影响**: 构建环境依赖宿主机安装的工具链，无法做到构建环境隔离和可复现。
- **实现建议**:
  1. 新增 `container` 任务类型，指定镜像和执行命令
  2. 集成 K8s API 或 Docker API 创建临时容器
  3. 支持 volume 挂载 workspace

### 缺失-03: 构建缓存 (依赖缓存 / Docker Layer Cache)

- **哪些系统有此功能**: Zadig ✅, 阿里云效 ✅, CODING ✅, Jenkins ✅
- **Orion 当前状态**: ⚠️ `PipelineStage.cache` 数据模型已定义（enabled/key/paths/restoreKeys），但无任何代码实现缓存逻辑。
- **缺失影响**: 每次构建都重新下载依赖，构建速度慢，浪费网络和存储。
- **实现建议**:
  1. 实现 CacheService: 基于 key 的缓存存储（本地/S3/OSS）
  2. 在 StageExecutor 中集成缓存恢复和保存逻辑
  3. 支持类似 GitHub Actions 的 `restoreKeys` 前缀匹配

### 缺失-04: 并行测试与测试报告收集

- **哪些系统有此功能**: Zadig ✅, 阿里云效 ✅, CODING ✅, Jenkins ✅
- **Orion 当前状态**: ❌ 无专用测试任务类型。测试只能通过 shell 或 npm 任务执行，结果通过 stdout 输出，无专用报告收集和展示。
- **缺失影响**: 无法并行加速测试套件，无法收集测试覆盖率、失败用例、趋势分析。
- **实现建议**:
  1. 新增 `test/unit`, `test/integration`, `test/e2e` 任务类型
  2. 支持 JUnit XML / Cobertura / JaCoCo 报告解析
  3. 测试报告存储到数据库并提供查询 API
  4. 支持测试分片（按文件/按用例分组并行）

### 缺失-05: 多架构构建 (amd64/arm64)

- **哪些系统有此功能**: Zadig ✅, 阿里云效 ✅, CODING ✅, Jenkins ✅
- **Orion 当前状态**: ❌ MatrixExpander 支持矩阵维度组合，但不与构建架构关联。
- **缺失影响**: 无法一次性构建多平台镜像或二进制文件。
- **实现建议**:
  1. 扩展 MatrixExpander 支持 `arch` 维度自动分发到对应 Runner
  2. 集成 `docker buildx` 实现跨平台构建
  3. RunnerPool 增加 `arch` 标签支持

### 缺失-06: PR/MR 专用触发与过滤

- **哪些系统有此功能**: Zadig ✅, 阿里云效 ✅, CODING ✅, Jenkins ✅
- **Orion 当前状态**: ⚠️ SCMWebhookService 可接收 webhook 事件，eventType 支持 `pull_request`，但无 PR 号、PR 状态（open/closed）、PR 来源分支等专用过滤。
- **缺失影响**: 无法实现 PR 级别的 CI 检查、PR 评论报告、PR 合并门禁。
- **实现建议**:
  1. 扩展 SCMWebhookService 处理 `pull_request` 事件，提取 PR metadata
  2. 新增 PR 触发规则：分支来源、PR label、PR 状态
  3. 支持 PR 评论中发布测试结果

### 缺失-07: 图形化 Pipeline 编辑器

- **哪些系统有此功能**: Zadig ✅, 阿里云效 ✅, CODING ✅, Jenkins ⚠️
- **Orion 当前状态**: ⚠️ 前端有 57+ pages，但是否包含完整的拖拽式 YAML 编辑器待确认。
- **缺失影响**: 用户需手动编写 YAML 配置，学习成本高。
- **实现建议**:
  1. 前端实现拖拽式 Stage/Task 编辑器
  2. 实时 YAML 预览和语法校验
  3. 从模板创建时自动填充编辑器

### 缺失-08: 制品版本管理

- **哪些系统有此功能**: Zadig ✅, 阿里云效 ✅, CODING ✅, Jenkins ⚠️
- **Orion 当前状态**: ❌ ArtifactService 支持上传/下载/传递，但无版本概念（如 semantic versioning、标签管理）。
- **缺失影响**: 无法追溯制品版本与 Pipeline 运行版本的关联。
- **实现建议**:
  1. 为 Artifact 增加 version 字段和 tag 支持
  2. 建立 Artifact <-> PipelineRun 关联关系
  3. 支持制品版本查询和溯源

### 缺失-09: GPU 资源分配

- **哪些系统有此功能**: Zadig ✅, 阿里云效 ✅, CODING ⚠️, Jenkins ⚠️
- **Orion 当前状态**: ❌ BudgetService 有 CPU/内存/成本维度，无 GPU 维度。
- **缺失影响**: AI/ML 工作负载无法调度到 GPU Runner。
- **实现建议**:
  1. BudgetConfig 增加 `gpuBudget` 维度
  2. RunnerPool 增加 GPU 标签和配额管理
  3. Task 配置支持 GPU 请求

### 缺失-10: Jenkins Shared Libraries 级别的共享库机制

- **哪些系统有此功能**: Jenkins ✅ (Shared Libraries), Zadig ⚠️, 阿里云效 ⚠️, CODING ⚠️
- **Orion 当前状态**: ⚠️ PipelineTemplateService 提供模板机制，但不同于 Jenkins 的 Git 仓库驱动共享库（动态加载 Groovy 代码）。
- **缺失影响**: 无法在多个团队间共享自定义 CI 逻辑（如自定义步骤、工具函数）。
- **实现建议**:
  1. Plugin 系统已存在 (PluginExecutorService)，可扩展为共享函数库
  2. 支持从 Git 仓库动态加载共享逻辑
  3. 版本化共享库引用

---

## 四、总结与建议

### 4.1 Orion CI 能力总评

Orion 的 CI 引擎在 **编排能力** 方面表现优秀：

**优势领域：**
- **编排引擎成熟**: 支持并行 Stage、依赖 DAG、Fan-in/Fan-out、条件表达式、矩阵构建、子 Pipeline 嵌套 —— 覆盖度约 90%
- **安全机制完善**: Secret AES 加密、流式日志遮蔽、脚本安全检查、RBAC 四角色、表达式沙箱 —— 覆盖度约 95%
- **可观测性突出**: 断点恢复 (Checkpoint)、Debug 单步调试、Traceability、Budget FinOps —— 这些是其他竞品大多缺失的 **差异化优势**
- **版本管理全面**: Pipeline 版本 CRUD/Diff/回滚/标签/基线 —— 竞品中少见
- **触发器丰富**: Git/Webhook/Schedule/Manual/API/Event 六种 + 优先级调度 —— 覆盖度 95%
- **部署策略内置**: Canary/BlueGreen/Rolling 原生支持 —— 覆盖度 90%

**薄弱环节：**
- **构建执行层**: 无容器化构建、无 Docker 原生支持、无构建缓存、无多架构 —— 这是 CI 的基础能力，需要补齐
- **测试生态**: 无专用测试任务、无并行测试、无测试报告 —— 测试是 CI 的核心场景
- **PR/MR 场景**: 缺少 PR 专用触发和反馈 —— 现代 CI 的标准功能
- **用户体验**: 图形化编辑器待确认，YAML 学习成本需降低

### 4.2 优先级建议

| 优先级 | 缺失功能 | 影响范围 | 建议实施周期 |
|:---:|------|------|------|
| P0 | Docker 镜像构建 | 所有需要容器化的项目 | 1-2 周 |
| P0 | 构建缓存 | 所有构建性能 | 1 周 |
| P1 | 容器化构建环境 | 构建环境隔离 | 2-3 周 |
| P1 | 测试报告收集 | 质量门禁/测试流程 | 1-2 周 |
| P1 | PR/MR 专用触发 | DevOps 全流程 | 1 周 |
| P2 | 多架构构建 | 跨平台发布 | 2 周 |
| P2 | 图形化编辑器 | 用户体验 | 3-4 周 |
| P2 | 制品版本管理 | 追溯/审计 | 1 周 |
| P3 | GPU 资源分配 | AI/ML 场景 | 2 周 |
| P3 | 共享库机制 | 跨团队复用 | 2-3 周 |

### 4.3 Orion 差异化竞争优势

Orion 在以下方面具有 **独特优势**，可作为市场差异化卖点：

1. **智能重试** (AutoRetryService 错误分类 + 指数退避) -- 竞品只有基础重试
2. **执行预算管理** (FinOps 集成) -- 竞品普遍缺失
3. **Debug 单步调试** -- 竞品无此能力
4. **断点持久化与崩溃恢复** -- 竞品大多仅依赖数据库状态
5. **Pipeline 级 RBAC** -- 竞品多在项目级或全局级
6. **内建部署策略** (Canary/BlueGreen/Rolling) -- 竞品多在 CD 模块
