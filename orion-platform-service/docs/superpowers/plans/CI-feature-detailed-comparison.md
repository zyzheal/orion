# CI/CD 平台详细功能对比报告

> **对比系统**: Orion vs Zadig vs 阿里云效(CODEUP+FLOW) vs CODING vs Jenkins
> **报告日期**: 2026-05-09
> **研究方法**: Orion 代码审计 + 竞品公开文档研究
> **Orion 代码路径**: `/Users/heal/orion-design/orion-platform-service/src/`

---

## 1. Pipeline Configuration (流水线配置)

### 1.1 Configuration Syntax Comparison

| System | Syntax | Example |
|--------|--------|---------|
| **Orion** | YAML (`apiVersion`, `kind: Pipeline`, `spec.stages`) | `apiVersion: orion.dev/v1` + `kind: Pipeline` + `spec.stages[].name/runsOn/steps[]` |
| **Zadig** | YAML (`apiVersion: v1`, `kind: Workflow`) | `apiVersion: v1` + `kind: Workflow` + `spec.stages[].jobs[]` |
| **阿里云效** | YAML (`version: '1.0'`, `stages`) | `version: '1.0'` + `stages[].jobs[].steps[]` |
| **CODING** | YAML (Jenkinsfile 风格) | Jenkinsfile 语法, `pipeline { stages { ... } }` |
| **Jenkins** | Declarative Pipeline (Groovy DSL) | Groovy DSL, `pipeline { agent any; stages { ... } }` |

**Orion 实际 YAML 示例** (基于 `Pipeline.ts` 模型):
```yaml
apiVersion: orion.dev/v1
kind: Pipeline
metadata:
  name: my-pipeline
  version: "1.0"
spec:
  triggers:
    - type: git
      branches: ["main"]
      pathPatterns: ["src/**"]
  stages:
    - name: build
      runsOn: "linux,node-18"
      timeout: 600
      retries: 2
      if: "branch == 'refs/heads/main'"
      matrix:
        node: ["16", "18", "20"]
        os: ["linux", "macos"]
        exclude:
          - { os: "macos", node: "16" }
      cache:
        enabled: true
        key: "npm-${hash}"
        paths: ["node_modules"]
      steps:
        - name: checkout
          uses: "git/clone@v1"
          with:
            repo: "https://github.com/org/repo"
            branch: "main"
        - name: install
          uses: "npm/install@v1"
          with:
            command: "install"
        - name: build
          uses: "npm/run@v1"
          with:
            command: "run build"
      outputs:
        version: "${tasks.build.outputs.version}"
    - name: test
      dependsOn: ["build"]
      steps:
        - name: test
          uses: "npm/test@v1"
```

### 1.2 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **Parser** | `js-yaml` + custom validator | Custom YAML parser | 平台自定义解析器 | Jenkinsfile parser | Groovy CPS |
| **Validation** | `PipelineValidator.ts` 运行时校验 | 表单+YAML双向校验 | 可视化编辑器+YAML校验 | Jenkinsfile语法检查 | Pipeline Linter |
| **Storage** | PostgreSQL (`pipelines` 表, `yaml_definition` TEXT) | MongoDB | 平台数据库 | 平台数据库 | SCM 存储 (Jenkinsfile) |
| **Execution model** | In-process `PipelineEngine` (Node.js) 内存执行 | Agent + K8s Pod | 云端 Agent + 容器 | 云端构建节点 | Jenkins Master-Executor |
| **Template support** | `PipelineTemplateService.ts` 存在但基于 YAML 存储 | Workflow 模板库 | 流水线模板市场 | Pipeline 模板 | Shared Libraries |
| **Variable scoping** | `VariableContext`: 全局变量 + `${tasks.<name>.outputs.<key>}` 两级 | 构建变量 + 环境变量 | 环境变量 + 全局参数 | 环境变量 + 构建参数 | env 变量 + 自定义变量 |

### 1.3 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | 模板继承/组合未实现; 变量仅支持 string; 无 `include`/`import`; 表达式求值为 expr-eval 子集 | `${tasks.x.outputs.y}` 中 y 含点号时通过 `parts.slice(3).join('.')` 支持; 空条件视为 always run |
| **Zadig** | 复杂逻辑需写脚本; YAML 与 UI 编辑器需同步 | 多环境部署需配置多个 workflow |
| **阿里云效** | YAML 表达能力受限; 复杂条件需插件 | 分支过滤仅支持 glob |
| **CODING** | 基于 Jenkinsfile 语法, 学习曲线陡 | 自定义插件需 Groovy 知识 |
| **Jenkins** | Groovy 沙箱限制 | CPS 序列化问题 |

### 1.4 Orion Code Evidence

