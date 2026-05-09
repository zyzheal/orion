# Orion CI 自研增强方案设计

> 方案日期: 2026-05-09
> 分支: `feat/frontend-gap-implementation`
> 分析范围: 10 大 CI 配置缺口全覆盖
> 设计策略: 渐进式集成 — 不改 PipelineEngine 核心逻辑，只在边缘扩展

---

## 一、方案概述

### 1.1 设计目标

利用 Orion 已有的骨架代码（BuildxBuilderService、BuildCacheService、K8sBuildExecutor、ArtifactService），通过 TaskRunner 的 type 分发机制和 StageExecutor 的生命周期钩子，逐个打通 10 个缺失功能的执行链路。

**不改 PipelineEngine，不改 StageExecutor 核心逻辑，只在边缘扩展。**

### 1.2 缺失功能清单与优先级

| 序号 | 功能 | 优先级 | Orion 现状 | 策略 |
|------|------|--------|-----------|------|
| 1 | Docker 镜像构建 | P0 | BuildxBuilderService 存在但未接入 PipelineEngine | TaskRunner 新增 `docker/*` type |
| 2 | 构建缓存执行层 | P0 | BuildCacheService 数据模型完整，未在执行层使用 | StageExecutor 前后调用缓存恢复/保存 |
| 3 | 容器化构建环境 | P1 | K8sBuildExecutor 使用 Mock Client | 新增 ContainerExecutor 策略 |
| 4 | 测试报告收集 | P1 | 无 TestReport 相关代码 | 新建 TestReportService + `test/*` type |
| 5 | PR/MR 触发与过滤 | P1 | SCMWebhookService 只处理 push 事件 | 扩展 SCMWebhookService + 新建 PullRequestService |
| 6 | 多架构构建 | P2 | BuildxBuilderService 支持，未接入 Pipeline | 复用已有代码，仅需 Pipeline 集成 |
| 7 | 图形化 Pipeline 编辑器 | P2 | 前端无可视化编辑器，后端就绪 | 新建 React Flow 组件 |
| 8 | 制品版本管理 | P2 | ArtifactService 有版本追踪，缺独立版本管理 | 新建 ArtifactVersionService |
| 9 | GPU 资源分配 | P3 | TaskResourceQuota 只有 cpu/memory | 扩展模型 + K8s 集成 |
| 10 | 共享库机制 | P3 | 无任何共享库代码 | 新建 SharedActionService |

### 1.3 技术栈

- **后端**: Node.js + TypeScript + Fastify
- **引擎**: PipelineEngine → StageExecutor → TaskRunner（不变）
- **数据库**: PostgreSQL（Repository pattern）
- **构建**: Docker buildx + Kaniko（可选）
- **K8s**: `@kubernetes/client-node`（替换 MockK8sClient）
- **前端**: React + Vite + Ant Design + React Flow
- **测试**: Jest（backend）+ Vitest（frontend）

---

## 二、模块详细设计

### 模块 1: Docker 镜像构建（P0）

#### 2.1.1 功能描述

在 Pipeline YAML 中支持 `docker/build` 和 `docker/push` step type，实现原生 Docker 镜像构建能力。

#### 2.1.2 YAML 配置示例

```yaml
stages:
  - name: docker-build
    runsOn: docker-runner
    steps:
      - name: build-image
        uses: docker/build@v1
        with:
          context: .
          dockerfile: Dockerfile
          image: registry.example.com/myapp
          tags: [latest, '${git.sha}']
          platforms: [linux/amd64]
          cache:
            from: type=registry,ref=registry.example.com/myapp:buildcache
            to: type=registry,ref=registry.example.com/myapp:buildcache
          push: true
          buildArgs:
            NODE_ENV: production
```

#### 2.1.3 TaskRunner 扩展

**文件**: `orion-platform-service/src/engine/TaskRunner.ts`

在 `executeByType` 方法（约 419-443 行）中新增：

```typescript
case 'docker/':
  return this.executeDockerTask(task, signal, sanitizer);
```

新增 `executeDockerTask` 方法：

```typescript
private async executeDockerTask(
  task: Task,
  signal?: AbortSignal,
  sanitizer?: StreamSecretSanitizer,
): Promise<Record<string, unknown>> {
  const action = task.type.split('/')[1]; // 'build', 'push', 'scan'
  const workspace = this.getTaskWorkspace(task, 'docker');

  switch (action) {
    case 'build':
      return this.executeDockerBuild(task, workspace, signal);
    case 'push':
      return this.executeDockerPush(task, workspace, signal);
    case 'scan':
      return this.executeDockerScan(task, workspace, signal);
    default:
      throw new Error(`Unknown docker action: ${action}`);
  }
}
```

#### 2.1.4 BuildxBuilderService 改造

**文件**: `orion-platform-service/src/services/build/BuildxBuilderService.ts`

当前问题：使用 `exec()` 同步执行，无流式日志。

改造方案：将 `execAsync()` 替换为 `spawn()` 流式执行：

```typescript
// 改造前（同步）
const { stdout } = await execAsync(`docker buildx build ...`);

// 改造后（流式）
const child = spawn('docker', args, {
  cwd: workspace,
  stdio: ['ignore', 'pipe', 'pipe'],
  signal,
});

child.stdout.on('data', (data) => this.logStream.write(data));
child.stderr.on('data', (data) => this.logStream.write(data));
```

#### 2.1.5 DIND 策略

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|---------|
| Kaniko（无 daemon） | 无特权运行，K8s 友好，支持安全策略 | 不支持所有 Dockerfile 语法 | **生产默认** |
| K8s Pod + DIND sidecar | 安全隔离，多租户，完整 Dockerfile 支持 | 需 `--privileged`，资源消耗大 | 生产备选 |
| 本机 Docker daemon | 简单，无需额外组件 | **严重安全风险，容器可逃逸到宿主机** | **仅限单租户开发，禁用 secrets 注入** |

**默认方案**: 生产环境强制 Kaniko，开发环境可选本机 Docker（但必须在配置中显式启用 `docker.daemon.mode=dev`，且此时禁用 secrets 注入）。增加 `--security-opt=no-new-privileges` 和 AppArmor/Seccomp profile。

#### 2.1.6 输出变量

Docker build 成功后，注册以下 task outputs：

| 变量名 | 描述 | 示例 |
|--------|------|------|
| `imageId` | 镜像 ID | `sha256:abc123...` |
| `imageDigest` | 镜像摘要 | `sha256:def456...` |
| `imageSize` | 镜像大小（字节） | `45678901` |
| `imageName` | 完整镜像名 | `registry.example.com/myapp:latest` |

#### 2.1.7 依赖

- 无新增外部依赖
- 复用 `WorkspaceIsolator` 管理构建上下文路径
- 复用 `SecretsService` 处理 registry 认证

---

### 模块 2: 构建缓存执行层（P0）

#### 2.2.1 功能描述

在 Stage 执行前后自动恢复和保存缓存，加速依赖安装和构建过程。

#### 2.2.2 YAML 配置示例

