# Orion CI/CD 平台：10 大 CI 配置缺口深度技术分析报告

**日期**: 2026-05-09
**分支**: `feat/frontend-gap-implementation`
**分析范围**: 对比 Zadig、阿里云效、CODING、Jenkins 的 CI 能力
**分析方法**: 代码审查 + 竞品技术对标

---

## 总体评估

| 缺口 | 优先级 | Orion 当前状态 | 评估 |
|------|--------|---------------|------|
| 1. Docker 镜像构建 | P0 | BuildxBuilderService 存在但未接入 PipelineEngine | 有骨架无集成 |
| 2. 构建缓存 | P0 | BuildCacheService 数据模型完整，未在执行层使用 | 数据层就绪，执行层缺失 |
| 3. 容器化构建环境 | P1 | K8sBuildExecutor 使用 Mock Client，TaskRunner 直接在宿主机 spawn | 有框架无实现 |
| 4. 测试报告收集 | P1 | 无 TestReport 相关代码，ArtifactType 有 test-result 枚举 | 数据模型有预留，无功能 |
| 5. PR/MR 触发与过滤 | P1 | SCMWebhookService 只处理 push 事件 | 基础 webhook 存在，缺 PR 支持 |
| 6. 多架构构建 | P2 | BuildxBuilderService 支持，ArtifactService 有 MultiArch 接口 | 代码已实现 70% |
| 7. 图形化 Pipeline 编辑器 | P2 | 前端无可视化编辑器，后端有 TemplateService | 后端能力就绪，前端缺失 |
| 8. 制品版本管理 | P2 | ArtifactService 有版本追踪(GAP-CN-06)，缺独立版本管理 | 部分实现 |
| 9. GPU 资源分配 | P3 | TaskResourceQuota 只有 cpu/memory | 模型存在，缺 GPU 字段 |
| 10. 共享库机制 | P3 | 无任何共享库代码 | 完全缺失 |

---

## 缺失-1: Docker 镜像构建能力（P0）

### 1. 竞品技术实现分析

#### Zadig
- **配置语法**: YAML 中通过 `build` stage 配置，`docker_build` 字段指定 `dockerfile`、`workdir`、`image_name`
- **DIND 方案**: 使用 Docker-in-Docker sidecar 容器，通过 `docker:20.10-dind` 镜像挂载 `/var/run/docker.sock`
- **层缓存**: 使用 `buildkit` 的 `--cache-from`/`--cache-to` 支持 GCS/S3/registry 缓存后端
- **优点**: 原生 buildkit 支持，缓存策略灵活
- **缺点**: 仅支持 K8s 环境，不支持裸机

#### 阿里云效
- **配置语法**: Flow 流水线中通过 "Docker 镜像构建" 插件配置，UI 表单式
- **DIND 方案**: 云原生构建集群，每个构建 Pod 自带 Docker daemon
- **层缓存**: 阿里云 ACR 加速器 + buildkit 缓存
- **优点**: 零配置 DIND，与 ACR 无缝集成
- **缺点**: 强绑定阿里云生态

#### Jenkins
- **配置语法**: Pipeline DSL `docker.build()` 或 `docker.withRegistry()`
- **DIND 方案**: Jenkins Kubernetes Plugin 的 podTemplate + docker 容器
- **层缓存**: 依赖 Docker daemon 本地缓存或第三方插件
- **优点**: 灵活性最高，插件生态丰富
- **缺点**: 配置复杂，维护成本高

#### 对比总结

| 维度 | Zadig | 阿里云效 | Jenkins | Orion（现状） |
|------|-------|---------|---------|--------------|
| YAML 配置 | 支持 | 不支持(UI) | DSL | 未实现 |
| DIND 支持 | buildkit sidecar | 托管 | podTemplate | 无 |
| 层缓存 | buildkit registry cache | ACR | 本地 | 无 |
| 多架构 | buildx | 不支持 | buildx 插件 | 有独立服务 |
| 构建上下文 | Git + 本地 | Git + 本地 | Git + 本地 | 无 |

### 2. Orion 当前代码详细审查

**现有相关代码**:

- `src/services/build/BuildxBuilderService.ts` (409-509行): 完整的 buildx 多架构构建服务
  - `buildMultiArch(options: BuildOptions)`: 入口方法
  - `buildPlatform(options)`: 单平台构建
  - `pushImages(options)`: 推送镜像
  - `buildBuildxCommand(options)`: 构建 docker buildx CLI 命令
  - **问题**: 使用 `exec()` 调用本地 docker，无安全沙箱，无流式日志

- `src/services/build/K8sBuildExecutor.ts`: K8s 构建执行器
  - 使用 `MockK8sClient`，非真实 K8s 客户端
  - `buildK8sPodSpec(pod)`: 构建 K8s Pod 规格，支持 volumeMounts、缓存挂载
  - **问题**: 未集成 `@kubernetes/client-node`，仅为框架

- `src/models/Pipeline.ts` (PipelineStage):
  ```typescript
  interface PipelineStage {
    name: string;
    runsOn: string;
    steps: PipelineStep[];  // step 只有 name, uses, with
    ...
  }
  interface PipelineStep {
    name: string;
    uses: string;
    with?: Record<string, unknown>;
  }
  ```
  **缺失**: 没有 `docker`/`build` 专用的 step type 或结构化字段

- `src/engine/TaskRunner.ts` (executeByType, 419-443行):
  - 支持的 type: `plugin/*`, `inline-script/*`, `git/*`, `npm/*`, `k8s/*`, `shell/*`
  - **缺失**: 没有 `docker/*` 或 `build/*` type 的处理逻辑

- `src/api/build-routes.ts`:
  - `/build/buildx` 路由已注册（340-372行），有 `buildMultiArch`、`getBuilders`、`getBuildStatus` 等端点
  - **问题**: 这些端点是独立的 REST API，未与 Pipeline 执行流集成

**扩展点分析**:

| 文件 | 行 | 需要改什么 |
|------|----|-----------|
| `TaskRunner.ts` | 419-443 `executeByType` | 添加 `case 'docker/':` 分发到 `executeDockerTask` |
| `TaskRunner.ts` | 全文 | 新增 `executeDockerTask` 方法 |
| `Pipeline.ts` | 26-31 `PipelineStep` | 可选：增加 `docker?: DockerStepConfig` 结构化字段 |
| `PipelineEngine.ts` | 321-341 `initializeTasks` | 当前通过 `step.uses.split('@')` 解析 type，天然支持新 type |
| `build-routes.ts` | 340-341 | 已有 `/build/buildx` 端点，需增加 pipeline-trigger 版本 |

