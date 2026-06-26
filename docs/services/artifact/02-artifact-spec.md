# 构建制品详细规格 (Phase 1)
> **注意**: 本文档中的 `Map()` / 内存存储描述已过时。相关服务已迁移到 PostgreSQL Repository 模式，详见 `src/repositories/` 和 `src/db/migrations/`。



> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 2. 构建制品
> **目标成熟度**: L2 → L2.5
> **关键交付**: 缓存监控面板、多架构并行构建

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- Build 记录管理（BuildService + BuildRepository + PostgreSQL）
- Build Environment 管理（Docker 镜像配置）
- Build Cache 三级缓存（global/pipeline/task 级别，migration 053）
- Artifact 元数据模型（ArtifactService，**仍使用 Map 内存存储，未迁移到 PostgreSQL**）
- Artifact Registry 表结构（migration 010，含 tags/downloads/metadata）
- SBOM 漏洞追踪（migration 045，含 vulnerabilities + waivers）
- Build 状态统计（total/success/failed/running/avgDuration）

**不足**：
- ArtifactService 仍为 Map 内存存储，服务重启后丢失
- 无缓存监控面板（有 cache_configs 和 cache_entries 表，但无可视化/命中率统计）
- 无多架构构建支持（仅单架构，无 arm64/amd64 并行构建）
- 无增量构建优化（每次全量构建）
- 无制品溯源（provenance）/SBOM 生成
- 无制品依赖图谱

### 1.2 Phase 1 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| Artifact 持久化 | 将 ArtifactService 迁移至 PostgreSQL Repository 模式 | L2.5 |
| 缓存监控面板 | 缓存命中率统计、缓存大小分布、热点分析、清理策略可视化 | L2.5 |
| 多架构并行构建 | amd64/arm64/armv7 并行构建、清单合并 | L2.5 |
| 增量构建 | 基于文件 hash 的增量构建检测，跳过未变更模块 | L2.3 |

## 二、验收标准

### 2.1 Artifact 持久化

| # | 标准 | 验证方式 |
|---|------|----------|
| A1 | 创建 ArtifactRepository，含 CRUD 和分页查询 | 单元测试 |
| A2 | ArtifactService 构造函数接受 Repository 参数 | 代码审查 |
| A3 | 服务重启后 Artifact 数据不丢失 | 集成测试 |
| A4 | Artifact 关联 PipelineRun（通过 runId 外键） | 代码审查 |
| A5 | 支持按 runId/stageId/type 过滤查询 | API 测试 |

### 2.2 缓存监控面板

| # | 标准 | 验证方式 |
|---|------|----------|
| C1 | 缓存命中率统计（按 global/pipeline/task 维度） | API 测试 |
| C2 | 缓存大小分布（总大小、各 config 占用、各 entry 大小） | API 测试 |
| C3 | 缓存热点分析（Top 10 最常用缓存 key） | API 测试 |
| C4 | 缓存过期/清理统计（按 TTL 自动清理记录） | API 测试 |
| C5 | 缓存性能指标（命中时节省时间 vs 未命中耗时） | API 测试 |
| C6 | 前端可视化：命中率趋势图、大小分布饼图、热点表格 | 前端验证 |

### 2.3 多架构并行构建

| # | 标准 | 验证方式 |
|---|------|----------|
| M1 | 支持配置构建目标架构列表（arm64/amd64/armv7） | API 测试 |
| M2 | 并行执行多架构构建（非串行） | 集成测试 |
| M3 | 各架构构建结果独立存储 | API 测试 |
| M4 | 构建完成后生成 manifest list（Docker manifest） | 集成测试 |
| M5 | 前端展示各架构构建状态和耗时 | 前端验证 |

### 2.4 增量构建

| # | 标准 | 验证方式 |
|---|------|----------|
| I1 | 记录上次构建的文件 hash 快照 | 单元测试 |
| I2 | 构建前对比文件 hash，识别变更模块 | 单元测试 |
| I3 | 未变更模块跳过构建，使用上次产物 | 集成测试 |
| I4 | 增量构建节省时长统计 | API 测试 |

## 三、API 设计

### 3.1 Artifact API (持久化增强)