```yaml
stages:
  - name: build
    cache:
      enabled: true
      key: "npm-${hashFiles('**/package-lock.json')}"
      paths: ["node_modules", "~/.npm"]
      restoreKeys: ["npm-", "npm-fallback-"]
    steps:
      - name: install
        uses: npm/install@v1
```

#### 2.2.3 StageExecutor 集成

**关键设计决策**: StageExecutor 接收的是已解析的 `Stage` 域模型，不持有原始 YAML。因此不能在 StageExecutor 中通过 `getYamlStage()` 反向查找 YAML。

**正确方案**: 在 `PipelineEngine.parseAndValidate()` 阶段，将 YAML 中的 `cache` 配置提取出来，存入 `Stage.metadata` 字段：

```typescript
// PipelineEngine.parseAndValidate() 中
for (const yamlStage of yamlSpec.stages) {
  const stage = this.createStageFromYaml(yamlStage);
  if (yamlStage.cache) {
    stage.metadata.cacheConfig = yamlStage.cache; // 缓存配置注入 metadata
  }
}
```

在 `StageExecutor.executeStage` 中直接从 Stage 对象读取：

```typescript
async executeStage(runId: string, stage: Stage, tasks: Task[]): Promise<StageResult> {
  // 1. 恢复缓存（从 stage.metadata 读取，非反向查找 YAML）
  const cacheConfig = stage.metadata?.cacheConfig as PipelineStageCache | undefined;
  if (cacheConfig?.enabled) {
    const restoreResult = await this.cacheRestoreSave.restoreCache(runId, stage.name, cacheConfig);
    this.logCacheRestore(runId, restoreResult);
  }

  // 2. 执行任务（现有逻辑）
  const result = await this.runTasks(tasks);

  // 3. 保存缓存（阶段成功后）
  if (result.success && cacheConfig?.enabled) {
    await this.cacheRestoreSave.saveCache(runId, stage.name, cacheConfig);
  }

  return result;
}
```

#### 2.2.4 新建 CacheRestoreSaveService

**文件**: `orion-platform-service/src/services/build/CacheRestoreSaveService.ts`

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

#### 2.2.5 缓存键模板函数

扩展 `ExpressionEvaluator`，新增缓存专用函数：

| 函数 | 描述 | 示例 |
|------|------|------|
| `hashFiles(pattern)` | 文件内容 hash | `hashFiles('**/package-lock.json')` |
| `runner.os` | 操作系统 | `'Linux'` |
| `env.VAR` | 环境变量引用 | `env.NODE_VERSION` |

#### 2.2.6 存储驱动

新建 `CacheStorageDriver` 接口：

```typescript
interface CacheStorageDriver {
  compress(paths: string[]): Promise<string>;
  decompress(archivePath: string, targetDir: string): Promise<void>;
  upload(localPath: string): Promise<string>;
  download(storagePath: string, localPath: string): Promise<void>;
}

class LocalStorageDriver implements CacheStorageDriver { ... }
class S3StorageDriver implements CacheStorageDriver { ... }
class NFSStorageDriver implements CacheStorageDriver { ... }
```

#### 2.2.7 依赖

- 新增依赖: `tar`（压缩/解压）, `aws-sdk`（S3 后端，可选）
- 复用: `BuildCacheService`（已有）, `BuildCacheConfig`/`CacheEntry` 模型（已有）

---

### 模块 3: 容器化构建环境（P1）

#### 2.3.1 功能描述

支持在容器内执行构建任务，实现构建环境隔离和可复现。

#### 2.3.2 YAML 配置示例

```yaml
stages:
  - name: build
    container:
      image: node:18-alpine
      resources:
        cpu: '500m'
        memory: '512Mi'
    steps:
      - name: install
        uses: npm/install@v1
```

#### 2.3.3 数据模型变更

在 `PipelineStage` 新增容器配置：

```typescript
interface PipelineStage {
  // ...existing fields
  container?: {
    image: string;
    command?: string[];
    volumes?: VolumeMount[];
    resources?: {
      cpu?: string;
      memory?: string;
    };
    env?: Record<string, string>;
  };
}
```

#### 2.3.4 ContainerExecutor 策略模式

**文件**: `orion-platform-service/src/engine/ContainerExecutor.ts`（新建）

**统一 ExecutionResult 接口** — 三种执行器的输出、日志、退出码处理方式不同，必须定义统一格式确保 Task 状态一致性：

```typescript
interface ExecutionResult {
  exitCode: number;
  stdout: string | ReadableStream;
  stderr: string | ReadableStream;
  metadata: {
    executorType: 'local' | 'docker' | 'k8s';
    durationMs: number;
    containerId?: string;
    podName?: string;
  };
}

interface ContainerExecutor {
  execute(
    task: Task,
    containerSpec: ContainerSpec,
    signal: AbortSignal,
  ): Promise<ExecutionResult>;
}

class LocalSpawnExecutor implements ContainerExecutor {
  // 当前 TaskRunner.spawnCommand 逻辑迁移到此
  // 返回: { exitCode, stdout: string, stderr: string, metadata: { executorType: 'local', ... } }
}

class DockerExecutor implements ContainerExecutor {
  // docker run --rm -v workspace:/workspace <image> <command>
  // 返回: { exitCode, stdout: stream, stderr: stream, metadata: { executorType: 'docker', containerId } }
}

class KubernetesExecutor implements ContainerExecutor {
  // K8s Pod 创建 + 日志流
  // 返回: { exitCode, stdout: stream, stderr: stream, metadata: { executorType: 'k8s', podName } }
  // 需要替换 MockK8sClient 为真实客户端
}
```

#### 2.3.5 TaskRunner 集成

在 `TaskRunner.run()` 方法中增加容器化执行分支：

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

  // 默认：本地 spawn（保持现有行为）
  return this.executeByType(task, signal, sanitizer);
}
```

#### 2.3.6 K8sBuildExecutor 真实化

**文件**: `orion-platform-service/src/services/build/K8sBuildExecutor.ts`

将 `MockK8sClient` 替换为 `@kubernetes/client-node` 真实客户端：

```typescript
import * as k8s from '@kubernetes/client-node';

class RealK8sClient {
  private kc: k8s.KubeConfig;
  private coreV1Api: k8s.CoreV1Api;
  private batchV1Api: k8s.BatchV1Api;

  constructor() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();
    this.coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
    this.batchV1Api = this.kc.makeApiClient(k8s.BatchV1Api);
  }

  async createJob(jobSpec: k8s.V1Job): Promise<k8s.V1Job> {
    return this.batchV1Api.createNamespacedJob('orion-build', jobSpec);
  }

  async watchJobStatus(jobName: string): Promise<k8s.V1Job> {
    // 轮询或 watch 实现
  }

  async getJobLogs(jobName: string): Promise<string> {
    return this.coreV1Api.readNamespacedPodLog(...);
  }
}
```

#### 2.3.7 依赖

- 新增依赖: `@kubernetes/client-node`
- 复用: `RunnerPoolService`（远程 Runner 分发）, `WorkspaceIsolator`（workspace 挂载）

---

### 模块 4: 测试报告收集（P1）

#### 2.4.1 功能描述

解析多种测试框架输出（JUnit XML、Jest JSON、Pytest 等），存储测试报告和覆盖率数据，提供查询 API。

#### 2.4.2 YAML 配置示例

```yaml
stages:
  - name: test
    steps:
      - name: unit-test
        uses: test/unit@v1
        with:
          command: npm test -- --coverage --reporters=jest-junit
          reportFormat: jest
          reportPath: junit.xml
          coveragePath: coverage/coverage-summary.json