- **Pipeline Model**: `/Users/heal/orion-design/orion-platform-service/src/models/Pipeline.ts` lines 1-167 -- 定义 `PipelineStage` 接口含 `matrix`, `cache`, `outputs`, `qualityGate`, `deploymentStrategy`
- **YAML Parser**: `parsePipelineYaml()` lines 144-166 -- 使用 `js-yaml` 解析, 校验 `apiVersion`, `kind`, `metadata`, `spec`
- **Expression Evaluator**: `/Users/heal/orion-design/orion-platform-service/src/engine/ExpressionEvaluator.ts` lines 1-402 -- 基于 `expr-eval`, 支持 `&&`, `||`, `==`, `!=`, `>`, `<`, `startsWith()`, `contains()`, `success()`, `failure()`
- **VariableContext**: `/Users/heal/orion-design/orion-platform-service/src/engine/VariableContext.ts` lines 1-233 -- 支持 `${tasks.<taskName>.outputs.<key>}` 语法
- **Gap vs Zadig**: Orion 缺少 Workflow 模板可视化编辑和模板市场; Zadig 有 stage/job 两级嵌套而 Orion 只有 stage/steps

---

## 2. Build Execution (构建执行)

### 2.1 Configuration Syntax Comparison

| System | Syntax | Example |
|--------|--------|---------|
| **Orion** | `steps[].uses` + `with`; stage 级 `timeout`, `retries` | `uses: "shell/exec@v1"` + `with: { script: "npm run build" }` |
| **Zadig** | `build` job 中 `script`, `dockerfile` 字段 | `build.script: ["docker build -t myimage ."]` |
| **阿里云效** | `step: shell@1` with `script` | `step: shell@1` + `script: \|` |
| **CODING** | `sh` step + `timeout` | `sh 'npm run build'` |
| **Jenkins** | `sh` step + `timeout` + `retry` | `retry(3) { timeout(time: 30) { sh '...' } }` |

### 2.2 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **Execution model** | `child_process.spawn` (本地进程) 或远程 Runner HTTP 分发; K8s Pod (mock) | Docker container / K8s Pod | 云端容器化构建 | 云端构建节点 | Jenkins Agent 进程 |
| **Working dir** | `WorkspaceIsolator`: `/tmp/orion-workspace/{runId}/{taskId}` 或自定义 | 容器内 `/workspace` | 容器内固定路径 | 构建节点工作空间 | Agent workspace |
| **Env injection** | `spawn` 的 `env` 参数; secrets 通过 `SecretsService.resolveTaskSecrets()` 解析后注入 | 构建环境变量 | 平台环境变量面板 | 构建参数面板 | `withEnv` / `environment` |
| **Resource control** | K8s `resources.requests/limits`; 本地执行无资源限制 | CPU/内存限制 (K8s) | Agent 资源分配 | 构建节点配置 | Agent 标签 + 资源限制插件 |
| **Timeout handling** | `setTimeout` + `AbortController`; 超时后终止子进程 | 超时自动终止容器 | 超时终止构建 | 超时终止 | `timeout()` step |
| **Retry** | `AutoRetryService`: 智能错误分类 + 指数退避 (baseDelay * 2^(n-1) + jitter) | 简单重试 | 简单重试 | `retry()` step | `retry()` step |

### 2.3 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | 本地执行无容器隔离; K8sBuildExecutor 仍为 mock; 无原生 DIND 支持; 工作空间为 `/tmp` 目录; 安全过滤仅检测简单模式 | 超时通过 `AbortController` 终止, 但子进程的子进程可能成为孤儿 |
| **Zadig** | 资源限制依赖 K8s 集群 | 多容器构建复杂 |
| **阿里云效** | 资源限制为预设档位 | 自定义 Docker 镜像有限制 |
| **CODING** | 构建节点资源固定 | 并发数受限于套餐 |
| **Jenkins** | Agent 管理复杂 | 容器插件配置繁琐 |

### 2.4 Orion Code Evidence

- **TaskRunner**: `/Users/heal/orion-design/orion-platform-service/src/engine/TaskRunner.ts` lines 1-833 -- 支持 `git/*`, `npm/*`, `shell/*`, `k8s/*`, `plugin/*`, `inline-script/*` 六种 type
- **Spawn**: `spawnCommand()` lines 91-175 -- `child_process.spawn`, 支持 `AbortSignal`, `timeout`, `env`, `StreamSecretSanitizer`
- **StageExecutor timeout**: `/Users/heal/orion-design/orion-platform-service/src/engine/StageExecutor.ts` lines 111-123 -- 超时 `controller.abort()` 终止子进程
- **AutoRetryService**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/AutoRetryService.ts` lines 1-404 -- 三种策略 `immediate`/`backoff`/`skip`
- **RunnerPoolService**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/RunnerPoolService.ts` lines 1-393 -- 远程 Runner 管理
- **K8sBuildExecutor**: `/Users/heal/orion-design/orion-platform-service/src/services/build/K8sBuildExecutor.ts` lines 1-455 -- 当前使用 `MockK8sClient`
- **Gap**: 无原生 DIND/Kaniko; Zadig 内置 Docker 构建步骤; Jenkins 有 Docker Pipeline 插件

---

## 3. Matrix/Parallel Builds (矩阵/并行构建)

### 3.1 Configuration Syntax Comparison