```
Base: /api/v1/artifacts
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 创建 Artifact | `ArtifactCreateInput` | `{ id, name, type, size, runId }` |
| GET | `/` | 查询 Artifact 列表 | query: runId, stageId, type, page, limit | `{ data: Artifact[], total }` |
| GET | `/:id` | 获取 Artifact 详情 | - | `{ id, name, type, size, checksum, ... }` |
| GET | `/:id/download` | 下载 Artifact | - | 文件流 |
| DELETE | `/:id` | 删除 Artifact | - | `{ success }` |
| POST | `/cleanup` | 清理过期 Artifact | `{ tenantId? }` | `{ cleanedCount }` |

### 3.2 缓存监控 API

```
Base: /api/v1/build-cache
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/stats` | 缓存统计概览 | - | `{ hitRate, totalSize, entryCount, avgHitCount }` |
| GET | `/stats/:level` | 按级别统计 | query: level | `{ hitRate, sizeBytes, entryCount, configs[] }` |
| GET | `/hot-keys` | 缓存热点 Top N | query: limit | `{ entries: [{ key, hash, hitCount, sizeBytes }] }` |
| GET | `/configs` | 缓存配置列表 | query: level | `{ data: CacheConfig[], total }` |
| PUT | `/configs/:id` | 更新缓存配置 | `CacheConfigUpdate` | `{ ... }` |
| DELETE | `/entries/:id` | 删除缓存条目 | - | `{ success }` |
| POST | `/cleanup` | 执行缓存清理 | `{ policy: 'lru' | 'ttl', maxAgeDays? }` | `{ cleanedCount, freedBytes }` |
| GET | `/trend` | 缓存命中率趋势 | query: days | `{ data: [{ date, hitRate, hitCount, missCount }] }` |

**CacheStats 结构**:

```typescript
interface CacheStats {
  hitRate: number;           // 命中率 0-1
  totalHits: number;
  totalMisses: number;
  totalSizeBytes: number;    // 总缓存大小
  entryCount: number;        // 缓存条目数
  avgHitCount: number;       // 平均命中次数
  topConfigs: CacheConfigStats[];
}

interface CacheConfigStats {
  id: string;
  level: 'global' | 'pipeline' | 'task';
  targetId: string | null;
  hitRate: number;
  sizeBytes: number;
  entryCount: number;
  maxTotalSize: string;
  cleanupPolicy: string;
}
```

### 3.3 多架构构建 API

```
Base: /api/v1/builds/:buildId
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/architectures` | 获取构建架构配置 | - | `{ targetArchitectures[], buildResults[] }` |
| PUT | `/architectures` | 更新目标架构 | `{ architectures: string[] }` | `{ success }` |
| POST | `/multi-arch` | 触发多架构构建 | `{ architectures: string[] }` | `{ id, builds: [{ arch, buildId, status }] }` |
| GET | `/manifest` | 获取 Manifest List | - | `{ schemaVersion, mediaType, manifests[] }` |

**MultiArchBuild 结构**:

```typescript
interface MultiArchBuild {
  id: string;
  parentBuildId: string;
  architectures: string[];          // ['amd64', 'arm64', 'armv7']
  builds: ArchBuildResult[];
  manifestList?: ManifestList;
  status: 'pending' | 'building' | 'success' | 'failed' | 'partial';
  createdAt: Date;
  completedAt?: Date;
}

interface ArchBuildResult {
  architecture: string;
  buildId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  imageTag: string;
  sizeBytes: number;
  durationMs: number;
  error?: string;
}

interface ManifestList {
  schemaVersion: number;
  mediaType: string;
  manifests: {
    mediaType: string;
    size: number;
    digest: string;
    platform: { architecture: string; os: string };
  }[];
}
```

### 3.4 增量构建 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/builds/:buildId/incremental-check` | 检查是否可增量构建 | - | `{ canIncremental, changedModules[], unchangedModules[], estimatedSavingsMs }` |
| POST | `/builds/:buildId/incremental` | 执行增量构建 | - | `{ id, status, skippedModules[], builtModules[], durationMs, savedMs }` |

## 四、数据库变更

### 4.1 新增表：artifacts (正式持久化表)

