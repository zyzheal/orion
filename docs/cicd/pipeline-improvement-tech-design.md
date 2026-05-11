# Orion Pipeline 能力提升 — 技术设计文档

> 日期: 2026-04-21
> 阶段: Phase 2 — 技术设计
> 状态: 待评审

## 1. 背景与目标

### 1.1 背景
Orion Pipeline 已完成 Phase 0-5 核心基础设施，具备：
- YAML + Web UI 创建 Pipeline
- DAG 执行引擎 + 乐观锁状态管理
- 3 种执行模式 (Process/Container/WASM)
- Runner 管理 + 容量感知调度
- 跨 Pipeline 信号协调
- SecretVault 加密存储 + 审计日志
- Web/Cron 触发器

与 GitHub Actions 对比后，识别出 7 个关键改进方向。

### 1.2 目标
| 目标 | 衡量指标 |
|------|----------|
| 矩阵策略落地 | 支持 `matrix` 字段，自动展开并行子 Stage |
| 可复用工作流 | 支持 Pipeline 模板引用 + 参数传递 |
| Git 事件触发 | 接收 push/PR/tag/release webhook 并自动创建 PipelineRun |
| 缓存后端实现 | key 匹配 + TTL + 租户隔离 + 命中率监控 |
| 审批流落地 | Stage 环境 + 审批人 + WAITING_APPROVAL 状态 |

### 1.3 约束
- 不得破坏现有 API 契约
- 所有新功能必须向后兼容
- 测试覆盖率 ≥ 80%
- 单次 PR 不超过 500 行（分多轮交付）

## 2. 架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Orion Pipeline                           │
├─────────────┬─────────────┬─────────────┬───────────────────────┤
│  触发层      │  定义层      │  执行层      │  治理层               │
│             │             │             │                       │
│ • Git 事件   │ • YAML 解析  │ • DAG 引擎   │ • 矩阵策略            │
│   Webhook   │ • 模板系统   │ • 插件执行   │ • 可复用工作流         │
│ • Web/Cron  │ • 条件表达式  │ • Runner     │ • 缓存/Artifact       │
│ • Manual    │ • 变量注入   │ • 安全沙箱   │ • 审批流              │
│ • API       │             │             │ • 审计/日志            │
└─────────────┴─────────────┴─────────────┴───────────────────────┘
```

### 2.2 模块设计

#### 2.2.1 矩阵策略引擎 (MatrixEngine)

**职责**: 解析 `matrix` 配置，展开为子 Stage 列表。

**输入**:
```yaml
stages:
  - name: test
    matrix:
      os: [ubuntu, macos]
      node: [18, 20]
      exclude:
        - os: macos
          node: 18
    steps:
      - uses: npm/test
        with:
          node-version: ${{ matrix.node }}
```

**展开结果** (3 个并行子 Stage):
- `test (ubuntu, 18)`
- `test (ubuntu, 20)`
- `test (macos, 20)`

**核心接口**:
```typescript
interface MatrixConfig {
  [key: string]: string[] | MatrixInclude[] | MatrixExclude[];
}

interface MatrixExpansion {
  combinations: Record<string, string>[];
  count: number;
}

class MatrixEngine {
  expand(matrix: MatrixConfig): MatrixExpansion;
  interpolate(template: string, values: Record<string, string>): string;
  validate(matrix: MatrixConfig): ValidationResult;
}
```

**实现要点**:
1. 笛卡尔积算法生成所有组合
2. `exclude` 过滤不需要的组合
3. `include` 追加额外组合
4. `${{ matrix.xxx }}` 变量注入到 steps 的 `with` 字段
5. `fail-fast` 控制：一个失败时取消其余

#### 2.2.2 可复用工作流系统 (ReusablePipeline)

**职责**: 支持从本地/Git/注册表引用 Pipeline 模板。

**引用语法**:
```yaml
# 本地引用
import: ./templates/node-build.yml

# Git 引用
import: git@github:org/templates.git/node-build@v1