| System | Syntax | Example |
|--------|--------|---------|
| **Orion** | `stage.matrix` 对象 + `exclude` 数组 | `matrix: { node: ["16","18"], os: ["linux","macos"], exclude: [{os:"macos",node:"16"}] }` |
| **Zadig** | 构建参数化 + 多 service 并行 | 无原生 matrix 语法 |
| **阿里云效** | 无原生 matrix | 手动配置多个 job |
| **CODING** | Jenkins `matrix` 语法 | `matrix { axes { axis { name 'PLATFORM'; values 'linux','macos' } } }` |
| **Jenkins** | Declarative `matrix` | 同上 |

### 3.2 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **Cartesian product** | `MatrixExpander.cartesianProduct()` 递归生成 | 无原生支持 | 无 | Jenkins `matrix` 插件 | Jenkins `matrix` 指令 |
| **Exclusion** | `MatrixExpander.isExcluded()` 支持部分匹配 | N/A | N/A | `excludes` 块 | `excludes` 块 |
| **Dependency rewrite** | `expandAll()` 第二阶段重写 `dependsOn`, 自动扩展为依赖所有展开实例 | N/A | N/A | 自动处理 | 自动处理 |
| **Naming** | `"stage-name (key1=value1, key2=value2)"`, keys 按字母排序 | N/A | N/A | 自动生成 | 自动生成 |
| **Max parallelism** | `PipelineExecutionQueue.maxConcurrent` (默认 10); DAG 无依赖 stages 用 `Promise.allSettled` 并行 | K8s 资源限制 | Agent 并发限制 | 构建节点并发 | Executor 数量 |
| **Fan-in** | `doCheckNextStages()` -- 所有依赖必须 SUCCESS 才解锁; 任一失败则 skip | Job 依赖 | Stage 依赖 | Stage 依赖 | `parallel` + `join` |

### 3.3 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | matrix 值仅支持 `string[]` (不支持 range); 展开在内存中完成; 无 `max-parallel` 控制; 矩阵变量通过 `MATRIX_*` env 注入 | 下游 stage 依赖矩阵 stage 时, 依赖所有展开实例 (fan-in), 无法选择依赖部分 |
| **Zadig** | 无原生矩阵构建 | 需手动配置 |
| **阿里云效** | 无矩阵构建 | 需复制 job |
| **CODING** | 矩阵语法复杂 | 排除规则有限 |
| **Jenkins** | 矩阵组合数有限制 | 大型矩阵内存消耗大 |

### 3.4 Orion Code Evidence