```sql
CREATE TABLE IF NOT EXISTS artifacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  type            VARCHAR(50) NOT NULL DEFAULT 'other',
  storage_type    VARCHAR(20) NOT NULL DEFAULT 'local',
  storage_path    VARCHAR(500) NOT NULL,
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  checksum_sha256 VARCHAR(64),
  run_id          UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage_id        UUID REFERENCES stage_executions(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ,
  downloaded_count INT NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_artifacts_tenant ON artifacts(tenant_id);
CREATE INDEX idx_artifacts_run ON artifacts(run_id);
CREATE INDEX idx_artifacts_stage ON artifacts(stage_id);
CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_expires ON artifacts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_artifacts_created ON artifacts(created_at DESC);
```

### 4.2 新增表：build_architectures

```sql
CREATE TABLE IF NOT EXISTS build_architectures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  architecture    VARCHAR(20) NOT NULL,       -- 'amd64', 'arm64', 'armv7'
  image           VARCHAR(500),
  tag             VARCHAR(200),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  size_bytes      BIGINT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     BIGINT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(build_id, architecture)
);
CREATE INDEX idx_build_architectures_build ON build_architectures(build_id);
CREATE INDEX idx_build_architectures_status ON build_architectures(status);
```

### 4.3 新增表：build_manifests

```sql
CREATE TABLE IF NOT EXISTS build_manifests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  schema_version  INT NOT NULL DEFAULT 2,
  media_type      VARCHAR(200),
  manifests       JSONB NOT NULL DEFAULT '[]',
  digest          VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(build_id)
);
```

### 4.4 新增表：build_file_hashes

```sql
CREATE TABLE IF NOT EXISTS build_file_hashes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  module_name     VARCHAR(200) NOT NULL,
  file_hash       VARCHAR(64) NOT NULL,     -- SHA256 of module files
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(build_id, module_name)
);
CREATE INDEX idx_build_file_hashes_build ON build_file_hashes(build_id);
```

### 4.5 新增表：build_cache_stats

缓存统计快照表（用于趋势图）。

```sql
CREATE TABLE IF NOT EXISTS build_cache_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date       DATE NOT NULL,
  level           VARCHAR(20) NOT NULL,       -- 'global', 'pipeline', 'task'
  config_id       UUID REFERENCES build_cache_configs(id),
  hit_count       INT NOT NULL DEFAULT 0,
  miss_count      INT NOT NULL DEFAULT 0,
  total_size_bytes BIGINT NOT NULL DEFAULT 0,
  entry_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(stat_date, level, config_id)
);
CREATE INDEX idx_build_cache_stats_date ON build_cache_stats(stat_date DESC);
CREATE INDEX idx_build_cache_stats_level ON build_cache_stats(level);
```

### 4.6 迁移脚本

```sql
-- Migration 081: Build artifacts enhancement
-- Artifact persistence, cache monitoring, multi-arch builds, incremental builds
```

## 五、前端设计

### 5.1 缓存监控面板