# 注册表引用
import: registry:node-build@1.0.0

# 传参
with:
  node-version: '20'
  test-command: 'npm test'
```

**核心接口**:
```typescript
interface PipelineTemplateRef {
  source: 'local' | 'git' | 'registry';
  path: string;
  ref?: string; // git tag/branch
  version?: string; // registry semver
}

interface PipelineTemplate {
  id: string;
  inputs: Record<string, TemplateInput>;
  outputs: Record<string, TemplateOutput>;
  stages: PipelineStage[];
}

class TemplateResolver {
  resolve(ref: PipelineTemplateRef): Promise<PipelineTemplate>;
  merge(template: PipelineTemplate, withValues: Record<string, any>): PipelineStage[];
  validateOutputs(template: PipelineTemplate, context: ExecutionContext): boolean;
}
```

**实现要点**:
1. 本地文件直接读取
2. Git 引用先 clone 到临时目录，提取 YAML 后清理
3. 注册表查询 API + 缓存
4. 模板变量注入：`${{ inputs.xxx }}` → 实际值
5. 输出传递：子 Pipeline 的 outputs → 父 Pipeline 的 context

#### 2.2.3 Git 事件触发器 (GitWebhookService)

**职责**: 接收 Git 平台 webhook，匹配规则后自动创建 PipelineRun。

**支持的 Git 平台**:
- GitHub (webhook)
- GitLab (webhook)
- Gitee (webhook)

**核心接口**:
```typescript
interface GitEventRule {
  event: 'push' | 'pull_request' | 'tag' | 'release';
  branches?: string[]; // glob patterns
  tags?: string[];
  paths?: string[]; // file path filters
}

interface GitWebhookPayload {
  platform: 'github' | 'gitlab' | 'gitee';
  event: string;
  ref: string;
  sha: string;
  sender: string;
  payload: Record<string, unknown>;
}

class GitWebhookService {
  handleWebhook(platform: string, payload: any): Promise<void>;
  matchRules(event: GitWebhookPayload): PipelineTrigger[];
  createTriggeredRuns(event: GitWebhookPayload, triggers: PipelineTrigger[]): Promise<string[]>;
}
```

**Webhook 端点**:
```
POST /api/webhooks/github/:pipelineId
POST /api/webhooks/gitlab/:pipelineId
POST /api/webhooks/gitee/:pipelineId
```

**实现要点**:
1. HMAC 签名验证（防止伪造）
2. 规则匹配：分支 glob、路径过滤
3. 自动填充 PipelineRunContext.git 字段
4. 幂等性：同一 push 不重复触发（基于 sha 去重）

#### 2.2.4 缓存服务 (PipelineCacheService)

**职责**: Stage 级别的构建缓存存储与恢复。

**存储后端**:
- 默认：本地文件系统 (`/var/cache/orion/`)
- 可选：S3/MinIO

**核心接口**:
```typescript
interface CacheEntry {
  key: string;
  tenantId: string;
  projectId: string;
  size: number;
  createdAt: Date;
  lastAccessedAt: Date;
  ttl: number; // seconds
}

class PipelineCacheService {
  restore(key: string, restoreKeys: string[], paths: string[]): Promise<CacheResult>;
  save(key: string, paths: string[], ttl: number): Promise<void>;
  evict(): Promise<void>; // LRU + TTL 清理
  getStats(): Promise<CacheStats>;
}
```

**Key 模板语法**:
```yaml
cache:
  key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
  restore-keys:
    - ${{ runner.os }}-node-
    - ${{ runner.os }}-
```

**实现要点**:
1. `hashFiles` 函数：对匹配路径的文件内容做 SHA-256
2. 精确匹配 → 前缀匹配 → 回退
3. tar.gz 压缩/解压
4. LRU 淘汰 + TTL 自动清理
5. 租户隔离 key 命名空间

#### 2.2.5 审批流系统 (ApprovalService)

**职责**: Stage 环境级别的审批控制。

**核心接口**:
```typescript
interface Environment {
  name: string;
  reviewers: string[]; // user IDs
  waitTimeout: number; // seconds, default: 3600
  branchProtection: string[]; // glob patterns
}