```

#### 2.4.3 数据模型

**文件**: `orion-platform-service/src/models/TestReport.ts`（新建）

**关键设计决策**: `test_cases` 不内嵌在 `TestReport` 中。10 万条用例 × 每条约 200 字节 = 约 20MB JSON，直接存入 PostgreSQL JSONB 字段会导致单行过大、查询性能差、无法索引。拆分为独立表。

`TestReport` 表（汇总表）：

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
  coverage?: CoverageSummary;
  uploadedAt: Date;
  // testCases 不内嵌，通过 reportId 关联到 test_cases 表
}
```

`TestCase` 表（独立存储）：

```typescript
interface TestCase {
  id: string;
  reportId: string;         // 外键 → test_reports.id
  name: string;
  className: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  errorMessage?: string;
  stackTrace?: string;
}
```

数据库设计：

```sql
CREATE TABLE test_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  stage_id UUID NOT NULL,
  task_id UUID NOT NULL,
  format VARCHAR(20) NOT NULL,
  total_tests INT NOT NULL,
  passed INT NOT NULL,
  failed INT NOT NULL,
  skipped INT NOT NULL,
  duration_ms INT NOT NULL,
  coverage_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES test_reports(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  class_name VARCHAR(500),
  status VARCHAR(20) NOT NULL,
  duration_ms INT,
  error_message TEXT,
  stack_trace TEXT
);

CREATE INDEX idx_test_cases_report ON test_cases(report_id);
CREATE INDEX idx_test_cases_status ON test_cases(report_id, status);
CREATE INDEX idx_test_reports_run ON test_reports(run_id);
```

interface CoverageSummary {
  lines: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  statements: { total: number; covered: number; pct: number };
}
```

#### 2.4.4 TestReportService

**文件**: `orion-platform-service/src/services/pipeline/TestReportService.ts`（新建）

```typescript
class TestReportService {
  async parseAndStore(
    format: string,
    rawReport: string,
    runId: string,
    stageId: string,
    taskId: string,
  ): Promise<TestReport> {
    const parser = this.getParser(format);
    const result = parser.parse(rawReport);
    return this.repository.create({ ...result, runId, stageId, taskId });
  }

  async getReport(runId: string, stageId: string): Promise<TestReport[]> { ... }
  async getTrend(pipelineId: string, limit: number): Promise<TestTrendData[]> { ... }

  private getParser(format: string): TestReportParser {
    switch (format) {
      case 'junit': return new JUnitXmlParser();
      case 'jest': return new JestJsonParser();
      case 'pytest': return new PytestJsonParser();
      case 'go': return new GoTestParser();
      default: throw new Error(`Unknown test format: ${format}`);
    }
  }
}
```

#### 2.4.5 Parser 策略

**文件**: `orion-platform-service/src/services/pipeline/test-parsers/`（新建目录）

| 文件 | 描述 |
|------|------|
| `JUnitXmlParser.ts` | 解析 JUnit XML 格式 |
| `JestJsonParser.ts` | 解析 Jest JSON 输出 |
| `PytestJsonParser.ts` | 解析 Pytest JSON 输出 |
| `GoTestParser.ts` | 解析 Go test -json 输出 |

#### 2.4.6 TaskRunner 扩展

在 `executeByType` 中新增：

```typescript
case 'test/':
  return this.executeTestTask(task, signal, sanitizer);
```

`executeTestTask` 逻辑：
1. 执行测试命令
2. 解析测试输出（检测 XML/JSON 报告文件）
3. 调用 `TestReportService.parseAndStore()`
4. 将报告链接注册为 task output
5. 如果测试失败，返回 FAILED status

#### 2.4.7 API 设计

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/pipeline-runs/:runId/stages/:stageId/test-reports` | GET | 获取测试报告 |
| `/api/v1/pipeline-runs/:runId/stages/:stageId/test-reports` | POST | 上传测试报告 |
| `/api/v1/pipelines/:pipelineId/test-trend` | GET | 测试趋势 |
| `/api/v1/test-reports/:id/test-cases` | GET | 测试用例详情 |
| `/api/v1/test-reports/:id/coverage` | GET | 覆盖率详情 |

#### 2.4.8 依赖

- 新增依赖: `fast-xml-parser`（JUnit XML 解析）
- 复用: `QualityGateService`（覆盖率指标接收）, `ArtifactService`（报告文件存储）

---

### 模块 5: PR/MR 触发与过滤（P1）

#### 2.5.1 功能描述

扩展 SCMWebhookService 支持 Pull Request / Merge Request 事件触发，提供分支过滤、路径过滤、PR 状态回写。

#### 2.5.2 数据模型变更

扩展 `SCMWebhookEvent`：

```typescript
interface SCMWebhookEvent {
  // ...existing fields
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

扩展 `SCMTriggerRule`：

```typescript
interface SCMTriggerRule {
  // ...existing fields
  pathPatterns?: string[];
  ignorePaths?: string[];
  prActions?: string[];
  labelFilter?: { include?: string[]; exclude?: string[] };
  draftPolicy?: 'skip' | 'run';
}
```

在 `TriggerType` 枚举添加 `PULL_REQUEST`：

```typescript
enum TriggerType {
  MANUAL, API, EVENT, SCHEDULE, PULL_REQUEST
}
```

#### 2.5.3 SCMWebhookService 扩展

**文件**: `orion-platform-service/src/services/pipeline/SCMWebhookService.ts`

新增 PR 事件处理方法：

```typescript
async handleGitHubPREvent(payload: any, signature?: string): Promise<SCMWebhookEvent> {
  // 1. 验证 HMAC 签名
  // 2. 提取 PR metadata
  // 3. 获取 changed files（调用 GitHub API）
  // 4. 匹配触发规则
  // 5. 返回 SCMWebhookEvent
}

async handleGitLabMREvent(payload: any, token?: string): Promise<SCMWebhookEvent> {
  // 类似实现
}
```

#### 2.5.4 PullRequestService

**文件**: `orion-platform-service/src/services/pipeline/PullRequestService.ts`（新建）

```typescript
class PullRequestService {
  // 状态回写
  async updatePRCheckStatus(
    provider: 'github' | 'gitlab',
    repo: string,
    sha: string,
    check: {
      name: string;
      status: 'pending' | 'success' | 'failure';
      detailsUrl: string;
    },
  ): Promise<void> { ... }

  // PR 评论
  async postPRComment(
    provider: 'github' | 'gitlab',
    repo: string,
    prNumber: number,
    comment: string,
  ): Promise<void> { ... }
}
```

#### 2.5.5 路径过滤

使用 `micromatch` 库：

```typescript
import micromatch from 'micromatch';