- **MatrixExpander**: `/Users/heal/orion-design/orion-platform-service/src/engine/MatrixExpander.ts` lines 1-258 -- 笛卡尔积(174-205)、排除(153-168)、依赖重写(113-146)、名称构建(212-222)、env 注入(228-257)
- **Pipeline ExecutionQueue**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/PipelineExecutionQueue.ts` lines 1-249 -- `maxConcurrent` 默认 10, `maxQueueSize` 默认 100
- **Parallel execution**: `PipelineEngine.ts` lines 453-464 -- `Promise.allSettled` 并行
- **Gap**: 不支持 `max-parallel`; GitHub Actions 支持; Zadig 无矩阵构建

---

## 4. Caching (缓存)

### 4.1 Configuration Syntax Comparison

| System | Syntax | Example |
|--------|--------|---------|
| **Orion** | `stage.cache` + 三级配置(全局/流水线/任务) | `cache: { enabled: true, key: "npm-${hash}", paths: ["node_modules"] }` |
| **Zadig** | 构建缓存配置 (PVC) | 构建环境中配置缓存目录映射 |
| **阿里云效** | `cache` 步骤 | `step: cache@1` |
| **CODING** | Jenkins Pipeline 插件 | `withCache` 插件 |
| **Jenkins** | `CustomWorkspace` + 插件 | 无原生缓存 |

### 4.2 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **Cache key** | `generateCacheKey(pattern, hash)` -- 模式模板 + 依赖文件 hash | PVC 路径绑定 | 用户指定 key | 用户指定 key | 自定义 |
| **Storage backend** | PostgreSQL 索引 + 文件系统实际存储 | K8s PVC | 云端对象存储 | 本地磁盘 | 本地磁盘 / 插件 |
| **Restore key** | `restoreKeys` 数组, 精确匹配; 无前缀搜索 | PVC 持久化 | 支持前缀匹配 | 手动 | 插件支持 |
| **Invalidation** | TTL (`maxAgeDays`) + LRU 清理 (`cleanupLRU`) | PVC 生命周期 | 手动清理 | 手动 | 手动 |
| **Config levels** | 三级级联: `TASK -> PIPELINE -> GLOBAL` (`isCacheEnabled()`) | 项目/流水线级 | 流水线级 | 项目级 | 无 |

### 4.3 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | 缓存键依赖外部 hash; `restoreKeys` 仅精确匹配; 本地文件系统非分布式; 仅存元数据到 PostgreSQL | `computeDependencyHash()` 使用 DJB2 变体, 非 SHA-256, 冲突概率高 |
| **Zadig** | 依赖 K8s PVC, 跨节点共享困难 | 多集群缓存需配置 |
| **阿里云效** | 缓存大小有限制 | 缓存清除需手动 |
| **CODING** | 无原生缓存 | 需自行管理 |
| **Jenkins** | 无原生缓存 | 依赖插件 |

### 4.4 Orion Code Evidence

- **BuildCacheService**: `/Users/heal/orion-design/orion-platform-service/src/services/build/BuildCacheService.ts` lines 1-365 -- 三级缓存(145-194)、缓存键(205-207)、依赖 hash(216-229)、LRU(338-353)
- **Pipeline Model cache**: `/Users/heal/orion-design/orion-platform-service/src/models/Pipeline.ts` lines 47-53
- **Gap**: 不支持 S3/MinIO; GitHub Actions 支持 S3 后端; Zadig 用 K8s PVC; Orion 存储在 `/tmp` 级别

---

## 5. Docker/Image Building (Docker/镜像构建)

### 5.1 Configuration Syntax Comparison

| System | Syntax | Example |
|--------|--------|---------|
| **Orion** | `BuildxBuilderService` API 调用, 非 YAML 原生步骤 | `buildxService.buildMultiArch(options)` -- TypeScript API |
| **Zadig** | `build.dockerfile` 字段 | `build.dockerfile: ./Dockerfile` |
| **阿里云效** | Docker 构建插件 | `step: docker@1` |
| **CODING** | Jenkins Docker Pipeline | `docker.build("myapp")` |
| **Jenkins** | Docker Pipeline plugin | `docker.build("myapp")` |

### 5.2 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **Build engine** | `docker buildx build` 命令 (`execAsync`) | Docker daemon | 云端 Docker | 云端 Docker | Docker daemon |
| **DIND** | 无; 依赖宿主机 Docker | 容器内 DIND | 云端托管 | 云端托管 | DIND 插件 |
| **Kaniko** | 不支持 | 支持 | 不支持 | 不支持 | Kaniko 插件 |
| **Multi-arch** | `buildMultiArch()` 按平台**串行**构建 | 需配置多个构建 | 不支持 | 不支持 | buildx 插件 |
| **Layer caching** | `--cache-from` / `--cache-to` registry 类型 | Docker 层缓存 | 云端缓存 | 云端缓存 | Docker 层缓存 |
| **Registry auth** | `ArtifactRegistryService` 集成; `docker login` | 平台凭证管理 | 平台凭证 | 平台凭证 | `docker.withRegistry()` |

### 5.3 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | 多架构构建为**串行**; 无 DIND; 无 Kaniko; 使用 `exec()` 非 `spawn()` 无流式日志; 镜像大小解析依赖文本匹配; 命令字符串拼接有注入风险 | `buildBuildxCommand()` 字符串拼接 (lines 373-426), imageName 含特殊字符会出问题 |
| **Zadig** | 依赖 K8s + Docker | 多架构需手动配置 |
| **阿里云效** | 无多架构 | 构建大小有限制 |
| **CODING** | 无多架构 | 构建时间有限制 |
| **Jenkins** | Docker 插件配置复杂 | DIND 安全问题 |

### 5.4 Orion Code Evidence

- **BuildxBuilderService**: `/Users/heal/orion-design/orion-platform-service/src/services/build/BuildxBuilderService.ts` lines 1-509 -- `buildMultiArch()` (64-149) 串行构建, `buildBuildxCommand()` (357-426) 字符串拼接
- **BuildService**: `/Users/heal/orion-design/orion-platform-service/src/services/build/BuildService.ts` lines 1-305 -- `executeBuild()` (206-233) 为模拟实现
- **Gap**: 无 Dockerfile Lint; 无 docker-compose 集成; 无镜像安全扫描; Zadig 内置镜像扫描

---

## 6. Test Integration (测试集成)

### 6.1 Configuration Syntax Comparison

| System | Syntax | Example |
|--------|--------|---------|
| **Orion** | `npm/test` task type 或 `shell/exec` | `uses: "npm/test@v1"` + `with: { command: "test --coverage" }` |
| **Zadig** | 测试步骤配置 | workflow 中添加测试 job |
| **阿里云效** | 测试步骤 + 报告收集 | `step: test@1` + `testFramework: junit` |
| **CODING** | 测试报告收集 | `junit 'test-results/*.xml'` |
| **Jenkins** | `junit` / `cobertura` plugins | `junit 'test-results/*.xml'` |

### 6.2 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **Test execution** | `npm/test` task 或 `shell/exec` | 容器内执行 | 容器内执行 | 构建节点执行 | Agent 执行 |
| **Report formats** | 无原生解析; task output 传递数据 | JUnit XML | JUnit XML | JUnit XML | JUnit XML |
| **Coverage** | task output `coverage` 指标传递, 被 `QualityGateService` 使用 | 覆盖率报告 | 覆盖率报告 | 覆盖率插件 | Cobertura/JaCoCo |
| **Trend reporting** | `QualityGateResultRepository` 存储历史 | 趋势图 | 趋势图 | 趋势图 | 趋势图插件 |

### 6.3 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | 无原生测试报告解析器; 覆盖率通过 task output 手动传递 (`::set-output name=coverage::85`); 无测试分片; 无测试趋势可视化 UI; `test-generation`/`test-selector` 服务存在但独立 | 测试报告需 SonarQube 通过 `fetchMetricsFromProvider()` 获取 |
| **Zadig** | 测试集成依赖外部工具 | 复杂场景需脚本 |
| **阿里云效** | 测试框架支持有限 | 自定义格式需转换 |
| **CODING** | 测试插件有限 | 报告解析依赖格式 |
| **Jenkins** | 插件多配置复杂 | 插件兼容性 |

### 6.4 Orion Code Evidence

- **QualityGateService metrics**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/QualityGateService.ts` lines 64-71 -- `coverage`, `complexity`, `duplication`, `security_hotspots`, `bugs`, `vulnerabilities`
- **SonarQube integration**: `QualityGateService.ts` lines 366-443 (`fetchSonarQubeMetrics`)
- **Gap**: 无 `junit` 解析; 无测试分片; 无测试重试; Zadig 内置 JUnit 解析; Jenkins 有丰富测试插件