interface ApprovalRequest {
  runId: string;
  stageId: string;
  environment: string;
  requestedBy: string;
  requestedAt: Date;
}

enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

class ApprovalService {
  createRequest(approval: ApprovalRequest): Promise<string>;
  approve(requestId: string, approverId: string, comment?: string): Promise<void>;
  reject(requestId: string, approverId: string, reason?: string): Promise<void>;
  checkStatus(runId: string, stageId: string): Promise<ApprovalStatus>;
  checkExpiry(): Promise<void>; // 定时任务
}
```

**YAML 语法**:
```yaml
stages:
  - name: deploy-prod
    environment: production
    depends_on: [test]
    steps:
      - uses: k8s/deploy
```

**实现要点**:
1. Stage 进入时检查 environment，若有 → 创建审批请求
2. Stage 状态切换为 `WAITING_APPROVAL`，释放 Runner 资源
3. 审批人通过 API/UI 操作
4. 超时自动标记为 `EXPIRED` → Stage 失败
5. 审批记录写入审计日志

### 2.3 数据模型变更

#### 2.3.1 Stage 表新增字段
```sql
ALTER TABLE stages
  ADD COLUMN matrix_index INTEGER,           -- 子 Stage 在矩阵中的索引
  ADD COLUMN matrix_values JSONB,            -- 该子 Stage 的 matrix 变量
  ADD COLUMN parent_stage_id UUID,           -- 父 Stage ID (用于矩阵展开)
  ADD COLUMN environment VARCHAR(100),       -- 环境名称
  ADD COLUMN template_ref JSONB;             -- 模板引用信息