**路由**: `/build-cache/monitor`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  缓存监控面板                                │
├─────────────────────────────────────────────┤
│                                              │
│  总览                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 命中率  │ │ 总大小  │ │ 条目数  │        │
│  │  78.5%  │ │ 4.2 GB  │ │  1,234  │        │
│  │ ↑ 2.3%  │ │ ↓ 0.1G  │ │ → 12    │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  命中率趋势 (30 天)                           │
│  ┌────────────────────────────────────────┐  │
│  │ 📈 折线图: 78% → 82% → 75% → 79% ...   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  各级别缓存统计                               │
│  ┌────────────────────────────────────────┐  │
│  │ Level    │ 命中率 │ 大小   │ 条目 │     │  │
│  │ Global   │ 92.1%  │ 2.1 GB │ 456  │     │  │
│  │ Pipeline │ 71.3%  │ 1.8 GB │ 678  │     │  │
│  │ Task     │ 65.8%  │ 0.3 GB │ 100  │     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  缓存热点 Top 10                              │
│  ┌────────────────────────────────────────┐  │
│  │ Key              │ Hits │ Size │ Age   │  │
│  │ node-modules-... │ 342  │ 180M │ 2d    │  │
│  │ go-mod-cache-... │ 289  │ 95M  │ 1d    │  │
│  │ maven-repo-...   │ 156  │ 320M │ 5d    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [清理缓存] [刷新]                           │
└─────────────────────────────────────────────┘
```

### 5.2 多架构构建页面

**路由**: `/builds/:id/architectures`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  多架构构建  Build #1234                     │
├─────────────────────────────────────────────┤
│                                              │
│  目标架构: [✓ amd64] [✓ arm64] [ ] armv7     │
│                                              │
│  构建状态                                    │
│  ┌────────────────────────────────────────┐  │
│  │ amd64  ████████████░░  成功  3m 42s    │  │
│  │ arm64  ██████████████░  成功  4m 15s   │  │
│  │ armv7  ░░░░░░░░░░░░░░░  跳过            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Manifest List                               │
│  ┌────────────────────────────────────────┐  │
│  │ digest: sha256:abc123...               │  │
│  │ ├─ amd64  sha256:def456...  45.2 MB    │  │
│  │ └─ arm64  sha256:ghi789...  42.8 MB    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [重新构建] [查看日志]                       │
└─────────────────────────────────────────────┘
```

### 5.3 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/BuildCacheMonitor/index.tsx` | 新建 | 缓存监控面板 |
| `src/pages/BuildMultiArch/index.tsx` | 新建 | 多架构构建页面 |
| `src/pages/ArtifactList/index.tsx` | 修改 | 从内存切换为 API 调用 |
| `src/api/buildCache.ts` | 新建 | 缓存监控 API 客户端 |
| `src/api/artifact.ts` | 新建 | Artifact CRUD API 客户端 |
| `src/components/CacheHitRateChart/index.tsx` | 新建 | 命中率趋势图组件 |
| `src/components/ArchBuildStatus/index.tsx` | 新建 | 多架构构建状态组件 |
| `src/components/CacheSizeGauge/index.tsx` | 新建 | 缓存大小仪表组件 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| ArtifactRepository | `repositories/ArtifactRepository.ts` | CRUD/分页/过期清理（10 cases） |
| BuildCacheMonitorService | `services/build/BuildCacheMonitorService.ts` | 命中率计算/热点分析/趋势（12 cases） |
| MultiArchBuildService | `services/build/MultiArchBuildService.ts` | 并行构建/manifest 生成（8 cases） |
| IncrementalBuildService | `services/build/IncrementalBuildService.ts` | hash 对比/模块跳过（8 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| Artifact 完整生命周期 | 创建 → 查询 → 下载 → 清理过期 → 验证删除 |
| 缓存命中率统计 | 配置缓存 → 多次命中 → 验证命中率计算正确 |
| 多架构构建流程 | 配置 2 架构 → 并行构建 → 验证 manifest list 生成 |
| 增量构建跳过 | 第一次全量 → 记录 hash → 无变更构建 → 验证跳过所有模块 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 缓存监控 E2E | 前端查看命中率 → 触发清理 → 验证数据更新 |
| 多架构构建 E2E | 选择架构 → 触发构建 → 等待完成 → 验证 manifest |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 缓存统计查询 | < 100ms |
| Artifact 列表分页 | < 200ms |
| 多架构构建触发 | < 50ms（异步执行） |
| 增量检测计算 | < 200ms（10000 文件） |

### 7.2 安全性

| 要求 | 实现 |
|------|------|
| Tenant 隔离 | 所有 Artifact API 按 tenant_id 过滤 |
| 存储路径安全 | 禁止路径穿越，校验 storage_path |
| 校验和验证 | 上传/下载时验证 SHA256 校验和 |

### 7.3 可维护性

| 要求 | 实现 |
|------|------|
| 代码覆盖率 | > 80% |
| Repository 模式 | 所有数据访问通过 Repository |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| Artifact 持久化 | 1 | 1 | 0.5 |
| 缓存监控面板 | 2 | 2 | 1 |
| 多架构并行构建 | 2 | 1 | 1 |
| 增量构建 | 1.5 | 0.5 | 0.5 |
| **合计** | **6.5** | **4.5** | **3** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 编写中_