---

## 7. Trigger System (触发系统)

### 7.1 Configuration Syntax Comparison

| System | Syntax | Example |
|--------|--------|---------|
| **Orion** | `spec.triggers` 数组 + `SCMTriggerRule` | `triggers: [{ type: git, branches: ["main"] }, { type: schedule, cronExpression: "0 2 * * *" }]` |
| **Zadig** | Webhook + 构建触发规则 | 平台配置 UI + webhook |
| **阿里云效** | 触发规则配置 | 代码库触发 + 定时触发 |
| **CODING** | Webhook 配置 | 代码库 Webhook |
| **Jenkins** | `triggers` block | `triggers { cron('H 2 * * *') }` |

### 7.2 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **Webhook** | `SCMWebhookService`: GitHub HMAC SHA256 + GitLab Secret Token | 多平台 webhook | 自有代码库 + 第三方 | 自有代码库 | GitHub/GitLab/Bitbucket |
| **Signature validation** | `crypto.timingSafeEqual` 防时序攻击 | HMAC | 平台内置 | 平台内置 | 插件 |
| **Branch filtering** | 简单 glob: `*` 前缀/后缀 (`matchesPattern()`) | 正则/glob | glob | glob | glob/正则 |
| **Path filtering** | `pathPatterns` 数组, 简单 glob | 文件路径规则 | 路径过滤 | 路径过滤 | `when { changeset }` |
| **Cron** | `cron-parser` 库 + `setTimeout` 定时器 | cron | cron | cron | cron |
| **Debouncing** | 5 次连续失败后标记 trigger 为 `failed` | 平台内置 | 平台内置 | 平台内置 | `quietPeriod` |
| **Priority** | `EVENT`->HIGH, `SCHEDULE`->LOW | 优先级队列 | 优先级 | 优先级 | Priority Sorter |
| **PR/MR events** | 仅处理 `push` 事件, PR/MR 未实现 | PR 触发 | PR 触发 | MR 触发 | PR/MR 插件 |

### 7.3 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | PR/MR 事件未实现; 分支匹配仅简单 glob; 无防抖; 无 `[skip ci]` 检测; Webhook payload 硬编码 | `matchesPattern()` 仅处理 `*prefix` 和 `suffix*`, 不支持 `**` 或 `[abc]` |
| **Zadig** | 触发规则配置较简单 | 复杂条件需脚本 |
| **阿里云效** | 触发规则有限 | 跨仓库触发不支持 |
| **CODING** | 触发配置依赖平台 | 复杂场景需 Webhook |
| **Jenkins** | SCM 轮询效率低 | Webhook 配置复杂 |

### 7.4 Orion Code Evidence

- **PipelineTriggerService**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/PipelineTriggerService.ts` lines 1-782 -- git/webhook/schedule/manual, cron 调度器(408-454)
- **SCMWebhookService**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/SCMWebhookService.ts` lines 1-326 -- GitHub HMAC(74-96), GitLab Token(102-109), push 处理(122-174)
- **Pattern matching**: `matchesPattern()` lines 763-775 -- 仅 `*` 前缀/后缀
- **Priority**: `PipelineEngine.ts` lines 256-274 (`determinePriority`)
- **Gap**: 无 PR/MR 支持; 无 `[skip ci]` 检测; 无触发防抖; Zadig 支持 PR 评论触发; Jenkins 有 PR 评论插件

---

## 8. Artifact Management (制品管理)

### 8.1 Configuration Syntax Comparison

| System | Syntax | Example |
|--------|--------|---------|
| **Orion** | `stage.artifacts` + `ArtifactService` API | `artifacts: { upload: ["dist/*.tar.gz"], expiry: 30 }` |
| **Zadig** | 制品仓库配置 | 平台制品管理 UI |
| **阿里云效** | 制品上传/下载步骤 | `step: artifact@1` |
| **CODING** | Generic 制品仓库 | 平台 UI 管理 |
| **Jenkins** | `archiveArtifacts` | `archiveArtifacts artifacts: 'dist/**'` |