function shouldRunForPaths(
  changedFiles: string[],
  patterns: string[],
  ignorePatterns: string[],
): boolean {
  if (patterns.length === 0) return true;
  const matching = micromatch(changedFiles, patterns);
  const excluded = ignorePatterns.length > 0
    ? micromatch(matching, ignorePatterns)
    : [];
  return matching.length > excluded.length;
}
```

#### 2.5.6 安全模型

| 策略 | 描述 | 适用场景 |
|------|------|---------|
| `safe` | 使用 fork 基础权限，不注入 secrets | 开源项目 |
| `trusted` | 使用目标分支权限，可注入只读 secrets | 内部项目 |
| `full` | 使用完整权限（等同 push 触发） | 仅限私有 repo |

#### 2.5.7 防抖与并发控制

**防抖窗口**: 同一 PR 在 `debounceWindowSec`（默认 30 秒）内多次触发只执行一次，取最后一次事件。

**自动取消进行中构建**: 当 PR synchronize 事件触发新构建时，自动取消同 PR 同分支的 `status='running'` 的 PipelineRun：

```typescript
async handleGitHubPREvent(payload: any): Promise<void> {
  const { prNumber, sourceBranch, repo } = this.parsePREvent(payload);

  // 1. 防抖: 检查最近 N 秒内是否已触发
  if (this.isDebounced(prNumber, sourceBranch, 30)) return;

  // 2. 自动取消进行中的构建
  if (payload.action === 'synchronize') {
    const inProgressRuns = await this.pipelineRunRepository.findRunningByPR(
      repo, prNumber, sourceBranch
    );
    for (const run of inProgressRuns) {
      await this.pipelineEngine.cancelRun(run.id, 'superseded_by_new_pr_trigger');
    }
  }

  // 3. 触发新 Pipeline
  await this.triggerPipeline(repo, prNumber, sourceBranch, payload);
}
```

**SCMTriggerRule 新增字段**:

```typescript
interface SCMTriggerRule {
  // ...existing fields
  debounceWindowSec?: number;     // 默认 30
  autoCancelInProgress?: boolean; // 默认 true
}
```

#### 2.5.8 依赖

- 新增依赖: `@octokit/rest`（GitHub API）, `@gitbeaker/rest`（GitLab API）, `micromatch`（路径匹配）
- 复用: `SCMWebhookService`（已有 webhook 接收和签名验证）, `PipelineTriggerService`（触发调度）, `PipelineEngine`（取消 Run）

---

### 模块 6: 多架构构建（P2）

#### 2.6.1 功能描述

通过 Pipeline YAML 触发多架构 Docker 镜像构建，利用已有的 BuildxBuilderService。

#### 2.6.2 YAML 配置示例

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

#### 2.6.3 实现策略

**不需要新建 Service。** 现有代码已就绪，但需要优化构建策略：

**优化**: `buildMultiArch()` 当前为串行构建各平台，效率低。buildx 原生支持 `--platform linux/amd64,linux/arm64` **一次命令完成多架构构建**并自动创建 manifest list，比串行调用多次 `buildPlatform()` 更高效。

改造方案：

```typescript
// 改造前：串行遍历 platforms
for (const platform of platforms) {
  await this.buildPlatform({ ...options, platform });
}

// 改造后：buildx 一次命令完成
private async executeDockerBuild(task: Task, workspace: string, signal?: AbortSignal) {
  const platforms = task.parameters.platforms as string[] | undefined;

  if (platforms && platforms.length > 1) {
    // buildx 原生多架构：一次命令 + 自动 manifest list
    const args = [
      'buildx', 'build',
      '--platform', platforms.join(','),  // 'linux/amd64,linux/arm64'
      '--push',
      '-t', task.parameters.image,
      ...this.buildTags(task.parameters.tags),
      ...this.buildCacheArgs(task.parameters.cache),
      ...this.buildBuildArgs(task.parameters.buildArgs),
      task.parameters.context || '.',
    ];
    return this.spawnDockerBuild(args, workspace, signal);
  } else {
    // 单平台构建
    const options = this.mapTaskToBuildOptions(task, workspace);
    const result = await this.buildxService.buildPlatform(options);
    return this.formatResult(result);
  }
}
```

#### 2.6.4 依赖

- 无新增依赖
- 复用: `BuildxBuilderService`（已有）, `ArtifactService`（制品存储）

---

### 模块 7: 图形化 Pipeline 编辑器（P2）

#### 2.7.1 功能描述

前端实现拖拽式 Stage/Task 编辑器，实时 YAML 预览和语法校验。

#### 2.7.2 技术方案

- **图形库**: React Flow（推荐）或 @antv/x6
- **YAML 编辑**: Monaco Editor（vscode 同款）
- **校验**: js-yaml + PipelineValidator

#### 2.7.3 组件设计

**目录**: `orion-frontend/src/pages/pipeline-editor/`（新建）

| 文件 | 描述 |
|------|------|
| `PipelineEditor.tsx` | 主编辑器组件 |
| `DAGCanvas.tsx` | DAG 画布（React Flow） |
| `StageNode.tsx` | Stage 节点组件 |
| `TaskNode.tsx` | Task 节点组件 |
| `YamlPreview.tsx` | YAML 实时预览 |
| `StageConfigPanel.tsx` | Stage 配置面板 |
| `TaskConfigPanel.tsx` | Task 配置面板 |
| `usePipelineGraph.ts` | DAG 数据管理 hook |
| `yamlToGraph.ts` | YAML → 图数据转换 |
| `graphToYaml.ts` | 图数据 → YAML 转换 |

#### 2.7.4 数据流

```
YAML 输入
  ↓ (js-yaml 解析)
Pipeline Object
  ↓ (yamlToGraph)
React Flow 图数据 (nodes + edges)
  ↓ (用户编辑)
更新后的图数据
  ↓ (graphToYaml)
新 YAML 输出
```

#### 2.7.5 后端依赖

后端已就绪：
- `PipelineTemplateService` — 模板 CRUD
- `PipelineValidator` — YAML 校验
- `parsePipelineYaml()` — YAML 解析

无需后端改动。

#### 2.7.6 依赖

- 新增依赖: `reactflow`, `@monaco-editor/react`, `js-yaml`（前端）
- 无后端依赖

---

### 模块 8: 制品版本管理（P2）

#### 2.8.1 功能描述

为制品增加版本提升、版本溯源、语义化版本验证、版本标签管理。

#### 2.8.2 数据模型

**文件**: `orion-platform-service/src/models/ArtifactVersion.ts`（新建）

```typescript
interface ArtifactVersion {
  id: string;
  artifactName: string;
  version: string;          // semantic version
  commitSha: string;
  branch: string;
  pipelineRunId: string;
  stageId: string;
  environment: string;      // dev / staging / prod
  tags: string[];           // latest, stable, rc
  promotedFrom?: string;    // 上一版本 ID
  promotedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
```

#### 2.8.3 ArtifactVersionService

**文件**: `orion-platform-service/src/services/pipeline/ArtifactVersionService.ts`（新建）

```typescript
class ArtifactVersionService {
  async promoteVersion(
    versionId: string,
    fromEnv: string,
    toEnv: string,
  ): Promise<void> {
    // 1. 查询版本
    const version = await this.repository.findById(versionId);
    if (!version) throw new Error(`Version ${versionId} not found`);

    // 2. 循环引用防护: promotedFrom 不能指向自身或后代节点
    const descendants = await this.getDescendants(versionId);
    if (descendants.includes(versionId)) {
      throw new Error('Cannot promote: would create circular reference');
    }

    // 3. 创建新版本记录（promotedFrom 指向原版本）
    const newVersion = await this.repository.create({
      artifactName: version.artifactName,
      version: version.version,
      commitSha: version.commitSha,
      branch: version.branch,
      pipelineRunId: version.pipelineRunId,
      environment: toEnv,
      promotedFrom: versionId,
      promotedAt: new Date(),
      tags: version.tags,
      metadata: version.metadata,
    });

    // 4. 更新标签
    await this.tagVersion(newVersion.id, 'latest');
  }