**依赖关系**:
- `BuildxBuilderService` 依赖本机 Docker daemon（通过 `exec('docker buildx...')`）
- 当前未接入 `WorkspaceIsolator`，构建上下文路径管理缺失
- 无日志流式输出机制（使用 `exec()` 同步执行）

### 3. 技术实现方案

#### 数据模型变更

无需新增表。现有 `BuildxBuilderService.BuildOptions` 已覆盖需求。仅需在 YAML 中支持新 step type:

```yaml
stages:
  - name: build
    runsOn: docker-runner
    steps:
      - name: docker-build
        uses: docker/build@v1
        with:
          context: .
          dockerfile: Dockerfile
          image: registry.example.com/myapp
          tags: [latest, '${git.sha}']
          platforms: [linux/amd64, linux/arm64]
          cache:
            from: type=registry,ref=registry.example.com/myapp:buildcache
            to: type=registry,ref=registry.example.com/myapp:buildcache
          push: true
          buildArgs:
            NODE_ENV: production
```

#### 服务层设计

在 `TaskRunner.ts` 中新增 `DockerBuildExecutor` 类：

```typescript
class DockerBuildExecutor {
  private buildxService: BuildxBuilderService;
  private workspaceIsolator: WorkspaceIsolator;

  async execute(task: Task, signal: AbortSignal): Promise<SpawnResult> {
    // 1. 解析 task.parameters 为 BuildOptions
    // 2. 确定构建上下文路径（workspace）
    // 3. 调用 buildxService.buildMultiArch() 或 buildPlatform()
    // 4. 流式输出日志
    // 5. 返回结果含 imageId, digest, size
  }
}
```

新增 `executeDockerTask` 方法到 `TaskRunner`:

```typescript
private async executeDockerTask(
  task: Task, signal?: AbortSignal, sanitizer?: StreamSecretSanitizer
): Promise<Record<string, unknown>> {
  const action = task.type.split('/')[1]; // 'build', 'push', 'scan'
  const workspace = this.getTaskWorkspace(task, 'docker');

  switch (action) {
    case 'build':
      return this.executeDockerBuild(task, workspace, signal);
    case 'push':
      return this.executeDockerPush(task, workspace, signal);
    case 'scan': // 安全扫描
      return this.executeDockerScan(task, workspace, signal);
    default:
      throw new Error(`Unknown docker action: ${action}`);
  }
}
```

#### 执行层集成

**DIND vs 非 DIND 策略**:

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|---------|
| 本机 Docker daemon | 简单，无需额外组件 | 安全风险，多租户隔离差 | 单租户/开发环境 |
| K8s Pod + DIND sidecar | 安全隔离，多租户 | 需 K8s 集群 | 生产环境 |
| Kaniko (无 daemon) | 无特权运行，K8s 友好 | 不支持所有 Dockerfile 语法 | 生产推荐 |
| Buildah | rootless，OCI 兼容 | 生态不如 Docker | 安全要求高的场景 |

**推荐方案**: 默认 Kaniko（无特权 K8s Pod），可选本机 Docker（开发模式）。

Kaniko 集成方案:
```yaml
# Pod Template for Kaniko
containers:
  - name: kaniko
    image: gcr.io/kaniko-project/executor:latest
    args:
      - --context=${workspace}
      - --dockerfile=Dockerfile
      - --destination=registry.example.com/myapp:${tag}
      - --cache=true
      - --cache-repo=registry.example.com/myapp:cache
    volumeMounts:
      - name: workspace
        mountPath: /workspace
```

#### API 设计