### 8.2 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **Upload** | `ArtifactService.upload()` 写入 `/tmp/orion-artifacts/{runId}/{stageId}/{name}` | 平台 API 到制品库 | 平台 API | 平台 API | `archiveArtifacts` |
| **Storage** | 本地文件系统 (`/tmp/orion-artifacts`) | 对象存储(OSS/S3) | 云端对象存储 | 云端存储 | Jenkins master 磁盘 |
| **Cross-stage** | `passToStage()` 复制文件到目标 stage 目录 | 制品引用 | 制品引用 | 制品引用 | `stash`/`unstash` |
| **Versioning** | `ArtifactVersionRepository` (GAP-CN-06) -- `pipelineId`, `version`, `commitSha` | 制品版本 | 制品版本 | 制品版本 | Fingerprint |
| **Retention** | `maxAgeHours` (默认 72h) + 定时清理 | 保留策略 | 保留策略 | 保留策略 | 保留策略 |

### 8.3 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | 制品存储在 `/tmp` 重启丢失; 无 S3/对象存储; 跨 stage 传递用文件复制; 无搜索; `expiry` 定义但未使用 | `sanitizeFileName()` 将非字母数字替换为 `_`, 可能冲突 |
| **Zadig** | 依赖外部对象存储 | 大制品上传慢 |
| **阿里云效** | 制品大小限制 | 上传速度受网络影响 |
| **CODING** | 制品大小限制 | 存储空间有限 |
| **Jenkins** | master 磁盘可能占满 | 大制品管理困难 |

### 8.4 Orion Code Evidence

- **ArtifactService**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/ArtifactService.ts` lines 1-392 -- 上传(82-143), 跨 stage 传递(210-263), 清理(311-348)
- **Stage artifacts**: `/Users/heal/orion-design/orion-platform-service/src/models/Pipeline.ts` lines 54-58
- **Gap**: 无对象存储后端; 无搜索; Zadig 支持制品仓库 UI; Jenkins 有 Fingerprint; 阿里云效集成 OSS

---

## 9. Quality Gates (质量门禁)

### 9.1 Gate Definition Syntax

| System | Syntax | Example |
|--------|--------|---------|
| **Orion** | `QualityGate` model + `stage.qualityGate` 引用 | `qualityGate: { gateName: "production-ready" }` |
| **Zadig** | 质量门禁配置 | 平台 UI 配置 |
| **阿里云效** | 质量门禁规则 | 平台 UI |
| **CODING** | 代码检查规则 | 平台配置 |
| **Jenkins** | 插件 (Quality Gates) | 插件配置 |

### 9.2 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **Metrics** | `coverage`, `complexity`, `duplication`, `security_hotspots`, `bugs`, `vulnerabilities` | 自定义 | 代码质量 | 代码质量 | 插件 |
| **Operators** | `<`, `<=`, `>`, `>=`, `==` | 比较运算符 | 比较运算符 | 比较运算符 | 插件 |
| **Severity** | `block`, `warn` | 阻断/警告 | 阻断/警告 | 阻断/警告 | 插件 |
| **External provider** | SonarQube API (`fetchMetricsFromProvider`) | SonarQube | 自有扫描 | 自有扫描 | SonarQube 插件 |
| **History** | `QualityGateResultRepository` PostgreSQL | 趋势图 | 趋势图 | 趋势图 | 趋势图 |

### 9.3 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | 仅 6 种固定指标; 无历史趋势比较; 仅 SonarQube provider; 评估失败默认不阻断 | `collectStageQualityMetrics()` 仅从 task outputs 读取, 不主动拉取 |
| **Zadig** | 指标来源依赖外部工具 | 自定义需开发 |
| **阿里云效** | 扫描引擎固定 | 自定义规则有限 |
| **CODING** | 规则集固定 | 自定义需配置 |
| **Jenkins** | 插件质量参差 | 配置复杂 |

### 9.4 Orion Code Evidence

- **QualityGateService**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/QualityGateService.ts` lines 1-490 -- CRUD(94-158), 评估(212-246), SonarQube(366-443)
- **Engine integration**: `PipelineEngine.ts` lines 1535-1616 (`checkStageQualityGate`)
- **Gap**: 无趋势比较(delta); 无自定义指标; 仅 SonarQube; Zadig 支持多扫描引擎

---

## 10. Notifications (通知)