  async getVersionLineage(
    artifactName: string,
    version: string,
  ): Promise<VersionLineage> {
    // 版本溯源链：当前版本 → promotedFrom → ... → 初始版本
    const chain: ArtifactVersion[] = [];
    const visited = new Set<string>();
    const maxDepth = 50;
    let current = await this.repository.findByNameAndVersion(artifactName, version);

    while (current && chain.length < maxDepth) {
      if (visited.has(current.id)) {
        throw new Error('Circular reference detected in version lineage');
      }
      visited.add(current.id);
      chain.push(current);
      if (!current.promotedFrom) break;
      current = await this.repository.findById(current.promotedFrom);
    }

    return { chain, hasMore: !!current };
  }

  async tagVersion(versionId: string, tag: string): Promise<void> { ... }

  async validateSemver(version: string): boolean {
    return /^\d+\.\d+\.\d+(-[a-z0-9]+)?(\+[a-z0-9]+)?$/i.test(version);
  }

  private async getDescendants(versionId: string): Promise<string[]> {
    // 查找所有 promotedFrom 直接或间接指向 versionId 的版本
    const descendants: string[] = [];
    const queue = [versionId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const parent = queue.shift()!;
      const children = await this.repository.findByPromotedFrom(parent);
      for (const child of children) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          descendants.push(child.id);
          queue.push(child.id);
        }
      }
    }

    return descendants;
  }
}
```

数据库外键约束：

```sql
ALTER TABLE artifact_versions
  ADD CONSTRAINT fk_promoted_from
  FOREIGN KEY (promoted_from) REFERENCES artifact_versions(id)
  ON DELETE SET NULL;
```

#### 2.8.4 API 设计

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/artifacts/:name/versions` | GET | 列出版本 |
| `/api/v1/artifact-versions/:id/promote` | POST | 版本提升 |
| `/api/v1/artifact-versions/:id/tag` | POST | 添加标签 |
| `/api/v1/artifacts/:name/lineage` | GET | 版本溯源链 |
| `/api/v1/artifact-versions/validate` | POST | 验证语义化版本 |

#### 2.8.5 依赖

- 无新增依赖
- 复用: `ArtifactService`（已有制品上传）, `ArtifactVersionRepository`（已有数据库表）

---

### 模块 9: GPU 资源分配（P3）

#### 2.9.1 功能描述

支持在 Task 级别请求 GPU 资源，用于 AI/ML 训练和推理场景。

#### 2.9.2 数据模型变更

扩展 `TaskResourceQuota`：

```typescript
interface TaskResourceQuota {
  cpu?: string;
  memory?: string;
  gpu?: {
    count: number;
    type?: string;    // 'nvidia-tesla-v100', 'nvidia-a100'
    shared?: boolean; // 是否支持 MIG 共享
  };
  timeout?: number;
}
```

#### 2.9.3 K8s 集成

在 `K8sBuildExecutor.buildK8sPodSpec` 中添加 GPU 资源请求：

```typescript
if (resources.gpu) {
  podSpec.containers[0].resources.limits = {
    ...podSpec.containers[0].resources.limits,
    'nvidia.com/gpu': resources.gpu.count.toString(),
  };
  if (resources.gpu.type) {
    podSpec.nodeSelector = {
      ...podSpec.nodeSelector,
      'nvidia.com/gpu-type': resources.gpu.type,
    };
  }
}
```

#### 2.9.4 RunnerPool 扩展

在 `RunnerPoolService` 新增 GPU 标签支持：

```typescript
interface RunnerCapability {
  labels: string[];
  cpu: number;
  memory: number;
  gpu?: {
    count: number;
    type: string;
  };
}
```

#### 2.9.5 依赖

- 需 K8s NVIDIA Device Plugin 部署在集群中
- 复用: `K8sBuildExecutor`（已有框架）, `RunnerPoolService`（已有调度）

---

### 模块 10: 共享库机制（P3）

#### 2.10.1 功能描述

定义 Orion Shared Actions，支持在多个 Pipeline 间复用 CI 逻辑，类似 Jenkins Shared Libraries。

#### 2.10.2 Action 定义规范

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

#### 2.10.3 Pipeline 中使用

```yaml
stages:
  - name: build
    steps:
      - uses: ./.orion/actions/build-and-test
        with:
          node-version: '20'
```

#### 2.10.4 YamlPreprocessor（替代修改 PipelineEngine）

**关键设计决策**: 为避免修改 PipelineEngine 核心逻辑（与"不改核心"原则冲突），将 SharedAction 解析提前到 YAML 解析阶段，在 `parsePipelineYaml()` **之前**完成 action 展开。

**文件**: `orion-platform-service/src/engine/YamlPreprocessor.ts`（新建）

```typescript
class YamlPreprocessor {
  private sharedActionService: SharedActionService;

  /**
   * 在 parsePipelineYaml() 之前调用，展开所有 action 引用。
   * 输入: 原始 YAML 字符串
   * 输出: 展开后的 YAML 对象（无 action 引用）
   */
  async preprocess(yamlString: string): Promise<object> {
    const parsed = jsYaml.load(yamlString) as PipelineYaml;

    for (const stage of parsed.spec.stages) {
      const expandedSteps: PipelineStep[] = [];

      for (const step of stage.steps) {
        if (this.isActionRef(step.uses)) {
          // 展开 action 为多个 steps
          const resolvedSteps = await this.sharedActionService.resolveActionRef(
            step.uses,
            step.with || {},
          );
          expandedSteps.push(...resolvedSteps);
        } else {
          expandedSteps.push(step);
        }
      }

      stage.steps = expandedSteps;
    }

    return parsed;
  }

  private isActionRef(uses: string): boolean {
    return uses.startsWith('./') || uses.includes('/');
  }
}
```

**PipelineEngine 集成点**:

```typescript
// PipelineEngine.createRun() 中
async createRun(pipelineId: string, yamlString: string): Promise<PipelineRun> {
  // 1. YAML 预处理（展开 action 引用）
  const expandedYaml = await this.yamlPreprocessor.preprocess(yamlString);

  // 2. 标准 YAML 解析和验证（PipelineEngine 现有逻辑，无需修改）
  const pipeline = parsePipelineYaml(yaml.dump(expandedYaml));

  // 3. 正常执行...
  return this.executePipeline(pipeline);
}
```

#### 2.10.5 SharedActionService

**文件**: `orion-platform-service/src/services/pipeline/SharedActionService.ts`（新建）