扩展现有 `/build/buildx` 端点，新增 pipeline 集成端点：

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/pipelines/:id/docker-build` | POST | 触发 Docker 构建 |
| `/api/v1/builds/:id/status` | GET | 查询构建状态（已有） |
| `/api/v1/builds/:id/logs` | GET/SSE | 流式构建日志（已有） |
| `/api/v1/builds/:id/cancel` | POST | 取消构建（已有） |

#### 前端配置界面

新增 UI 组件：
- `DockerBuildConfigPanel`: Docker 构建配置面板（Dockerfile 路径、构建上下文、镜像名、标签、平台）
- `DockerRegistryConfig`: 镜像仓库认证配置
- `BuildCacheConfig`: 构建缓存策略配置

### 4. 依赖与风险

- **外部依赖**: Docker daemon / K8s API / Container registry
- **安全风险**: 本机 Docker build 意味着容器可访问宿主机 Docker socket，需通过 RBAC + 命名空间隔离
- **性能风险**: `exec()` 同步调用阻塞 Node.js event loop，需改为 `spawn()` 流式执行
- **兼容性**: 现有 BuildxBuilderService 的 `exec()` 方式需改造为 `spawn()` 以支持流式日志

---

## 缺失-2: 构建缓存（P0）

### 1. 竞品技术实现分析

#### GitHub Actions Cache
- **API 设计**: `actions/cache@v4` action，通过 `key` 和 `restore-keys` 控制
- **Cache Key 计算**: 支持 `hashFiles('**/package-lock.json')` 等函数，基于文件内容 hash
- **缓存恢复**: 在 job 开始时恢复，路径匹配 `~/.cache`, `node_modules` 等
- **存储**: GitHub 托管的 blob 存储，每个 repo 10GB 限额
- **优点**: API 简洁，restore-keys 前缀匹配灵活
- **缺点**: 缓存大小有限，跨分支共享受限

#### Zadig
- **配置语法**: `cache: { paths: ["/root/.m2"], key: "{{.Branch}}-{{.Checksum \"pom.xml\"}}" }`
- **存储**: 支持 S3/NFS/本地 PV 三种后端
- **优点**: 支持变量替换，可按分支定制
- **缺点**: 仅 K8s 环境

#### 阿里云效
- **配置**: 构建任务配置中勾选 "启用缓存"，指定缓存路径
- **存储**: 阿里云 NAS，自动按项目隔离
- **优点**: 零配置，自动管理
- **缺点**: 不可自定义存储后端

#### 对比总结

| 维度 | GitHub Actions | Zadig | 阿里云效 | Orion（现状） |
|------|---------------|-------|---------|--------------|
| 缓存 Key | hashFiles() | 模板变量 | 自动 | 三级配置+hash |
| 前缀匹配 | restore-keys | 无 | 无 | 无 |
| 存储后端 | 托管 | S3/NFS/PV | NAS | S3/NFS/local |
| 清理策略 | LRU+限额 | TTL+LRU | 自动 | TTL+LRU+Manual |
| 执行层集成 | 原生 | 原生 | 原生 | **未集成** |

### 2. Orion 当前代码详细审查

**现有代码非常完善**:

- `src/models/BuildCache.ts`: 完整的数据模型
  ```typescript
  enum CacheLevel { GLOBAL, PIPELINE, TASK }
  enum CacheStorageType { LOCAL_VOLUME, S3, NFS }
  enum CacheCleanupPolicy { LRU, TTL, MANUAL, NEVER }
  interface BuildCacheConfig { cacheKeyPattern, cachePaths, ... }
  interface CacheEntry { cacheKey, hash, hitCount, lastHitAt, ... }
  ```

- `src/services/build/BuildCacheService.ts`: 完整的业务逻辑
  - `isCacheEnabled(pipelineId, taskId)`: 三级级联开关
  - `getEffectiveConfig(pipelineId, taskId)`: 获取生效配置
  - `generateCacheKey(config, hash)`: 缓存键生成
  - `computeDependencyHash(filePaths, fileHashes)`: 依赖文件 hash 计算
  - `createCacheEntry/getCacheEntryByKey/cleanupExpired/cleanupLRU`: 完整的 CRUD

- `src/api/build-routes.ts` (139-202行): 完整的缓存管理 API
  - `/build-cache/configs`: CRUD
  - `/build-cache/effective`: 三级级联查询
  - `/build-cache/entries`: 缓存条目管理
  - `/build-cache/cleanup/*`: 清理策略

- `src/services/cache/CacheService.ts`: 通用 KV 缓存（Redis/内存）

**关键问题：缓存配置未在执行层被使用！**

审查 `TaskRunner.ts` 的 `run()` 方法（284-401行）:
- **无任何缓存恢复/保存逻辑**
- 没有调用 `BuildCacheService`
- Stage 模型 `PipelineStage` 有 `cache?: { enabled, key, paths, restoreKeys }` 字段（Pipeline.ts:47-52），但 `PipelineEngine` 和 `TaskRunner` 中未消费

`src/api/build-routes.ts` (317-330行) 有 Stage 级别缓存 API:
- `POST /pipeline-runs/:runId/stages/:stageId/cache` - 保存缓存
- `GET /pipeline-runs/:runId/stages/:stageId/cache` - 恢复缓存

但对应的 `StageCacheController` 只是将请求转发给 `BuildCacheService`，没有实际的缓存打包/解压/挂载操作。

**扩展点分析**:

| 文件 | 行 | 需要改什么 |
|------|----|-----------|
| `StageExecutor.ts` | 53-90 `executeStage` | 在任务执行前调用缓存恢复 |
| `StageExecutor.ts` | 88 (success return) | 在阶段成功后调用缓存保存 |
| `TaskRunner.ts` | 284-401 `run` | 集成 BuildCacheService |
| `K8sBuildExecutor.ts` | 261-298 `buildK8sPodSpec` | 已有缓存挂载逻辑，需真实化 |

### 3. 技术实现方案

#### 数据模型变更

现有 `PipelineStage.cache` 字段已够用:
```typescript
cache?: {
  enabled: boolean;
  key: string;              // 如 'npm-${hash("package-lock.json")}'
  paths: string[];          // 如 ['node_modules', '~/.npm']
  restoreKeys?: string[];   // 如 ['npm-', 'npm-fallback-']
};
```

需要新增: 缓存键模板中的变量解析函数（类似 GitHub Actions 的 `hashFiles()`）。

#### 服务层设计

新增 `CacheRestoreSaveService`:

```typescript
class CacheRestoreSaveService {
  private cacheService: BuildCacheService;
  private storageDriver: CacheStorageDriver; // local/S3/NFS

  async restoreCache(runId: string, stage: PipelineStage): Promise<CacheRestoreResult> {
    // 1. 检查缓存是否启用
    const enabled = await this.cacheService.isCacheEnabled(runId);
    if (!enabled || !stage.cache?.enabled) return { restored: false };

    // 2. 计算缓存键（支持模板变量解析）
    const cacheKey = this.resolveCacheKey(stage.cache.key, runId);

    // 3. 按 key 查找缓存条目
    const entry = await this.cacheService.getCacheEntryByKey(configId, cacheKey);

    // 4. 如果未命中，尝试 restoreKeys 前缀匹配
    if (!entry && stage.cache.restoreKeys) {
      for (const prefix of stage.cache.restoreKeys) {
        const fallbackEntry = await this.cacheService.findEntryByPrefix(configId, prefix);
        if (fallbackEntry) { entry = fallbackEntry; break; }
      }
    }

    // 5. 下载并解压缓存到指定路径
    if (entry) {
      await this.storageDriver.downloadAndExtract(entry.storagePath, stage.cache.paths);
      return { restored: true, key: entry.cacheKey, exact: true };
    }

    return { restored: false };
  }

  async saveCache(runId: string, stage: PipelineStage): Promise<void> {
    if (!stage.cache?.enabled) return;

    // 1. 打包指定路径
    const archivePath = await this.storageDriver.compress(stage.cache.paths);

    // 2. 上传到存储后端
    const storagePath = await this.storageDriver.upload(archivePath);

    // 3. 创建缓存条目记录
    const cacheKey = this.resolveCacheKey(stage.cache.key, runId);
    await this.cacheService.createCacheEntry(configId, cacheKey, storagePath);
  }
}
```

#### 执行层集成

在 `StageExecutor.executeStage` 中集成:

```typescript
async executeStage(runId: string, stage: Stage, tasks: Task[]): Promise<...> {
  // 1. 恢复缓存（在任务执行前）
  const yamlStage = this.getYamlStage(stage); // 获取原始 YAML stage
  if (yamlStage?.cache?.enabled) {
    const restoreResult = await this.cacheRestoreSave.restoreCache(runId, yamlStage);
    this.logCacheRestore(runId, restoreResult);
  }

  // 2. 执行任务
  const result = await this.runTasks(tasks);

  // 3. 保存缓存（任务执行后）
  if (result.success && yamlStage?.cache?.enabled) {
    await this.cacheRestoreSave.saveCache(runId, yamlStage);
  }

  return result;
}
```

#### 缓存键模板引擎

扩展现有 `ExpressionEvaluator`，新增缓存专用函数:

| 函数 | 描述 | 示例 |
|------|------|------|
| `hashFiles(pattern)` | 文件内容 hash | `hashFiles('**/package-lock.json')` |
| `runner.os` | 操作系统 | `'Linux'` |
| `env.VAR` | 环境变量引用 | `env.NODE_VERSION` |