### 10.1 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **IM channels** | 钉钉, 企业微信, 飞书 (适配器模式) | 钉钉, 企微, 飞书, Slack | 钉钉, 邮件 | 邮件, Webhook | 邮件, Slack |
| **Webhook** | POST JSON + HMAC-SHA256 + 指数退避重试 | Webhook | Webhook | Webhook | Webhook |
| **Events** | `pipeline.complete`, `pipeline.failed`, `pipeline.cancelled` | 自定义事件 | 自定义事件 | 自定义事件 | `post` 条件 |
| **Template** | Markdown (IM), JSON (Webhook) | 自定义 | 自定义 | 自定义 | Jelly |
| **Retry** | 指数退避 (1s, 2s, 4s...) + jitter, 3次 | 平台重试 | 平台重试 | 有限 | 插件 |
| **Deduplication** | **不支持** | 支持 | 支持 | 有限 | 插件 |
| **Suppression** | **不支持** | 支持 | 支持 | 不支持 | 插件 |

### 10.2 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | 无去重/抑制; 无模板自定义; 仅 3 种事件; Slack/Email/Teams 未实现 | Webhook payload `stagesSummary` 仅 name/status/duration |
| **Zadig** | 通知渠道有限 | 自定义需开发 |
| **阿里云效** | 通知规则简单 | 复杂场景不支持 |
| **CODING** | 通知渠道有限 | 模板自定义有限 |
| **Jenkins** | 插件多配置复杂 | 邮件服务器配置 |

### 10.3 Orion Code Evidence

- **IMNotifier**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/IMNotifier.ts` lines 1-222 -- 适配器模式: 钉钉/企微/飞书
- **WebhookNotifier**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/WebhookNotifier.ts` lines 1-245 -- HMAC-SHA256(85-87), 指数退避(229-236)
- **Engine integration**: `PipelineEngine.ts` lines 835-863 (IM), lines 869-937 (Webhook)
- **Gap**: 无去重/抑制; 无 Slack/Email/Teams; 无 stage 级通知; Zadig 支持通知规则配置; 阿里云效支持钉钉卡片

---

## 11. Debug/Troubleshooting (调试/排障)

### 11.1 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **Log streaming** | SSE via `PipelineLogSSEService` | 实时日志流 | 实时日志流 | 构建日志 | Console Output |
| **Interactive debug** | `DebugController` -- pause/resume/step | 不支持 | 不支持 | 不支持 | 不支持 |
| **Step-by-step** | `step(runId)` 执行一个 task 后暂停 | N/A | N/A | N/A | N/A |
| **State inspection** | `getState(runId)` -- DebugState | 查看日志 | 查看日志 | 查看日志 | Console + 插件 |
| **Checkpoint** | `PipelineCheckpointManager` PostgreSQL 持久化 | 无 | 无 | 无 | Blue Ocean |
| **Crash recovery** | `recoverOrphanedRuns()` 扫描+恢复/标记失败 | 无 | 无 | 无 | 无 |
| **Re-run from stage** | GAP-06: `applyRetrySkipMetadata()` fromStage/onlyFailed | 支持 | 支持 | 支持 | 不支持 |
| **Log sanitization** | `StreamSecretSanitizer` 流式遮蔽 | 支持 | 支持 | 支持 | Mask Passwords |

### 11.2 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | Debug 为内存态 (Singleton) 重启丢失; 不支持历史回放; Checkpoint 不序列化中间数据; SSE 推送到内存 `localBus`; 无 Web Terminal | `DebugController` 为 Singleton, 多实例部署不一致 |
| **Zadig** | 调试能力有限 | 无交互调试 |
| **阿里云效** | 无交互调试 | 日志搜索有限 |
| **CODING** | 无交互调试 | 日志查看有限 |
| **Jenkins** | Replay 有限 | 调试需插件 |

### 11.3 Orion Code Evidence