```typescript
class SharedActionService {
  private registryWhitelist: string[]; // 组织级 registry 白名单

  async resolveActionRef(
    ref: string,
    inputs: Record<string, string>,
  ): Promise<PipelineStep[]> {
    let actionYaml: string;

    if (ref.startsWith('./')) {
      // Local action
      actionYaml = await this.loadLocalAction(ref);
    } else if (ref.includes('/')) {
      // Remote: org/repo@v1
      actionYaml = await this.loadRemoteAction(ref);
    } else {
      // Registry: registry.actions/name@v1
      actionYaml = await this.loadRegistryAction(ref);
    }

    // 解析 action.yml，替换 inputs 变量
    const action = jsYaml.load(actionYaml) as ActionDefinition;
    return this.expandAction(action, inputs);
  }

  private async loadRemoteAction(ref: string): Promise<string> {
    // 安全约束:
    // 1. 必须使用 SHA 或 tag pinning，拒绝 @main / @master
    const [repo, version] = ref.split('@');
    if (!version || /^(main|master|HEAD)$/i.test(version)) {
      throw new Error(`Remote actions must use SHA or version tag, not branch names: ${ref}`);
    }
    // 2. 来源白名单校验
    if (!this.isRegistryAllowed(repo)) {
      throw new Error(`Registry not in whitelist: ${repo}`);
    }
    // 3. git clone + 读取 action.yml
    return await this.gitCloneAndRead(repo, version);
  }

  private expandAction(action: ActionDefinition, inputs: Record<string, string>): PipelineStep[] {
    // 将 action.runs.steps 中的 ${inputs.xxx} 替换为实际值
    // 返回展开后的 PipelineStep[]
  }
}
```

#### 2.10.6 安全约束

| 约束 | 描述 |
|------|------|
| SHA/Tag Pinning | 远程 action 必须使用 SHA 或版本 tag，拒绝 `@main`/`@master` |
| Registry 白名单 | 仅允许从配置的组织级 registry 加载远程 action |
| 输入参数隔离 | action 的 inputs 不影响外层 Pipeline 的变量作用域 |
| 循环引用检测 | action A 引用 B，B 引用 A 时，YamlPreprocessor 检测并拒绝 |
| 嵌套深度限制 | action 嵌套展开最大深度限制为 5 层 |

#### 2.10.7 依赖

- 无新增依赖
- 复用: `PipelineTemplateService`（可作为预定义 pipeline 片段基础）, Plugin system（可作为共享功能分发）

---

## 三、API 路由汇总

### 3.1 新增端点

| 模块 | 端点 | 方法 | 描述 |
|------|------|------|------|
| Docker | `/api/v1/builds/:id/status` | GET | 查询构建状态（已有） |
| Docker | `/api/v1/builds/:id/logs` | GET/SSE | 流式构建日志（已有） |
| 缓存 | `/api/v1/build-cache/entries/prefix/:prefix` | GET | 前缀匹配查找缓存条目 |
| 缓存 | `/api/v1/pipeline-runs/:runId/stages/:stageId/cache/stats` | GET | 缓存命中统计 |
| 测试 | `/api/v1/pipeline-runs/:runId/stages/:stageId/test-reports` | GET/POST | 获取/上传测试报告 |
| 测试 | `/api/v1/pipelines/:pipelineId/test-trend` | GET | 测试趋势 |
| PR | `/api/v1/scm/webhooks/pull-request` | POST | 接收 PR webhook |
| PR | `/api/v1/scm/webhooks/merge-request` | POST | 接收 GitLab MR webhook |
| PR | `/api/v1/scm/pull-requests/:repo/:number/checks` | GET | 查询 PR 检查 |
| 制品 | `/api/v1/artifacts/:name/versions` | GET | 列出版本 |
| 制品 | `/api/v1/artifact-versions/:id/promote` | POST | 版本提升 |
| 制品 | `/api/v1/artifacts/:name/lineage` | GET | 版本溯源链 |
| GPU | `/api/v1/runners/capabilities` | GET | 查询 Runner 能力（含 GPU） |

---

## 四、数据库变更

### 4.1 新建表

| 表名 | 字段 | 用途 |
|------|------|------|
| `test_reports` | id, run_id, stage_id, task_id, format, total_tests, passed, failed, skipped, duration_ms, coverage_json, created_at | 测试报告存储 |
| `artifact_versions` | id, artifact_name, version, commit_sha, branch, pipeline_run_id, stage_id, environment, tags, promoted_from, promoted_at, metadata, created_at | 制品版本管理 |

### 4.2 扩展现有表

| 表名 | 新增字段 | 用途 |
|------|---------|------|
| `scm_webhook_events` | pull_request_json (JSONB) | PR/MR 事件数据 |
| `scm_trigger_rules` | path_patterns, ignore_paths, pr_actions, label_filter, draft_policy | PR 触发规则 |
| `task_resource_quota` | gpu_count, gpu_type, gpu_shared | GPU 资源请求 |

### 4.3 Migration 文件

新建 SQL migration：
- `050_create_test_reports.sql`
- `051_create_artifact_versions.sql`
- `052_alter_scm_webhook_events.sql`
- `053_alter_scm_trigger_rules.sql`
- `054_alter_task_resource_quota.sql`

---

## 五、前端组件汇总

### 5.1 新建组件

| 模块 | 组件 | 描述 |
|------|------|------|
| 图形化编辑器 | `PipelineEditor.tsx` | 主编辑器 |
| 图形化编辑器 | `DAGCanvas.tsx` | DAG 画布 |
| 图形化编辑器 | `StageNode.tsx` | Stage 节点 |
| 图形化编辑器 | `YamlPreview.tsx` | YAML 预览 |
| 图形化编辑器 | `StageConfigPanel.tsx` | 配置面板 |
| 测试报告 | `TestReportViewer.tsx` | 测试结果展示 |
| 测试报告 | `TestTrendChart.tsx` | 历史趋势图 |
| 测试报告 | `CoverageReport.tsx` | 覆盖率报告 |
| 缓存 | `CacheConfigPanel.tsx` | 缓存配置 |
| 缓存 | `CacheDashboard.tsx` | 缓存监控 |
| 制品 | `ArtifactVersionManager.tsx` | 版本管理 |
| 制品 | `ArtifactLineageGraph.tsx` | 版本溯源图 |

### 5.2 新增页面路由

| 路径 | 组件 | 描述 |
|------|------|------|
| `/pipelines/:id/editor` | `PipelineEditor` | Pipeline 图形化编辑器 |
| `/runs/:runId/test-report` | `TestReportViewer` | 测试报告详情 |
| `/artifacts/:name/versions` | `ArtifactVersionManager` | 制品版本管理 |
| `/cache/dashboard` | `CacheDashboard` | 缓存使用率监控 |

---

## 六、实施优先级与依赖关系

### 6.1 Phase 划分