#### API 设计

现有 API 已完备，仅需新增:

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/build-cache/entries/prefix/:prefix` | GET | 前缀匹配查找缓存条目 |
| `/api/v1/pipeline-runs/:runId/stages/:stageId/cache/stats` | GET | 缓存命中统计 |

#### 前端配置界面

- `CacheConfigPanel`: Stage 级别缓存配置（启用/禁用、Key 模板、路径、restore-keys）
- `CacheDashboard`: 缓存使用率、命中率、容量监控
- `CacheKeyBuilder`: 可视化缓存键构建器（支持变量选择器）

### 4. 依赖与风险

- **外部依赖**: S3 SDK (aws-sdk)、tar 压缩库
- **安全风险**: 缓存可能被注入恶意文件，需在恢复时校验 checksum
- **性能风险**: 大缓存包（如 node_modules 数 GB）的压缩/解压/传输耗时
- **兼容性**: 现有 BuildCacheConfig/CacheEntry 模型完全兼容，无需数据库迁移

---

## 缺失-3: 容器化构建执行环境（P1）

### 1. 竞品技术实现分析

#### Jenkins Kubernetes Plugin
- **架构**: `podTemplate` 定义 Pod 规格，每个 stage 在独立 Pod 中运行
- **Sidecar 模式**: 支持定义多个容器（如 docker-in-docker + build 容器）
- **Workspace 共享**: 通过 `emptyDir` volume 在 Pod 内容器间共享 workspace
- **优点**: 完全隔离，资源可精确控制
- **缺点**: K8s 依赖，配置复杂

#### GitHub Actions
- **架构**: 每个 job 在 GitHub 托管的 VM 或自托管 Runner 中运行
- **容器 Job**: `container: node:18` 指定 job 运行容器
- **Service Containers**: 支持 MySQL、Redis 等服务容器作为 sidecar
- **优点**: 配置简洁，自动清理
- **缺点**: 无法自定义底层基础设施

#### Zadig
- **架构**: 所有 stage 在 K8s Pod 中执行，通过 `job` spec 定义资源
- **构建集群**: 支持多集群路由
- **优点**: 原生云原生，资源隔离好
- **缺点**: 仅 K8s

#### 对比总结

| 维度 | Jenkins K8s | GitHub Actions | Zadig | Orion（现状） |
|------|-------------|---------------|-------|--------------|
| 执行环境 | K8s Pod | VM/容器 | K8s Pod | **宿主机进程** |
| 隔离级别 | 进程+网络 | VM/容器 | 进程+网络 | Workspace 目录 |
| Sidecar | 支持 | 支持 | 支持 | 无 |
| 资源限制 | K8s resources | VM 规格 | K8s resources | 无 |
| 多租户 | 命名空间隔离 | 自隔离 | 命名空间 | 无 |

### 2. Orion 当前代码详细审查

**核心问题**: `TaskRunner.ts` 的 `spawnCommand` (91-175行) 直接在宿主机 spawn 进程。

```typescript
function spawnCommand(command, args, options) {
  const child = spawn(command, args, {
    cwd: options?.cwd || process.cwd(),
    env: getCleanEnv(options?.env),  // 有限的 PATH 清理
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout,
  });
  // ...
}
```

虽然有以下安全措施:
- `getCleanEnv`: 清理环境变量
- `isScriptSafe`: 危险命令检测
- `WorkspaceIsolator`: 工作空间隔离（`/tmp/orion-workspaces/${runId}/${taskId}/`）

但本质上是 **宿主机直接执行**，无容器隔离。

**现有容器化框架**:

- `K8sBuildExecutor.ts`: K8s 构建执行框架
  - `buildK8sPodSpec(pod)`: 构建 Pod 规格，支持 volumeMounts、资源限制
  - `MockK8sClient`: 模拟 K8s 客户端
  - **未接入 TaskRunner**

- `RunnerPoolService.ts`: 远程 Runner 调度
  - 支持标签路由、任务分发
  - 可作为"外部容器化执行器"使用

- `TaskRunner.ts` (314-365行): 已有远程 Runner 分发逻辑
  ```typescript
  if (runnerLabels && runnerLabels.length > 0 && this.runnerPoolService && tenantId) {
    const runner = await this.runnerPoolService.selectRunner(runnerLabels, tenantId);
    if (runner && runner.endpoint) {
      // dispatch to remote runner
    }
  }
  ```

**扩展点分析**:

| 文件 | 行 | 需要改什么 |
|------|----|-----------|
| `TaskRunner.ts` | 284-401 `run` | 添加容器化执行选项 |
| `TaskRunner.ts` | 91-175 `spawnCommand` | 可选容器内执行 |
| `K8sBuildExecutor.ts` | 全文 | 替换 MockK8sClient 为真实客户端 |
| `Stage.ts` | `Stage` 接口 | 新增 `container?: ContainerSpec` |
| `Pipeline.ts` | `PipelineStage` | 新增 `container?: { image, volumes, resources }` |

### 3. 技术实现方案

#### 数据模型变更

在 `PipelineStage` 新增容器配置:

```typescript
interface PipelineStage {
  // ...existing fields
  container?: {
    image: string;              // 如 'node:18-alpine'
    command?: string[];         // 覆盖 entrypoint
    volumes?: VolumeMount[];    // 挂载卷
    resources?: {
      cpu?: string;             // '500m', '1'
      memory?: string;          // '512Mi', '1Gi'
    };
    env?: Record<string, string>;
  };
}
```

#### 服务层设计

新增 `ContainerExecutor` 策略模式:

```typescript
interface ContainerExecutor {
  execute(task: Task, containerSpec: ContainerSpec, signal: AbortSignal): Promise<ExecutionResult>;
}

// 三种实现:
class LocalSpawnExecutor implements ContainerExecutor { ... }    // 当前实现
class DockerExecutor implements ContainerExecutor { ... }       // docker run
class KubernetesExecutor implements ContainerExecutor { ... }   // K8s Pod
```

#### 执行层集成

在 `TaskRunner.run()` 中增加容器化执行分支:

```typescript
async run(task: Task, signal?: AbortSignal): Promise<Task> {
  const containerSpec = task.parameters.container as ContainerSpec | undefined;

  if (containerSpec?.image) {
    // 容器化执行
    return this.executeInContainer(task, containerSpec, signal);
  }

  if (runnerLabels?.length > 0) {
    // 远程 Runner 执行
    return this.executeOnRemoteRunner(task, signal);
  }

  // 默认：本地 spawn（当前行为）
  return this.executeByType(task, signal, sanitizer);
}
```

#### Kaniko vs Docker in Docker 决策

**推荐 Kaniko 作为默认容器化构建方案**:

| 维度 | Kaniko | Docker-in-Docker |
|------|--------|-----------------|
| 特权模式 | 不需要 | 需要 `--privileged` |
| 镜像大小 | ~150MB | Docker daemon + client ~500MB |
| 缓存支持 | `--cache=true` | 原生 Docker 缓存 |
| K8s 友好 | 原生 | 需 sidecar |
| Dockerfile 兼容性 | 大部分支持 | 100% |

#### API 设计

利用现有 Runner 管理 API，新增:

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/runners/capabilities` | GET | 查询 Runner 支持的能力（容器/K8s/Docker） |