- **DebugController**: `/Users/heal/orion-design/orion-platform-service/src/engine/DebugController.ts` lines 1-262 -- 单例, pause/resume/step/getState
- **PipelineCheckpointManager**: `/Users/heal/orion-design/orion-platform-service/src/engine/PipelineCheckpointManager.ts` lines 1-446 -- 序列化/反序列化, 崩溃恢复(225-313)
- **PipelineLogSSEService**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/PipelineLogSSEService.ts` lines 1-285 -- SSE 实时日志
- **Gap**: 无 Web Terminal; 无历史回放; 无日志搜索; Zadig 支持日志搜索; Jenkins 有 Blue Ocean

---

## 12. Security (安全)

### 12.1 Implementation Comparison

| Aspect | Orion | Zadig | 阿里云效 | CODING | Jenkins |
|--------|-------|-------|---------|--------|---------|
| **Secret storage** | AES-256-GCM, PostgreSQL `secrets` 表 | K8s Secrets / Vault | 平台加密 | 平台加密 | Jenkins Credentials |
| **Secret syntax** | `${secrets.XXX}` 或 `${secrets.XXX:default}` 或 `parameters.secrets` | 变量引用 | 变量引用 | 变量引用 | `credentials()` |
| **Injection timing** | `resolveTaskSecrets()` 注入到 `env`, 通过 `spawn` 传递 | 运行时注入 | 运行时注入 | 运行时注入 | 运行时注入 |
| **Log masking** | `StreamSecretSanitizer` 按长度降序 split/join 替换 `***` | 日志遮蔽 | 日志遮蔽 | 日志遮蔽 | Mask Passwords |
| **Script injection** | `DANGEROUS_PATTERNS` (5 个模式) + 禁用 `shell: true` | 容器隔离 | 容器隔离 | 构建节点隔离 | 沙箱 |
| **RBAC** | 4 角色: admin/editor/viewer/approver | 项目/流水线角色 | 项目/团队角色 | 项目角色 | 基于角色的授权 |
| **Tenant isolation** | `PipelineTenantIsolationService` | 项目隔离 | 组织隔离 | 项目隔离 | 多实例/文件夹 |
| **Webhook security** | HMAC-SHA256 + `timingSafeEqual` | HMAC | Token | Token | Token/HMAC |

### 12.2 Limitations Comparison

| System | Known Limitations | Edge Cases |
|--------|------------------|------------|
| **Orion** | fallback 密钥不安全; 安全过滤仅 5 个模式; RBAC 仅 pipeline 级; 无审计日志; secret 通过 env 传递可被 `/proc/self/environ` 读取; 无 secret 轮转; 无 OIDC/SAML | `StreamSecretSanitizer` 不处理跨行 secret |
| **Zadig** | 依赖 K8s 安全 | 多租户隔离需配置 |
| **阿里云效** | 平台级别安全 | 自定义策略有限 |
| **CODING** | 平台安全 | 自定义策略有限 |
| **Jenkins** | Agent 安全需配置 | 沙箱可绕过 |

### 12.3 Orion Code Evidence

- **SecretsService**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/SecretsService.ts` lines 1-419 -- AES-256-GCM(127-138), secret 引用(249-297), 日志遮蔽(77-109), 密钥派生(391-406)
- **Secret pattern**: line 24 -- `/\$\{secrets\.([a-zA-Z_][a-zA-Z0-9_]*)(?::([^}]*))?\}/g`
- **Dangerous patterns**: `TaskRunner.ts` lines 43-50 -- `['rm -rf /', 'mkfs', 'dd if=', '> /dev/sd', 'curl.*|.*sh', 'wget.*|.*sh']`
- **PipelineRBACService**: `/Users/heal/orion-design/orion-platform-service/src/services/pipeline/PipelineRBACService.ts` lines 1-216 -- 4 角色 6 权限, 内存缓存 + PostgreSQL
- **Webhook signature**: `SCMWebhookService.ts` lines 74-96 -- HMAC-SHA256 + timing-safe
- **Gap**: 无 HashiCorp Vault; 无 OIDC/SAML; RBAC 仅 pipeline 级; 无 secret 轮转; 安全过滤太少; Zadig 支持 Vault; Jenkins 有 Credentials Binding + Vault 插件

---

## 总结: Orion 功能实现度评估

| 功能域 | Orion 实现度 | 主要 Gap | 优先级 |
|--------|-------------|---------|--------|
| **Pipeline Configuration** | ~75% | 无模板继承、变量仅支持 string | P1 |
| **Build Execution** | ~60% | 无容器隔离、K8s Executor 为 mock、无 DIND/Kaniko | P1 |
| **Matrix/Parallel Builds** | ~80% | 无 max-parallel、matrix 仅 string[] | P2 |
| **Caching** | ~50% | 非分布式存储、无前缀匹配、hash 算法简单 | P2 |
| **Docker/Image Building** | ~40% | 串行多架构、无 DIND/Kaniko、exec 非 spawn | P1 |
| **Test Integration** | ~35% | 无报告解析、无分片、无趋势可视化 | P2 |
| **Trigger System** | ~55% | 无 PR/MR、无 skip ci、无防抖 | P1 |
| **Artifact Management** | ~45% | /tmp 存储、无对象存储、无搜索 | P1 |
| **Quality Gates** | ~65% | 仅 6 种指标、无趋势比较、仅 SonarQube | P2 |
| **Notifications** | ~50% | 无去重/抑制、无模板自定义、渠道有限 | P2 |
| **Debug/Troubleshooting** | ~55% | 内存态 debug、无 Web Terminal、无日志搜索 | P2 |
| **Security** | ~55% | fallback 密钥、过滤简单、无 Vault | P1 |

### 总体评价

Orion 的 Pipeline 引擎 (`PipelineEngine` + `StageExecutor` + `TaskRunner`) 在**编排逻辑**层面设计较为完善, 特色实现包括:

- **智能重试**: `AutoRetryService` 的错误分类 + 指数退避
- **安全检查**: `ExpressionEvaluator` 的白名单运算符 + 危险模式拦截
- **崩溃恢复**: `PipelineCheckpointManager` 的 checkpoint 持久化
- **远程 Runner**: `RunnerPoolService` 的标签路由
- **交互调试**: `DebugController` 的 pause/resume/step

但在**执行层**和**生态集成**方面仍有较大差距:

1. 执行环境无容器隔离 (依赖宿主机)
2. Docker 构建能力薄弱 (无 DIND/Kaniko)
3. 制品管理非持久化 (/tmp)
4. PR/MR 触发未实现
5. 安全集成不足 (无 Vault/OIDC)