```
Phase 1 (P0) — 核心 CI 能力
├── Task 1.1: Docker 镜像构建 (TaskRunner 扩展 + BuildxBuilderService 改造)
└── Task 1.2: 构建缓存执行层 (StageExecutor 集成 + CacheRestoreSaveService)

Phase 2 (P1) — 生产就绪
├── Task 2.1: 容器化构建环境 (ContainerExecutor 策略 + K8s 真实化)
├── Task 2.2: 测试报告收集 (TestReportService + Parser 策略 + test/* type)
└── Task 2.3: PR/MR 触发 (SCMWebhookService 扩展 + PullRequestService)

Phase 3 (P2) — 体验提升
├── Task 3.1: 多架构构建集成 (复用 BuildxBuilderService)
├── Task 3.2: 图形化 Pipeline 编辑器 (前端 React Flow)
└── Task 3.3: 制品版本管理 (ArtifactVersionService)

Phase 4 (P3) — 高级能力
├── Task 4.1: GPU 资源分配 (模型扩展 + K8s 集成)
└── Task 4.2: 共享库机制 (SharedActionService)
```

### 6.2 依赖关系图

```
Phase 1.1 (Docker) ────────────────→ Phase 3.1 (多架构)
       ↓
Phase 1.2 (缓存) ──────────────────→ Phase 2.1 (容器化)
       ↓                                    ↓
Phase 2.2 (测试报告)                       Phase 4.1 (GPU)
       ↓
Phase 2.3 (PR/MR)  ← 独立，无前置依赖
       ↓
Phase 3.2 (图形化编辑器) ← 独立，纯前端
       ↓
Phase 3.3 (制品版本管理) ← 依赖 ArtifactService
       ↓
Phase 4.2 (共享库) ← 独立，无前置依赖
```

### 6.3 文件变更预估

| Phase | 新建文件 | 修改文件 | 预估行数 |
|-------|---------|---------|---------|
| Phase 1 | 3 | 3 | ~800 |
| Phase 2 | 12 | 4 | ~2500 |
| Phase 3 | 15 | 5 | ~3000 |
| Phase 4 | 4 | 3 | ~600 |
| **合计** | **34** | **15** | **~6900** |

---

## 七、横切关注点（专家评审补充）

### 7.1 日志管理

- Docker build 流式日志通过 `PipelineLogSSEService` 聚合到 Pipeline Run 日志
- K8s Pod 日志通过 sidecar 采集或事后 `readNamespacedPodLog` 拉取
- 日志保留策略：默认 30 天，支持按 Pipeline 配置 `logRetentionDays`
- 结构化日志：集成 Loki/ELK，支持日志级别和字段过滤

### 7.2 监控与可观测性

新增 Prometheus metrics：

| Metric | 描述 |
|--------|------|
| `orion_pipeline_run_duration_seconds` | Pipeline 运行时长分布 |
| `orion_cache_hit_total` | 缓存命中/未命中计数 |
| `orion_runner_utilization_ratio` | Runner CPU/内存利用率 |
| `orion_test_failure_rate` | 测试失败率趋势 |
| `orion_docker_build_duration_seconds` | Docker 构建时长 |

- 分布式追踪：PipelineRun ID 作为 trace ID，贯穿 Stage/Task
- 健康检查：`/healthz` 和 `/readyz` 端点

### 7.3 配置管理与特性开关

通过环境变量控制各模块启用状态：

| 环境变量 | 默认值 | 描述 |
|----------|--------|------|
| `ORION_DOCKER_ENABLED` | `true` | 启用 Docker 构建 |
| `ORION_CONTAINER_MODE` | `local` | 容器执行模式: local/docker/k8s |
| `ORION_CACHE_BACKEND` | `local` | 缓存后端: local/s3/nfs |
| `ORION_KANIKO_DEFAULT` | `true` | 生产环境默认使用 Kaniko |
| `ORION_PR_AUTO_CANCEL` | `true` | PR 触发时自动取消进行中构建 |

### 7.4 错误处理与重试

| 场景 | 策略 |
|------|------|
| Docker 构建网络超时 | 重试 2 次，指数退避 |
| K8s Job 失败 | backoffLimit=2，超出后标记失败 |
| 缓存下载失败 | 降级为无缓存执行，记录 warning 日志 |
| 测试报告解析失败 | 记录 warning，不阻断 Pipeline |

### 7.5 资源限制与配额

| 资源 | 限制 | 配置项 |
|------|------|--------|
| Pipeline 最大并发 Task | 10 | `PipelineExecutionQueue.maxConcurrent` |
| 单租户缓存空间上限 | 5GB | `ORION_CACHE_MAX_SIZE_GB` |
| Docker 构建镜像大小上限 | 2GB | `ORION_DOCKER_MAX_IMAGE_SIZE` |
| K8s 构建 ResourceQuota | 按 Namespace 配置 | 集群管理员配置 |

### 7.6 安全审计

- PR 状态回写（GitHub Check / GitLab Commit Status）记录审计日志
- Secrets 注入记录审计日志（不记录 secret 值）
- Shared Action 加载来源记录 `actionRef → resolvedSha → loadedAt`
- 日志中自动脱敏 token（复用 `StreamSecretSanitizer`）

### 7.7 数据迁移与向后兼容

- 现有 Pipeline YAML 不含新字段时，解析器使用默认值（cache.enabled=false, container=undefined）
- `scm_webhook_events` 表新增 JSONB 字段，历史查询兼容（`pull_request_json IS NULL` 视为 push 事件）
- `task_resource_quota` 新增 GPU 字段后，旧客户端不传 gpu 参数时使用默认值 `NULL`

---

## 八、测试策略

### 7.1 单元测试

| 模块 | 测试文件 | 测试重点 |
|------|---------|---------|
| Docker | `TaskRunner.docker.test.ts` | docker/build, docker/push, docker/scan |
| 缓存 | `CacheRestoreSaveService.test.ts` | 缓存恢复、保存、前缀匹配 |
| 容器化 | `ContainerExecutor.test.ts` | Local/Docker/K8s 三种执行器 |
| 测试报告 | `TestReportService.test.ts` + 各 Parser 测试 | JUnit/Jest/Pytest/Go 解析 |
| PR 触发 | `SCMWebhookService.pr.test.ts` | PR 事件解析、路径过滤 |
| 制品版本 | `ArtifactVersionService.test.ts` | 版本提升、溯源链 |
| 共享库 | `SharedActionService.test.ts` | Local/Remote/Registry 三种引用解析 |

### 7.2 集成测试

