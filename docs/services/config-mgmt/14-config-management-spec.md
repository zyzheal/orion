# 配置管理详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 已验证
> **能力域**: 14. 配置管理
> **目标成熟度**: L2 → L2.5
> **关键交付**: 特性标志管理

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- 配置管理 API（`api/config-routes.ts`，PostgreSQL backed）
- Config 表（`db/migrations/016_create_configs.sql`）
- 基础配置 CRUD

**不足**：
- 无特性标志（Feature Flag）管理
- 无配置版本历史与对比
- 无配置生效范围控制（按租户/环境/用户分组）
- 无配置变更审计与回滚
- 无 A/B 测试支持

### 1.2 Phase 3 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 特性标志管理 | 创建/切换/删除特性标志，支持渐进式发布 | L2.5 |
| 配置版本化 | 配置变更历史、对比、回滚 | L2.5 |
| 作用域控制 | 按租户/环境/用户分组精准控制配置生效 | L2.5 |
| A/B 测试 | 基于特性标志的 A/B 测试框架 | L2.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| CM1 | 特性标志支持 3 种发布策略：全量、百分比、用户列表 | API 测试 |
| CM2 | 配置变更自动记录历史，支持版本对比 | API 测试 |
| CM3 | 配置回滚：恢复到任意历史版本 | API 测试 |
| CM4 | 作用域控制：tenant + environment + userGroup 三级 | 单元测试 |
| CM5 | A/B 测试：同一特性标志可配置多组实验 | API 测试 |
| CM6 | 配置变更审计日志：谁在何时改了什么值 | 单元测试 |
| CM7 | 配置变更通知：关键配置变更触发告警 | 集成测试 |

## 三、API 设计

```
Base: /api/v1/config
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/flags` | 获取特性标志列表 | query: status | `{ data: FeatureFlag[], total }` |
| POST | `/flags` | 创建特性标志 | `CreateFeatureFlag` | `{ id, key }` |
| PUT | `/flags/:id` | 更新特性标志 | `UpdateFeatureFlag` | `{ ... }` |
| DELETE | `/flags/:id` | 删除特性标志 | - | `{ success }` |
| GET | `/flags/:id/evaluate` | 评估特性标志值 | query: userId?, tenantId? | `{ enabled, reason }` |
| GET | `/flags/:id/history` | 获取变更历史 | - | `{ data: ConfigVersion[] }` |
| POST | `/flags/:id/history/:version/rollback` | 回滚到历史版本 | - | `{ success }` |
| GET | `/flags/:id/history/:v1/diff/:v2` | 版本对比 | - | `{ additions, deletions }` |
| GET | `/experiments` | 获取 A/B 实验列表 | - | `{ data: ABExperiment[] }` |
| POST | `/experiments` | 创建 A/B 实验 | `CreateABExperiment` | `{ id, name }` |

```typescript
interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  type: 'boolean' | 'string' | 'number' | 'json';
  defaultValue: unknown;
  rolloutStrategy: RolloutStrategy;
  scopes: ConfigScope[];
  status: 'draft' | 'active' | 'archived';
  evaluationCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RolloutStrategy {
  type: 'all' | 'percentage' | 'user_list' | 'rule_based';
  percentage?: number;        // 0-100
  userList?: string[];        // user IDs
  rules?: {
    field: string;
    operator: string;
    value: unknown;
  }[];
}

interface ConfigScope {
  tenantId?: string;
  environment?: string;       // 'dev' | 'staging' | 'production'
  userGroup?: string;
  value: unknown;
}

interface ConfigVersion {
  id: string;
  flagId: string;
  version: number;
  changes: Record<string, { before: unknown; after: unknown }>;
  changedBy: string;
  changedAt: Date;
  reason: string;
}

interface ABExperiment {
  id: string;
  name: string;
  flagId: string;
  variants: {
    name: string;
    value: unknown;
    weight: number;           // 流量分配百分比
  }[];
  status: 'draft' | 'running' | 'completed' | 'stopped';
  startDate: Date;
  endDate?: Date;
  metrics: {
    metricName: string;
    variantResults: { variant: string; value: number }[];
  }[];
}

interface EvaluationResult {
  enabled: boolean;
  value: unknown;
  reason: string;             // 'default' | 'scope_match' | 'rollout' | 'experiment'
  experimentVariant?: string;
}
```

