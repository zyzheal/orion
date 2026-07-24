# 制品运营详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 已验证
> **能力域**: 7. 制品运营
> **目标成熟度**: L1 → L1.5
> **关键交付**: 清理策略、归档

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现：
- Artifact Registry API（`api/artifact-routes.ts`）
- 制品基础 CRUD（上传、下载、列表、删除）
- 前端制品管理页面（`orion-frontend/`）

**不足**：
- 无自动清理策略（制品堆积占用存储）
- 无归档机制（冷存储归档）
- 无制品生命周期管理
- 无存储用量分析与优化建议

### 1.2 Phase 3 目标 (L1.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 清理策略 | 基于时间/数量/标签自动清理旧制品 | L1.5 |
| 归档机制 | 将冷制品归档到 S3/OSS，释放热存储 | L1.5 |
| 生命周期管理 | 制品从 hot → warm → cold → deleted 全流程 | L1.5 |
| 存储分析 | 存储用量分析、趋势、优化建议 | L1.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| A1 | 支持清理策略：保留最近 N 个版本、保留 N 天、按标签保留 | API 测试 |
| A2 | 清理策略按项目/仓库粒度配置 | API 测试 |
| A3 | 归档到 S3 兼容存储，支持恢复 | 集成测试 |
| A4 | 制品生命周期阶段自动迁移（hot → warm → cold → deleted） | 集成测试 |
| A5 | 存储用量按项目/类型/时间维度统计 | 前端验证 |
| A6 | 清理/归档操作前生成预览（显示将被影响的制品列表） | API 测试 |
| A7 | 归档制品元数据保留，可通过 API 搜索 | API 测试 |

## 三、API 设计

```
Base: /api/v1/artifacts
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/policies` | 获取清理策略 | query: projectId | `{ data: CleanupPolicy[] }` |
| POST | `/policies` | 创建清理策略 | `CleanupPolicyInput` | `{ id, name }` |
| PUT | `/policies/:id` | 更新清理策略 | `CleanupPolicyInput` | `{ ... }` |
| DELETE | `/policies/:id` | 删除清理策略 | - | `{ success }` |
| POST | `/policies/:id/dry-run` | 策略模拟运行 | - | `{ affectedArtifacts, estimatedSpaceSaved }` |
| POST | `/policies/:id/execute` | 执行清理策略 | - | `{ jobId, status }` |
| POST | `/archive` | 归档制品 | `{ artifactIds, targetStorage }` | `{ jobId, archivedCount }` |
| GET | `/archived` | 获取已归档制品 | query: search, page | `{ data: ArchivedArtifact[], total }` |
| POST | `/archived/:id/restore` | 恢复归档制品 | `{ targetStorage? }` | `{ artifactId, status }` |
| GET | `/storage-usage` | 存储用量分析 | query: period, groupBy | `{ byProject, byType, total, trend }` |

```typescript
interface CleanupPolicy {
  id: string;
  name: string;
  projectId?: string;
  repositoryType: 'docker' | 'maven' | 'npm' | 'generic';
  rules: CleanupRule[];
  schedule: string;  // cron expression
  enabled: boolean;
  dryRunLastAt?: Date;
  lastExecutedAt?: Date;
  lastCleanedCount: number;
}

interface CleanupRule {
  type: 'keep_last_n' | 'older_than_days' | 'keep_tagged';
  value: number;
  filter?: { tag?: string; branch?: string; status?: string };
}

interface ArchivedArtifact {
  id: string;
  originalId: string;
  name: string;
  version: string;
  repositoryType: string;
  sizeBytes: number;
  archivedAt: Date;
  archiveLocation: string;   // S3 URI
  expiresAt?: Date;          // 自动删除时间
  restored: boolean;
}

interface StorageUsage {
  byProject: { projectId: string; name: string; bytes: number; percent: number }[];
  byType: { type: string; bytes: number; count: number }[];
  total: number;
  trend: { date: string; bytes: number }[];
  recommendations: string[];
}
```

## 四、数据库变更

```sql
-- Migration 107: Artifact Operations
CREATE TABLE IF NOT EXISTS artifact_cleanup_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  name                  VARCHAR(200) NOT NULL,
  project_id            UUID,
  repository_type       VARCHAR(50) NOT NULL,
  rules                 JSONB NOT NULL,
  schedule              VARCHAR(50) DEFAULT '0 2 * * *',
  enabled               BOOLEAN DEFAULT true,
  last_executed_at      TIMESTAMPTZ,
  last_cleaned_count    INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_artifact_cleanup_policies_tenant ON artifact_cleanup_policies(tenant_id);

CREATE TABLE IF NOT EXISTS archived_artifacts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  original_artifact_id  UUID,
  name                  VARCHAR(500),
  version               VARCHAR(100),
  repository_type       VARCHAR(50),
  size_bytes            BIGINT,
  archive_location      VARCHAR(500),
  archived_at           TIMESTAMPTZ DEFAULT now(),
  archived_by           UUID REFERENCES users(id),
  expires_at            TIMESTAMPTZ,
  restored              BOOLEAN DEFAULT false
);
CREATE INDEX idx_archived_artifacts_tenant ON archived_artifacts(tenant_id);
CREATE INDEX idx_archived_artifacts_name ON archived_artifacts(name);

CREATE TABLE IF NOT EXISTS artifact_storage_usage (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  project_id            UUID,
  artifact_type         VARCHAR(50),
  total_bytes           BIGINT DEFAULT 0,
  artifact_count        INT DEFAULT 0,
  recorded_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_artifact_storage_usage_tenant ON artifact_storage_usage(tenant_id, recorded_at DESC);
```

## 五、前端设计

**路由**: `/artifact-operations`

```
┌─────────────────────────────────────────────┐
│  制品运营                                    │
├─────────────────────────────────────────────┤
│  存储用量: 128 GB / 500 GB  [▓▓░░░░░░░░]    │
│  制品总数: 15,420 | 归档: 8,200              │
├─────────────────────────────────────────────┤
│  清理策略                        [创建策略]  │
│  ┌────────────────────────────────────────┐  │
│  │ Node.js 项目  保留最近 10 个  每周执行  │  │
│  │   上次清理: 删除 23 个，释放 1.2 GB     │  │
│  ├────────────────────────────────────────┤  │
│  │ Docker 镜像  保留 30 天  每天执行       │  │
│  │   上次清理: 删除 5 个，释放 800 MB      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  归档管理                                    │
│  [搜索归档] [执行归档] [查看存储分析]         │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/ArtifactOperations/index.tsx` | 新建 | 制品运营主页面 |
| `src/pages/StorageAnalysis/index.tsx` | 新建 | 存储分析页面 |
| `src/components/CleanupPolicyEditor/index.tsx` | 新建 | 清理策略编辑器 |
| `src/api/artifact-ops.ts` | 新建 | 制品运营 API |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 15 | CleanupEngine、ArchiveService、LifecycleManager |
| 集成测试 | 5 | 清理策略执行→验证、归档→恢复完整流程 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 清理策略执行 | 后台异步，不阻塞 API |
| 归档传输速率 | > 100 MB/s |
| 存储分析计算 | < 10s（10 万制品） |
| 归档制品恢复 | < 5 分钟 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 清理策略引擎 | 3 | 1 | 2 |
| 归档服务 | 3 | 1 | 1 |
| 生命周期管理 | 1 | - | 1 |
| 存储分析 | 1 | 2 | 1 |
| **合计** | **8** | **4** | **5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