```

#### 2.3.2 新增表
```sql
-- 矩阵子 Stage 关联
CREATE TABLE stage_matrix_expansions (
  id UUID PRIMARY KEY,
  parent_stage_id UUID NOT NULL REFERENCES stages(id),
  matrix_values JSONB NOT NULL,
  stage_id UUID NOT NULL REFERENCES stages(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 审批请求
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES pipeline_runs(id),
  stage_id UUID NOT NULL REFERENCES stages(id),
  environment VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  reviewer_ids UUID[],
  approved_by UUID,
  approved_at TIMESTAMP,
  reject_reason TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 缓存记录
CREATE TABLE pipeline_caches (
  id UUID PRIMARY KEY,
  key VARCHAR(500) NOT NULL,
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL,
  storage_path VARCHAR(1000) NOT NULL,
  size_bytes BIGINT,
  ttl_seconds INTEGER DEFAULT 86400,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Git 触发记录 (幂等)
CREATE TABLE git_trigger_records (
  id UUID PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id),
  platform VARCHAR(20) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  sha VARCHAR(64) NOT NULL,
  run_id UUID REFERENCES pipeline_runs(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pipeline_id, platform, sha)
);
```

### 2.4 执行流程

#### 2.4.1 矩阵策略执行流程
```
PipelineEngine.executeStage(stage)
  │
  ├─ stage.matrix 存在?
  │   │
  │   ├─ 是 → MatrixEngine.expand(matrix)
  │   │       │
  │   │       ├─ 生成 N 个组合
  │   │       ├─ 应用 exclude/include 过滤
  │   │       ├─ 为每个组合创建子 Stage
  │   │       │   - matrix_values 注入
  │   │       │   - ${{ matrix.xxx }} 替换
  │   │       │   - parent_stage_id 关联
  │   │       ├─ 子 Stage 并行加入 pendingStages
  │   │       └─ 父 Stage 状态 → "expanding"
  │   │
  │   └─ 否 → 正常执行
  │
  ├─ 子 Stage 全部完成?
  │   ├─ 是 → 父 Stage 状态 → 聚合结果
  │   └─ fail-fast 开启 + 有失败?
  │       └─ 取消其余子 Stage
```

#### 2.4.2 可复用工作流解析流程
```
PipelineEngine.createRun(pipelineDef)
  │
  ├─ 解析 YAML stages
  │   │
  │   ├─ stage.import 存在?
  │   │   │
  │   │   ├─ TemplateResolver.resolve(import)
  │   │   │   ├─ 读取/下载模板 YAML
  │   │   │   ├─ 解析 inputs → with 值映射
  │   │   │   └─ 返回展开后的 Stage[]
  │   │   │
  │   │   └─ 替换原 stage 为展开的 Stage[]
  │   │       - 名称加前缀: "{template-name}/{stage-name}"
  │   │       - 依赖关系自动调整
  │   │
  │   └─ 继续正常解析
  │
  └─ 初始化所有 Stage → 开始执行
```

## 3. 技术可行性分析

| 改进项 | 技术可行性 | 风险 | 缓解措施 |
|--------|-----------|------|----------|
| 矩阵策略 | 高 — 纯算法展开，无外部依赖 | 组合爆炸 | 限制 max 50 个子 Stage |
| 可复用工作流 | 高 — 已有 YAML 解析器 | 模板来源安全性 | 限制可信来源 + SHA 校验 |
| Git 事件触发 | 高 — webhook 标准协议 | 签名验证遗漏 | 强制 HMAC 验证中间件 |
| 缓存后端 | 高 — tar.gz + 文件系统 | 磁盘空间不足 | 自动 LRU 清理 + 配额 |
| 审批流 | 高 — 状态机已有基础 | 审批人不在系统 | 支持 email 外部审批 |

## 4. 测试策略

### 4.1 单元测试
- MatrixEngine: 笛卡尔积、exclude/include、变量注入
- TemplateResolver: 三种来源解析、参数合并
- GitWebhookService: 签名验证、规则匹配、幂等性
- PipelineCacheService: key 匹配、前缀回退、压缩/解压
- ApprovalService: 状态流转、超时处理

### 4.2 集成测试
- 矩阵 Stage 完整执行流程
- 模板引用 + 参数传递 + 输出回传
- Git webhook → PipelineRun 创建
- 缓存 restore/save 完整链路
- 审批请求 → 批准 → Stage 恢复执行

### 4.3 性能测试
- 矩阵 50 组合并发执行
- 模板下载 + 解析延迟 < 500ms
- 缓存 restore 100MB 文件 < 5s

## 5. 实施路线图

### Phase A: 矩阵策略 (2-3 周)
1. MatrixEngine 核心算法
2. YAML 解析 + `${{ matrix.xxx }}` 注入
3. fail-fast 实现
4. 前端 DAG 展示矩阵子 Stage
5. 测试 + 文档

### Phase B: 可复用工作流 (2 周)
1. TemplateResolver 三来源实现
2. inputs/outputs 参数体系
3. 模板名称空间 + 前缀处理
4. 测试 + 文档

### Phase C: Git 事件触发 (2 周)
1. Webhook 端点 + 签名验证
2. GitWebhookService 规则匹配
3. 幂等记录表
4. 前端配置触发规则 UI
5. 测试 + 文档

### Phase D: 缓存 + 审批流 (2-3 周)
1. PipelineCacheService 实现
2. hashFiles 函数
3. ApprovalService 状态机
4. 前端审批 UI
5. 测试 + 文档

**总计**: 8-10 周

## 6. 风险与缓解

| 风险 | 影响 | 概率 | 缓解 |
|------|------|------|------|
| 矩阵组合爆炸导致资源耗尽 | 高 | 中 | 硬限制 50 个子 Stage |
| 恶意模板注入 | 高 | 低 | 来源白名单 + 沙箱执行 |
| Webhook 签名泄露 | 高 | 低 | 密钥轮换 + IP 白名单 |
| 缓存磁盘爆满 | 中 | 中 | 自动清理 + 租户配额 |
| 审批超时无人处理 | 低 | 高 | 默认超时 + 通知升级 |