## 四、数据库变更

```sql
-- Migration 114: Feature Flag Management
CREATE TABLE IF NOT EXISTS feature_flags (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  key                   VARCHAR(200) NOT NULL,
  name                  VARCHAR(300),
  description           TEXT,
  flag_type             VARCHAR(20) DEFAULT 'boolean',
  default_value         JSONB,
  rollout_strategy      JSONB NOT NULL,
  scopes                JSONB DEFAULT '[]',
  status                VARCHAR(20) DEFAULT 'draft',
  evaluation_count      BIGINT DEFAULT 0,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, key)
);
CREATE INDEX idx_feature_flags_tenant ON feature_flags(tenant_id);
CREATE INDEX idx_feature_flags_key ON feature_flags(key);

CREATE TABLE IF NOT EXISTS config_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id               UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  version               INT NOT NULL,
  changes               JSONB NOT NULL,
  changed_by            UUID REFERENCES users(id),
  changed_at            TIMESTAMPTZ DEFAULT now(),
  reason                TEXT,

  UNIQUE(flag_id, version)
);
CREATE INDEX idx_config_versions_flag ON config_versions(flag_id, version DESC);

CREATE TABLE IF NOT EXISTS ab_experiments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  name                  VARCHAR(300) NOT NULL,
  flag_id               UUID REFERENCES feature_flags(id),
  variants              JSONB NOT NULL,
  status                VARCHAR(20) DEFAULT 'draft',
  start_date            TIMESTAMPTZ,
  end_date              TIMESTAMPTZ,
  metrics               JSONB DEFAULT '[]',
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ab_experiments_tenant ON ab_experiments(tenant_id);

CREATE TABLE IF NOT EXISTS config_audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  flag_id               UUID,
  action                VARCHAR(50),
  old_value             JSONB,
  new_value             JSONB,
  changed_by            UUID REFERENCES users(id),
  changed_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_config_audit_log_tenant ON config_audit_log(tenant_id, changed_at DESC);
```

## 五、前端设计

**路由**: `/feature-flags`

```
┌─────────────────────────────────────────────┐
│  特性标志管理                    [创建标志]  │
├─────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  │
│  │ dark_mode  ✅ 全量发布  eval: 12.5k    │  │
│  │   默认: true  类型: boolean             │  │
│  ├────────────────────────────────────────┤  │
│  │ new_checkout  🔄 50% 渐进  eval: 3.2k  │  │
│  │   默认: false  类型: boolean            │  │
│  ├────────────────────────────────────────┤  │
│  │ max_upload_size  📝 规则  eval: 8.1k   │  │
│  │   默认: 10MB  类型: number              │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [A/B 实验]  2 个运行中 | 5 个已完成          │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/FeatureFlags/index.tsx` | 新建 | 特性标志主页面 |
| `src/pages/FlagDetail/index.tsx` | 新建 | 标志详情/版本历史 |
| `src/pages/ABExperiments/index.tsx` | 新建 | A/B 实验页面 |
| `src/components/FlagEditor/index.tsx` | 新建 | 标志编辑器 |
| `src/api/feature-flags.ts` | 新建 | 特性标志 API |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 18 | FlagEvaluator、RolloutEngine、VersionManager |
| 集成测试 | 5 | 创建→配置→评估→回滚完整流程 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 评估延迟 | < 10ms |
| 配置变更生效 | < 5s（热加载） |
| 版本历史查询 | < 100ms |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 特性标志引擎 | 3 | 2 | 2 |
| 配置版本化 | 2 | 1 | 1 |
| 作用域控制 | 1 | 1 | 1 |
| A/B 测试 | 2 | 2 | 1.5 |
| **合计** | **8** | **6** | **5.5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