#### 前端配置界面

- `ContainerConfigPanel`: 容器镜像选择、资源限制配置
- `RunnerSelector`: 构建 Runner 选择（本地/远程/K8s）

### 4. 依赖与风险

- **外部依赖**: `@kubernetes/client-node` (K8s)、Docker daemon 或 Kaniko
- **安全风险**: 特权容器需要严格 RBAC，Kaniko 无需特权更安全
- **性能风险**: Pod 启动延迟（1-5s），比本地 spawn 慢
- **兼容性**: 保持现有本地 spawn 为默认行为，容器化为可选

---

## 缺失-4: 测试报告收集（P1）

### 1. 竞品技术实现分析

#### Jenkins
- **JUnit 插件**: `junit 'target/surefire-reports/*.xml'` 解析 JUnit XML
- **可视化**: Trend 图表、失败用例列表、历史趋势
- **支持格式**: JUnit XML、TestNG、NUnit、pytest JSON

#### GitHub Actions
- **Test Reporter**: 使用 `dorny/test-reporter` action 解析多种格式
- **PR 评论**: 自动在 PR 中发布测试结果摘要
- **支持格式**: JUnit XML、Jest JSON、Go test output

#### Zadig
- **测试类型**: 单元测试、集成测试、性能测试
- **报告格式**: JUnit XML、Allure、自定义 JSON
- **可视化**: 通过率趋势、用例详情、失败堆栈

#### 对比总结

| 维度 | Jenkins | GitHub Actions | Zadig | Orion（现状） |
|------|---------|---------------|-------|--------------|
| 格式支持 | JUnit/TestNG | 多格式+action | JUnit/Allure | **无** |
| 可视化 | Trend 图表 | PR 评论 | 通过率趋势 | 无 |
| 失败分析 | 堆栈跟踪 | 日志链接 | 用例详情 | 无 |
| 历史趋势 | 支持 | 支持 | 支持 | 无 |
| 与 Pipeline 集成 | 原生 task | Action | 测试 stage | 无 |

### 2. Orion 当前代码详细审查

**现有预留**:

- `src/models/BuildArtifact.ts` (13-17行):
  ```typescript
  enum ArtifactType {
    BUILD_OUTPUT = 'build-output',
    TEST_RESULT = 'test-result',       // 预留
    COVERAGE_REPORT = 'coverage-report', // 预留
    LOG_FILE = 'log-file',
    OTHER = 'other',
  }
  ```

- **无任何 TestReport 模型、服务、路由**
- `ArtifactService`（`src/services/pipeline/ArtifactService.ts`）支持上传 artifact，但无测试报告解析能力
- `TaskRunner.ts` 无测试专用 task type

**扩展点分析**:

| 文件 | 行 | 需要改什么 |
|------|----|-----------|
| `TaskRunner.ts` | 419-443 `executeByType` | 添加 `test/*` type 处理 |
| `ArtifactService` | 全文 | 增加 `parseTestReport()` 方法 |
| `models/` | 新建 | 新增 `TestReport.ts` 模型 |
| `services/` | 新建 | 新增 `TestReportService.ts` |
| `api/` | 新建 | 新增 `test-report-routes.ts` |

### 3. 技术实现方案

#### 数据模型变更

新增 `TestReport` 模型:

```typescript
interface TestReport {
  id: string;
  runId: string;
  stageId: string;
  taskId: string;
  format: 'junit' | 'jest' | 'pytest' | 'go' | 'allure' | 'custom';
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  testCases: TestCase[];
  coverage?: CoverageSummary;
  uploadedAt: Date;
}

interface TestCase {
  name: string;
  className: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  errorMessage?: string;
  stackTrace?: string;
}
```

#### 服务层设计

新增 `TestReportService`:

```typescript
class TestReportService {
  async parseAndStore(format: string, xmlOrJson: string, runId: string, stageId: string): Promise<TestReport> {
    const parser = this.getParser(format);
    const result = parser.parse(xmlOrJson);
    return this.repository.create({ ...result, runId, stageId });
  }

  async getReport(runId: string, stageId: string): Promise<TestReport[]> { ... }
  async getTrend(pipelineId: string, limit: number): Promise<TestTrendData[]> { ... }
}
```

Parser 策略:

```typescript
interface TestReportParser {
  parse(raw: string): TestReportData;
}

class JUnitXmlParser implements TestReportParser { ... }
class JestJsonParser implements TestReportParser { ... }
class PytestJsonParser implements TestReportParser { ... }
class GoTestParser implements TestReportParser { ... }
```

#### 执行层集成

在 `TaskRunner` 新增 `test/*` type:

```typescript
case 'test/':
  return this.executeTestTask(task, signal, sanitizer);
```

`executeTestTask` 逻辑:
1. 执行测试命令（如 `npm test`、`pytest`、`go test`）
2. 解析测试输出（检测 XML/JSON 报告文件）
3. 调用 `TestReportService.parseAndStore()`
4. 将报告链接注册为 task output
5. 如果测试失败，返回 FAILED status