| 测试 | 描述 |
|------|------|
| Docker + Pipeline | Pipeline YAML 触发 docker/build，验证镜像生成 |
| 缓存 + Pipeline | Stage 含 cache 配置，验证缓存命中 |
| 测试报告 + Pipeline | Pipeline 含 test/* step，验证报告存储和查询 |
| PR + Pipeline | GitHub PR webhook 触发 Pipeline，验证状态回写 |

### 7.3 端对端测试

使用 Playwright 测试前端图形化编辑器：
- 创建 Pipeline → 拖拽 Stage → 配置 Task → 生成 YAML → 保存 → 触发执行

---

## 九、前端功能补充（补充章节）

### 9.1 Docker 构建配置 UI

| 组件 | 描述 | 页面 |
|------|------|------|
| `DockerBuildConfigPanel` | Dockerfile 路径、构建上下文、镜像名、标签、平台选择 | Pipeline 编辑器 Task 配置 |
| `DockerRegistryConfig` | 镜像仓库地址、认证方式（用户名密码 / Token） | 项目设置 → 镜像仓库 |
| `BuildLogViewer` | 流式构建日志实时展示，含 ANSI 颜色渲染 | Pipeline Run 详情 |

### 9.2 缓存管理 UI

| 组件 | 描述 | 页面 |
|------|------|------|
| `CacheConfigPanel` | Stage 级缓存开关、Key 模板选择器、路径配置、restore-keys | Pipeline 编辑器 Stage 配置 |
| `CacheDashboard` | 缓存命中率趋势图、各 Stage 缓存大小排行、手动清理按钮 | 项目设置 → 缓存管理 |
| `CacheKeyBuilder` | 可视化缓存键构建器：变量选择器 + 实时预览 | Pipeline 编辑器 Task 配置 |

### 9.3 测试报告 UI

| 组件 | 描述 | 页面 |
|------|------|------|
| `TestReportViewer` | 测试结果总览（通过率饼图）、失败用例列表（含堆栈跟踪）、按状态过滤 | Pipeline Run 详情 |
| `TestTrendChart` | 历史通过率趋势、平均时长趋势、用例数量变化 | 项目设置 → 测试趋势 |
| `CoverageReport` | 行覆盖/分支覆盖/函数覆盖仪表盘、文件级覆盖率下钻 | Pipeline Run 详情 |
| `TestCaseDetail` | 单条用例详情：名称、所属 class、耗时、错误信息 | 测试报告弹窗 |

### 9.4 PR/MR 状态 UI

| 组件 | 描述 | 页面 |
|------|------|------|
| `PRCheckStatus` | PR 关联的 Pipeline 运行状态列表（成功/失败/进行中） | PR 详情页 |
| `PRWebhookTest` | Webhook 测试工具：发送模拟 PR 事件、查看触发结果 | 项目设置 → Webhook |

### 9.5 制品版本管理 UI

| 组件 | 描述 | 页面 |
|------|------|------|
| `ArtifactVersionManager` | 版本列表（语义化版本号、环境标签、创建时间）、搜索过滤 | 制品库 → 版本列表 |
| `ArtifactLineageGraph` | 版本溯源图：版本 → promotedFrom → ... → 初始版本，DAG 可视化 | 制品详情 → 版本溯源 |
| `ArtifactPromoteDialog` | 版本提升对话框：选择源环境 → 目标环境 → 确认 | 制品详情 → 版本操作 |

### 9.6 图形化编辑器 UI（增强）

| 组件 | 描述 | 页面 |
|------|------|------|
| `PipelineEditor` | 主编辑器：React Flow DAG 画布 + Monaco YAML 编辑器分栏 | `/pipelines/:id/editor` |
| `DAGCanvas` | DAG 画布：Stage 节点拖拽、连线建立依赖、右键菜单 | 同上 |
| `StageNode` | Stage 节点：名称、状态图标、内部 Task 缩略列表、展开/折叠 | 同上 |
| `TaskNode` | Task 节点：类型图标、名称、状态、错误提示 | 同上 |
| `YamlPreview` | YAML 实时预览：图形编辑时自动生成 YAML，支持手动编辑后同步回图形 | 同上（右侧栏） |
| `StageConfigPanel` | Stage 配置表单：名称、runsOn、超时、重试、矩阵、缓存、容器、条件 | 同上（点击 Stage 节点弹出） |
| `TaskConfigPanel` | Task 配置表单：类型选择（git/npm/shell/docker/test）、参数配置、输出变量 | 同上（点击 Task 节点弹出） |

### 9.7 前端协作冲突处理

| 场景 | 方案 |
|------|------|
| 多人同时编辑同一 Pipeline | 乐观锁 + 版本号，保存时检测版本冲突，提示用户合并 |
| Pipeline 正在运行时编辑 | 允许编辑，保存为新版本，不影响正在运行的版本 |
| YAML 语法错误 | Monaco Editor 实时语法校验，错误高亮，阻止保存直到修复 |

### 9.8 前端新增路由汇总

| 路由 | 组件 | 描述 |
|------|------|------|
| `/pipelines/:id/editor` | `PipelineEditor` | Pipeline 图形化编辑器 |
| `/runs/:runId/test-report` | `TestReportViewer` | 测试报告详情 |
| `/artifacts/:name/versions` | `ArtifactVersionManager` | 制品版本管理 |
| `/artifacts/:name/lineage` | `ArtifactLineageGraph` | 版本溯源图 |
| `/cache/dashboard` | `CacheDashboard` | 缓存使用率监控 |
| `/project/:id/settings/registry` | `DockerRegistryConfig` | 镜像仓库配置 |
| `/project/:id/settings/cache` | `CacheDashboard` | 缓存管理设置 |
| `/project/:id/settings/webhook` | `PRWebhookTest` | Webhook 测试工具 |
| `/project/:id/test-trend` | `TestTrendChart` | 测试趋势大盘 |

---

## 十、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| BuildxBuilderService 的 exec() 改 spawn() 可能引入回归 | Docker 构建功能 | 保留 exec() 为 fallback，新增 spawn() 路径 |
| K8sBuildExecutor 替换 Mock Client 后需要真实 K8s 集群 | 容器化构建 | 提供 local-docker 和 k8s 两种模式，默认 local |
| PR/MR 触发可能引入安全风险（secrets 泄露） | 安全 | 实现安全模型（safe/trusted/full），默认 safe |
| 前端 React Flow 组件可能影响现有页面 | 前端稳定性 | 新建独立页面路由，不影响现有页面 |
| 测试报告解析大文件（10万+用例）性能问题 | 性能 | 流式解析 + 分页存储 |

---

## 十一、与竞品对比的提升

| 功能域 | 实施前 | 实施后 | 对标竞品 |
|--------|--------|--------|---------|
| Docker 构建 | ❌ 无 | ✅ 原生支持 | Zadig ✅, 阿里云效 ✅ |
| 构建缓存 | ⚠️ 数据层就绪 | ✅ 执行层集成 | GitHub Actions ✅, Zadig ✅ |
| 容器化构建 | ❌ 宿主机进程 | ✅ 容器/K8s 可选 | Jenkins K8s ✅, Zadig ✅ |
| 测试报告 | ❌ 无 | ✅ 多格式解析 | Jenkins ✅, Zadig ✅ |
| PR/MR 触发 | ❌ 仅 push | ✅ 完整 PR 支持 | GitHub Actions ✅, GitLab ✅ |
| 多架构构建 | ⚠️ 有代码未集成 | ✅ Pipeline 集成 | Zadig ✅, Jenkins buildx ✅ |
| 图形化编辑器 | ❌ 无 | ✅ React Flow | 阿里云效 ✅, Zadig ✅ |
| 制品版本管理 | ⚠️ 简单追踪 | ✅ 版本提升+溯源 | JFrog ✅, Nexus ✅ |
| GPU 资源 | ❌ 无 | ✅ K8s 集成 | Zadig ✅, 阿里云效 ✅ |
| 共享库 | ❌ 无 | ✅ Shared Actions | Jenkins ✅, GitHub Actions ✅ |

---

*文档生成时间: 2026-05-09*
