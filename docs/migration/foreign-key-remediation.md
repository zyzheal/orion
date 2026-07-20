# 外键约束补充方案 (Foreign Key Remediation)

> Phase 5.4: 将外键约束覆盖率从 48% 提升至 100%。

## 现状分析

### 总体统计

| 指标 | 数值 |
|------|------|
| 总迁移文件数 | 135 |
| 含外键约束的文件 | 65 (48%) |
| 缺外键约束的文件 | 70 (52%) |
| CREATE TABLE 语句总数 | 675 |

### 缺外键的 70 个文件清单

按服务分组：

| 服务 | 缺FK文件 | 核心问题 |
|------|---------|---------|
| **orion-finops-svc-go** | 5 | `tenant_id` 无 `REFERENCES tenants(id)` |
| **orion-monitor-svc** | 3 | `project_id`, `rule_id`, `alert_policy_id` 悬空 |
| **orion-ci-cd-svc-go** | 4 | `tenant_id` UUID 无 FK 指向 `tenants` |
| **orion-governance-svc-go** | 4 | `policy_id`, `rule_id`, `tenant_id` 无引用 |
| **orion-notification-svc-go** | 6 | `channel_id`, `rule_id`, `tenant_id` 无 FK |
| **orion-event-bus-svc-go** | 3 | `topic_id`, `consumer_group_id` 无引用 |
| **orion-config-mgmt-svc-go** | 3 | `namespace`, `tenant_id` 无约束 |
| **orion-llm-svc** | 1 | `model_id`, `tenant_id` |
| **orion-ai-svc-go** | 2 | `skill_id`, `tenant_id` |
| **orion-inspection-svc-go** | 1 | `template_id`, `tenant_id` |
| **orion-deploy-svc** | 2 | `environment_id`, `tenant_id` |
| **orion-workflow-svc-go** | 2 | `approval_id`, `tenant_id` |
| **orion-pipeline-svc** | 3 | `template_id`, `tenant_id` |
| **orion-community-svc-go** | 1 | `tenant_id` |
| **orion-identity-svc-go** | 2 | `user_id`, `tenant_id` |
| **orion-visor-svc-go** | 2 | `tenant_id` |
| **orion-lowcode-svc-go** | 1 | `tenant_id` |
| **orion-infra-ops-svc-go** | 3 | `tenant_id` |
| **orion-federation-svc** | 2 | `tenant_id`, `service_id` |
| **orion-alert-breaker-svc-go** | 1 | `tenant_id` |
| **orion-community-svc** | 1 | `tenant_id` |
| **orion-efficiency-svc** | 2 | `tenant_id` |
| **orion-llm-trace-svc-py** | 1 | `tenant_id` |
| **orion-ai-svc** | 1 | `tenant_id` |
| **orion-cmdb-svc** | 1 | `parent_id` (自引用) |
| **orion-agent-svc** | 1 | `tenant_id` |
| **orion-pandawiki-svc** | 1 | `tenant_id` |
| **orion-graph-svc** | 1 | `tenant_id` |
| **orion-visor-svc** | 1 | `tenant_id` |
| **orion-security-svc-rust** | 1 | `tenant_id` |

## 约束缺失分类

### 类型 1: tenant_id 无外键 (最常见，~60 个文件)

**原因**: `tenants` 表在 `orion-platform-core` 服务中定义，Go/TS 微服务迁移文件各自独立，跨服务引用被省略。

**影响**: 数据一致性风险 — 可以插入不存在的 tenant_id。

**修复策略**: 添加 `REFERENCES tenants(id)` 约束。跨服务场景使用 `deferrable initially deferred` 避免插入顺序问题。

### 类型 2: 同模块内 FK 缺失 (~15 个文件)

**原因**: 同模块内表间的引用关系未定义。

**影响**: 级联删除不生效，数据残留。

**修复策略**: 添加 `REFERENCES parent_table(id) ON DELETE CASCADE`。

### 类型 3: 自引用 FK 缺失 (~5 个文件)

**原因**: `parent_id` 指向同表的 `id`。

**影响**: 层级数据完整性不保证。

**修复策略**: 添加 `REFERENCES self(id) ON DELETE SET NULL`。

## 修复迁移模板

### 模板 1: 添加 tenant_id 外键

```sql
-- Migration: 002_add_fk_tenants.sql
-- Add foreign key constraints for tenant_id

ALTER TABLE cloud_costs
  ADD CONSTRAINT fk_cloud_costs_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE k8s_costs
  ADD CONSTRAINT fk_k8s_costs_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE saas_costs
  ADD CONSTRAINT fk_saas_costs_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE budget_alerts
  ADD CONSTRAINT fk_budget_alerts_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
```

### 模板 2: 同模块内 FK

```sql
-- Migration: 003_add_intra_module_fks.sql
ALTER TABLE pipeline_runs
  ADD CONSTRAINT fk_pipeline_runs_pipeline
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE;

ALTER TABLE stages
  ADD CONSTRAINT fk_stages_run
  FOREIGN KEY (run_id) REFERENCES pipeline_runs(id) ON DELETE CASCADE;

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_stage
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE;
```

### 模板 3: 自引用 FK

```sql
-- Migration: 004_add_self_reference_fks.sql
ALTER TABLE cmdb_assets
  ADD CONSTRAINT fk_cmdb_assets_parent
  FOREIGN KEY (parent_id) REFERENCES cmdb_assets(id) ON DELETE SET NULL;
```

## 跨服务 FK 的特殊处理

对于引用 `tenants`, `users`, `projects` 等核心表的列，由于核心表在 `orion-platform-core` 中定义，
微服务独立迁移时需要考虑：

1. **选项 A (推荐)**: 使用 `ON COMMIT PRESERVE ROWS` + 应用层校验，不做数据库级 FK
2. **选项 B**: 在 `tenants` 表所在 schema 中添加 `CREATE SCHEMA IF NOT EXISTS core`，然后引用 `core.tenants(id)`
3. **选项 C (当前采用)**: 在独立迁移文件中跳过核心表 FK，仅在聚合迁移中添加

## 执行计划

| 波次 | 范围 | 文件数 | 预计工作量 |
|------|------|--------|-----------|
| Wave 1 | 同模块内 FK 补全 | ~15 文件 | 2 小时 |
| Wave 2 | 跨服务 tenant_id FK | ~50 文件 | 4 小时 |
| Wave 3 | 自引用 FK | ~5 文件 | 1 小时 |

**总计**: 70 个文件，约 7 小时。