#### API 设计

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/pipeline-runs/:runId/stages/:stageId/test-reports` | GET | 获取测试报告 |
| `/api/v1/pipeline-runs/:runId/stages/:stageId/test-reports` | POST | 上传测试报告 |
| `/api/v1/pipelines/:pipelineId/test-trend` | GET | 测试趋势 |
| `/api/v1/test-reports/:id/test-cases` | GET | 测试用例详情 |
| `/api/v1/test-reports/:id/coverage` | GET | 覆盖率详情 |

#### 前端配置界面

- `TestReportViewer`: 测试结果展示（通过率、失败用例、堆栈跟踪）
- `TestTrendChart`: 历史趋势图
- `CoverageReport`: 覆盖率报告（行覆盖、分支覆盖）
- Pipeline YAML 编辑器中新增 `test` step type 配置

### 4. 依赖与风险

- **外部依赖**: XML 解析库 (`fast-xml-parser`)
- **安全风险**: 上传的测试报告可能包含敏感信息，需脱敏
- **性能风险**: 大型测试报告（10万+用例）的解析和存储
- **兼容性**: 需要支持多种测试框架输出格式

---

## 缺失-5: PR/MR 专用触发与过滤（P1）

### 1. 竞品技术实现分析

#### GitHub Actions
- **触发事件**: `pull_request`, `pull_request_target`, `pull_request_review`
- **安全模型**: `pull_request` 使用 fork 的基础权限，`pull_request_target` 使用目标分支权限（危险但强大）
- **路径过滤**: `paths: ['src/**']`, `paths-ignore: ['docs/**']`
- **状态检查**: 通过 `conclusion` 字段在 PR 页面显示 ✅/❌
- **PR 评论**: `actions/github-script` 可在 PR 添加评论

#### GitLab CI
- **触发事件**: `merge_request_events`, `push_events`
- **Pipeline 关联**: MR 页面直接显示 pipeline 状态
- **规则过滤**: `rules: - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'`
- **Approvals**: 支持 pipeline 通过作为 MR 批准条件

#### 阿里云效
- **触发**: 代码评审创建/更新时触发
- **质量门禁**: 代码检查通过后可自动合并
- **评论集成**: 检查结果直接显示在代码行上

#### 对比总结

| 维度 | GitHub Actions | GitLab CI | 阿里云效 | Orion（现状） |
|------|---------------|-----------|---------|--------------|
| PR 事件 | 完整 | 完整 | 基本 | **无** |
| 路径过滤 | 支持 | 支持 | 支持 | 不支持 |
| 状态回写 | Checks API | Pipeline API | API | 无 |
| 安全模型 | pull_request vs target | 统一权限 | 统一权限 | 无 |
| MR 评论 | 支持 | 内联 | 内联 | 无 |

### 2. Orion 当前代码详细审查

**现有 SCMWebhookService** (`src/services/pipeline/SCMWebhookService.ts`):

- 仅处理 `push` 事件:
  ```typescript
  async handleGitHubPush(payload: any, signature?: string): Promise<SCMWebhookEvent> {
    // eventType: 'push'
  }
  async handleGitLabPush(payload: any, token?: string): Promise<SCMWebhookEvent> {
    // eventType: 'push'
  }
  ```

- `SCMWebhookEvent` 接口:
  ```typescript
  interface SCMWebhookEvent {
    provider: 'github' | 'gitlab';
    eventType: string;  // 只处理 'push'
    repository: string;
    branch: string;
    commitSha: string;
    // ...缺少 PR 特有字段
  }
  ```

- `SCMTriggerRule` 接口:
  ```typescript
  interface SCMTriggerRule {
    pipelineId: string;
    repository: string;
    branchPattern: string;
    events: string[];  // 只支持事件类型，无路径过滤
  }
  ```

- `TriggerType` 枚举 (`src/models/PipelineRun.ts`):
  ```typescript
  enum TriggerType { MANUAL, API, EVENT, SCHEDULE }
  ```
  缺少 `PULL_REQUEST` 类型。

**扩展点分析**:

| 文件 | 行 | 需要改什么 |
|------|----|-----------|
| `SCMWebhookService.ts` | 全文 | 新增 PR 事件处理方法 |
| `PipelineRun.ts` | 15-20 `TriggerType` | 添加 `PULL_REQUEST` |
| `SCMWebhookService.ts` | 36-42 `SCMTriggerRule` | 添加路径过滤规则 |
| `SCMWebhookEvent` | 20-32 | 添加 PR 特有字段 |
| `api/webhook-routes.ts` | 全文 | 添加 PR webhook 接收端点 |

### 3. 技术实现方案

#### 数据模型变更

扩展 `SCMWebhookEvent`:

```typescript
interface SCMWebhookEvent {
  // ...existing fields
  // PR 特有字段
  pullRequest?: {
    number: number;
    title: string;
    sourceBranch: string;
    targetBranch: string;
    author: string;
    isDraft: boolean;
    changedFiles: string[];
    action: 'opened' | 'synchronize' | 'closed' | 'reopened' | 'labeled';
    labels: string[];
  };
}
```

扩展 `SCMTriggerRule`:

```typescript
interface SCMTriggerRule {
  // ...existing fields
  pathPatterns?: string[];      // 如 ['src/**', '!docs/**']
  ignorePaths?: string[];
  prActions?: string[];         // 如 ['opened', 'synchronize']
  labelFilter?: { include?: string[], exclude?: string[] };
  draftPolicy?: 'skip' | 'run'; // 是否跳过 draft PR
}
```

#### 服务层设计

新增 `PullRequestService`:

```typescript
class PullRequestService {
  // GitHub
  async handlePullRequestEvent(payload: GitHubPREvent): Promise<SCMWebhookEvent> { ... }
  // GitLab
  async handleMergeRequestEvent(payload: GitLabMREvent): Promise<SCMWebhookEvent> { ... }

  // 状态回写
  async updatePRCheckStatus(
    provider: 'github' | 'gitlab',
    repo: string,
    sha: string,
    check: { name: string; status: 'pending'|'success'|'failure'; detailsUrl: string }
  ): Promise<void> { ... }

  // PR 评论
  async postPRComment(
    provider: 'github' | 'gitlab',
    repo: string,
    prNumber: number,
    comment: string
  ): Promise<void> { ... }
}
```

#### 路径过滤

使用现有 `micromatch` 或 `minimatch` 库:

```typescript
import micromatch from 'micromatch';

function shouldRunForPaths(changedFiles: string[], patterns: string[], ignorePatterns: string[]): boolean {
  if (patterns.length === 0) return true;
  const matching = micromatch(changedFiles, patterns);
  const excluded = ignorePatterns.length > 0
    ? micromatch(matching, ignorePatterns)
    : [];
  return matching.length > excluded.length;
}
```

#### 安全模型

**PR 触发安全策略**:

| 策略 | 描述 | 适用场景 |
|------|------|---------|
| `safe` | 使用 fork 基础权限，不注入 secrets | 开源项目 |
| `trusted` | 使用目标分支权限，可注入只读 secrets | 内部项目 |
| `full` | 使用完整权限（等同 push 触发） | 仅限私有 repo |

