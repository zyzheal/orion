# 软删除统一方案 (Soft Delete Unification)

> Phase 5.5: 将软删除覆盖率从 0.7% 提升至 100%。

## 现状分析

### 迁移 SQL 文件统计

| 指标 | 数值 |
|------|------|
| 总迁移文件数 | 135 |
| 含 `deleted_at` 列的文件 | 1 (0.7%) |
| CREATE TABLE 语句 | 675 个 |
| 含 `deleted_at` 的表 | 1 (artifacts) |

### Go 代码中的软删除使用

扫描 `orion-platform-svc-go/` 和 `blueprints/orion-*-svc-go/` 发现 **严重不一致**：

| 服务/模块 | 代码使用 deleted_at | 迁移有 deleted_at | 状态 |
|-----------|-------------------|------------------|------|
| **orion-ci-cd-svc-go/pipeline** | ✅ `DeletedAt` in models + repository queries | ❌ 无 | **严重 GAP** |
| **orion-platform-svc-go/tenant** | ✅ `WHERE deleted_at IS NULL` | ❌ 无 | **严重 GAP** |
| **orion-platform-svc-go/artifact** | ✅ repository queries | ❌ 无 | **严重 GAP** |
| **orion-platform-svc-go/circuit-breaker** | ✅ `deleted_at IS NULL` | ❌ 无 | **严重 GAP** |
| **orion-platform-svc-go/mcp** | ✅ repository queries | ❌ 无 | **严重 GAP** |
| **orion-platform-svc-go/config** | ✅ `SoftDelete()` method | ❌ 无 | **严重 GAP** |
| **orion-identity-svc-go/tenant** | ✅ `SoftDelete()` method | ❌ 无 | **严重 GAP** |

### 唯一有 deleted_at 的迁移文件

```sql
-- blueprints/orion-artifact-svc/migrations/001_init.sql
-- 唯一包含 deleted_at 的迁移文件
CREATE TABLE artifacts (
    ...
    deleted_at TIMESTAMP WITH TIME ZONE,
    ...
);
```

## 根因分析

1. **代码先行**: Go 服务代码在设计时已约定使用 `deleted_at` 做软删除，但迁移文件创建时遗漏
2. **TS 服务缺失**: TypeScript 服务（如 `orion-pipeline-svc`）的迁移文件也普遍缺少 `deleted_at`
3. **无统一规范**: 没有强制要求所有表必须有 `deleted_at` 列

## 统一方案

### 规范定义

**所有业务表必须包含 `deleted_at` 列：**

```sql
deleted_at TIMESTAMPTZ, -- NULL = active, SET = soft-deleted
```

### 例外表（不需要软删除）

以下类型的表可以省略 `deleted_at`：

| 类型 | 理由 | 示例表 |
|------|------|--------|
| **审计日志** | 不可删除，法律合规要求 | `audit_logs`, `permission_audit_logs` |
| **系统配置** | 全局生效，删除会破坏系统 | `permissions` |
| **枚举/字典** | 静态参考数据 | `role_inheritance` |
| **级联子表** | 依赖主表生命周期 | `role_permissions` (主表删除时级联删除) |

### 添加策略

对于已有数据且代码已引用 `deleted_at` 的表，使用 `ALTER TABLE` 添加列并设置默认值：

```sql
ALTER TABLE pipelines ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
```

## 需要添加 deleted_at 的表清单

### 高优先级（代码已引用，GAP 最严重）

| 服务 | 表名 | 文件 |
|------|------|------|
| orion-ci-cd-svc-go | `pipelines` | `pipeline_001_create_pipeline_tables.sql` |
| orion-ci-cd-svc-go | `pipeline_runs` | `pipeline_001_create_pipeline_tables.sql` |
| orion-ci-cd-svc-go | `stages` | `pipeline_001_create_pipeline_tables.sql` |
| orion-ci-cd-svc-go | `tasks` | `pipeline_001_create_pipeline_tables.sql` |
| orion-ci-cd-svc-go | `builds` | `build_001_create_build_tables.sql` |
| orion-ci-cd-svc-go | `deployments` | `deploy_001_create_deploy_tables.sql` |
| orion-ci-cd-svc-go | `artifacts` | `build_002_extend_build_and_artifacts.sql` |
| orion-platform-svc-go | `tenants` | (platform-core 迁移) |
| orion-platform-svc-go | `circuit_breakers` | (platform-core 迁移) |
| orion-platform-svc-go | `mcp_servers` | (platform-core 迁移) |

### 中优先级（业务表，建议添加）

| 服务 | 表名 | 文件 |
|------|------|------|
| orion-finops-svc-go | `cloud_costs` | `001_create_finops_tables.sql` |
| orion-finops-svc-go | `k8s_costs` | `001_create_finops_tables.sql` |
| orion-finops-svc-go | `saas_costs` | `001_create_finops_tables.sql` |
| orion-finops-svc-go | `budget_alerts` | `001_create_finops_tables.sql` |
| orion-alert-breaker-svc-go | `alert_breaker_rules` | `001_create_tables.sql` |
| orion-governance-svc-go | `compliance_policies` | `001_create_compliance_tables.sql` |
| orion-governance-svc-go | `risk_assessments` | `003_create_risk_tables.sql` |
| orion-inspection-svc-go | `inspection_results` | `001_create_inspection_tables.sql` |

### 完整修复迁移文件

为每个缺少的文件生成 `002_add_soft_delete.sql` 迁移文件。

## 执行计划

| 波次 | 范围 | 文件数 | 操作 |
|------|------|--------|------|
| Wave 1 | Go 代码已引用 `deleted_at` 但迁移缺失 | 10+ 表 | `ALTER TABLE ADD COLUMN` |
| Wave 2 | 所有业务表添加 `deleted_at` | ~120 表 | 更新 CREATE TABLE |
| Wave 3 | 审计日志/配置表标注跳过理由 | ~20 表 | 文档记录 |