#### API 设计

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/scm/webhooks/pull-request` | POST | 接收 PR/MR webhook |
| `/api/v1/scm/webhooks/merge-request` | POST | 接收 GitLab MR webhook |
| `/api/v1/scm/pull-requests/:repo/:number/status` | GET | 查询 PR 状态检查 |
| `/api/v1/scm/pull-requests/:repo/:number/checks` | GET | 查询 PR 所有检查 |

#### 前端配置界面

- `PRTriggerConfig`: PR 触发规则配置（分支过滤、路径过滤、action 过滤）
- `PRCheckStatus`: PR 页面显示的检查状态列表
- `PRWebhookTest`: Webhook 测试工具

### 4. 依赖与风险

- **外部依赖**: GitHub API (`@octokit/rest`)、GitLab API (`@gitbeaker/rest`)
- **安全风险**: `pull_request_target` 类事件可能泄露 secrets，必须实现安全模型
- **性能风险**: PR 同步事件可能频繁触发，需要 debounce 机制
- **兼容性**: 需要同时支持 GitHub PR 和 GitLab MR

---

## 缺失-6: 多架构构建 (amd64/arm64)（P2）

### 1. 竞品技术实现分析

#### Zadig
- **配置**: `platforms: [linux/amd64, linux/arm64]`
- **实现**: buildx + QEMU 交叉编译
- **Manifest**: 自动创建 multi-arch manifest list

#### GitHub Actions
- **配置**: `platforms: linux/amd64,linux/arm64`
- **实现**: `docker/build-push-action` + QEMU setup action
- **交叉编译**: 使用 `tonistiigi/binfmt` 注册 QEMU

#### Orion 现状
- `BuildxBuilderService` 已实现完整的多架构构建
- `BuildxBuildOptions` 支持 `platforms: string[]`
- `BuildxBuilderController` 有 `/build/buildx` API
- `ArtifactService` 有 `MultiArchBuildConfig`、`buildMultiArch()` 方法

### 2. Orion 当前代码详细审查

**已实现的代码**:

- `src/services/build/BuildxBuilderService.ts`: 完整的多架构构建实现
  - `buildMultiArch(options)`: 遍历 platforms 执行构建
  - `buildPlatform(options)`: 单平台构建
  - `pushImages(options)`: 推送多架构 manifest

- `src/services/artifact/ArtifactService.ts` (17-80行):
  ```typescript
  type BuildArchitecture = 'amd64' | 'arm64' | 'arm/v7' | ...
  interface MultiArchBuildConfig { architectures, parallel, maxConcurrency, ... }
  interface MultiArchBuildResult { buildId, results, successCount, ... }
  ```
  - `buildMultiArch(baseInput, config)`: 并行多架构构建

- `src/api/build-routes.ts` (340-372行): `/build/buildx` 路由

**关键缺口**: 这些服务 **未接入 Pipeline 执行流**。
- 无法通过 Pipeline YAML 触发多架构构建
- 构建结果未关联到 PipelineRun
- 前端无配置界面

### 3. 技术实现方案

通过 `docker/build` step type 接入 Pipeline（同 Gap-1 的实现）:

```yaml
stages:
  - name: multi-arch-build
    steps:
      - name: build-and-push
        uses: docker/build@v1
        with:
          platforms: [linux/amd64, linux/arm64]
          image: registry.example.com/myapp
          tags: [latest, '${git.sha}']
          push: true
```

利用现有 `BuildxBuilderService.buildMultiArch()` 和 `ArtifactService.buildMultiArch()`，仅需:
1. 在 `TaskRunner` 添加 `docker/build` type 处理
2. 将 task parameters 映射到 `BuildOptions`
3. 调用现有 `BuildxBuilderService`

### 4. 依赖与风险

- **外部依赖**: QEMU (交叉编译)、buildx
- **风险**: ARM64 构建需要 QEMU 模拟，速度慢（比原生慢 5-10x）
- **已有代码**: 70% 代码已就绪，主要缺 Pipeline 集成

---

## 缺失-7: 图形化 Pipeline 编辑器（P2）

### 1. 竞品技术实现分析

| 竞品 | 编辑器类型 | 拖拽支持 | 实时验证 | 版本对比 |
|------|-----------|---------|---------|---------|
| Jenkins Blue Ocean | 拖拽式 | 支持 | 有限 | 无 |
| GitLab CI | YAML + 可视化 | 部分 | 语法检查 | 支持 |
| 阿里云效 | 拖拽 + 表单 | 完全 | 实时验证 | 支持 |
| Zadig | YAML + 可视化 | 拖拽 | 实时验证 | 支持 |

### 2. Orion 当前代码详细审查

**后端就绪**:
- `PipelineTemplateService`: 模板 CRUD、版本管理、实例化
- `parsePipelineYaml()`: YAML 解析
- `PipelineExecutionQueue`: 执行队列

**前端缺失**:
- 无可视化 DAG 编辑器
- 无拖拽组件
- 仅依赖 YAML 文本编辑

### 3. 技术实现方案

推荐使用 React Flow 或 X6 实现:
- 节点: Stage（可折叠显示内部 Tasks）
- 边: 依赖关系
- 面板: Stage 配置表单
- 同步: 图形编辑 <-> YAML 双向绑定

### 4. 依赖与风险

- **前端库**: `reactflow` / `@antv/x6`
- **风险**: YAML 到 DAG 的双向转换可能丢失注释和格式
- **已有代码**: 后端完全就绪

---

## 缺失-8: 制品版本管理（P2）

### 1. 竞品技术实现分析

| 维度 | JFrog Artifactory | Nexus | Zadig | Orion（现状） |
|------|------------------|-------|-------|--------------|
| 语义化版本 | 支持 | 支持 | 支持 | 部分 |
| 版本提升 | 支持 | 支持 | 支持 | 无 |
| 版本关系 | 依赖图 | 依赖图 | 简单关联 | 简单关联 |
| 版本溯源 | 完整 | 完整 | 基本 | 基本 |

### 2. Orion 当前代码详细审查

**现有代码**:
- `ArtifactService` (`src/services/pipeline/ArtifactService.ts` 82-143行):
  - `upload()` 支持 `version`, `commitSha`, `branch` 字段
  - 通过 `ArtifactVersionRepository` 记录版本追踪
- `ArtifactService` (`src/services/artifact/ArtifactService.ts`):
  - 基于 PostgreSQL 的制品管理
  - 支持多架构 metadata

**缺失**:
- 无版本提升（dev -> staging -> prod）
- 无版本关系图
- 无语义化版本验证
- 无版本标签（如 `latest`, `stable`, `rc`）

### 3. 技术实现方案

新增 `ArtifactVersionService`:

```typescript
class ArtifactVersionService {
  async promoteVersion(versionId: string, fromEnv: string, toEnv: string): Promise<void> { ... }
  async getVersionLineage(artifactName: string, version: string): Promise<VersionLineage> { ... }
  async tagVersion(versionId: string, tag: string): Promise<void> { ... }
  async validateSemver(version: string): boolean { ... }
}
```

### 4. 依赖与风险

- 现有 `ArtifactVersionRepository` 已存在
- 主要缺版本提升和关系管理功能

---

## 缺失-9: GPU 资源分配（P3）

### 1. 竞品技术实现分析

GPU 资源分配主要用于 AI/ML 训练和推理场景。

### 2. Orion 当前代码详细审查

`src/models/Task.ts`:
```typescript
interface TaskResourceQuota {
  cpu?: string;
  memory?: string;
  timeout?: number;
  // 缺少 gpu 字段
}
```

### 3. 技术实现方案

扩展 `TaskResourceQuota`:

```typescript
interface TaskResourceQuota {
  cpu?: string;
  memory?: string;
  gpu?: {
    count: number;           // GPU 数量
    type?: string;           // 'nvidia-tesla-v100', 'nvidia-a100'
    shared?: boolean;        // 是否支持 MIG 共享
  };
  timeout?: number;
}
```

K8s 集成: 在 `K8sBuildExecutor.buildK8sPodSpec` 中添加:
```typescript
resources: {
  limits: {
    'nvidia.com/gpu': gpuConfig.count.toString(),
  },
}
```

### 4. 依赖与风险

- 需 K8s NVIDIA Device Plugin
- GPU 资源昂贵，需要配额管理

---

## 缺失-10: 共享库机制（P3）

### 1. 竞品技术实现分析

#### Jenkins Shared Libraries
- **语法**: `@Library('my-shared-lib') _`
- **结构**: Git repo，`vars/` 目录定义全局函数，`src/` 定义 Groovy 类
- **版本**: 支持分支/标签引用

#### GitHub Actions Composite Actions
- **语法**: `uses: ./.github/actions/my-action` 或 `uses: org/repo@v1`
- **结构**: action.yml 定义输入输出和运行步骤

#### 对比总结

| 维度 | Jenkins | GitHub Actions | Orion（现状） |
|------|---------|---------------|--------------|
| 定义方式 | Groovy | YAML | **无** |
| 版本控制 | 分支/标签 | 分支/标签 | 无 |
| 参数传递 | 支持 | inputs/outputs | 无 |
| 嵌套调用 | 支持 | 支持 | 无 |

### 2. Orion 当前代码详细审查

**无共享库相关代码**。但有以下可扩展的基础:

- `PipelineTemplateService`: 可作为"预定义 pipeline 片段"的基础
- Plugin system (`src/services/plugin-executor-service`): 插件机制可作为共享功能分发
- `PipelineStep.uses`: 支持 `uses: '...'` 语法，可引用外部 action

### 3. 技术实现方案

设计 Orion Shared Actions:

```yaml
# .orion/actions/build-and-test/action.yml
name: 'Build and Test'
description: 'Common build and test steps'
inputs:
  node-version:
    description: 'Node.js version'
    default: '18'
  test-command:
    description: 'Test command'
    default: 'npm test'
runs:
  steps:
    - uses: git/checkout@v1
    - uses: npm/install@v1
      with:
        node-version: '${inputs.node-version}'
    - uses: npm/run@v1
      with:
        command: 'build'
    - uses: test/run@v1
      with:
        command: '${inputs.test-command}'
```

Pipeline 中使用:
```yaml
stages:
  - name: build
    steps:
      - uses: ./.orion/actions/build-and-test
        with:
          node-version: '20'
```

新增 `SharedActionService`:

```typescript
class SharedActionService {
  async resolveActionRef(ref: string): Promise<PipelineStep[]> {
    // Local: ./.orion/actions/name -> 读取 action.yml
    // Remote: org/repo@v1 -> git clone + 读取
    // Registry: registry.actions/name@v1 -> API 获取
  }
}
```

### 4. 依赖与风险

- 可复用现有 `PipelineTemplateService` 和 plugin system
- 需要定义 action 规范（YAML schema）
- 安全: 外部 action 需要审查机制

---

## 实施优先级建议

### Phase 1 (P0) - 核心 CI 能力补齐
1. **Docker 镜像构建** (Gap-1)
   - 将 `BuildxBuilderService` 接入 `TaskRunner`
   - 实现 `docker/build` step type
   - Kaniko K8s 集成（替换 MockK8sClient）
2. **构建缓存执行层** (Gap-2)
   - 实现 `CacheRestoreSaveService`
   - 集成到 `StageExecutor`
   - 添加 `hashFiles()` 模板函数

### Phase 2 (P1) - 生产就绪
3. **容器化构建环境** (Gap-3)
   - 策略模式抽象执行器
   - K8s 真实客户端集成
   - Kaniko 无特权构建
4. **测试报告收集** (Gap-4)
   - `TestReportService` + 解析器
   - `test/*` step type
5. **PR/MR 触发** (Gap-5)
   - PR webhook 处理
   - 路径过滤
   - 状态回写

### Phase 3 (P2) - 体验提升
6. **多架构构建** (Gap-6) — 代码已有，仅需 Pipeline 集成
7. **图形化编辑器** (Gap-7) — 前端工作量
8. **制品版本管理** (Gap-8)

### Phase 4 (P3) - 高级能力
9. **GPU 资源分配** (Gap-9)
10. **共享库机制** (Gap-10)

---

## 关键发现

1. **Orion 有大量"骨架代码"但未完全激活**: BuildxBuilderService、BuildCacheService、K8sBuildExecutor、ArtifactService 的多架构支持都已实现，但都未与 Pipeline 执行流打通。这是最快速能出成果的方向。

2. **TaskRunner 的 type 分发机制是天然扩展点**: 通过 `executeByType` 的 type 前缀匹配，新增 `docker/*`、`test/*` 等 task type 非常容易，不需要修改 PipelineEngine。

3. **RunnerPoolService 提供了远程执行的抽象**: 容器化构建可以通过 RunnerPoolService 分发到 K8s 节点执行，无需修改 TaskRunner 核心逻辑。

4. **SCMWebhookService 是最需要重构的组件**: 当前只处理 push 事件，需要扩展事件类型、增加 PR/MR 专用处理逻辑、添加路径过滤和状态回写。

5. **前端是最大的缺口**: 图形化 Pipeline 编辑器、测试报告可视化、制品版本管理 UI 等都需要大量前端开发，这是整体进度的主要制约因素。
