# 数据库表结构规范对齐审查报告

> **日期**: 2026-05-22
> **审计范围**: `orion-platform-service/src/db/migrations/` 全部 211 个正向迁移文件（编号 001-182）
> **对照规范**: docs/superpowers/specs/2026-05-22-data-structure-analysis.md Section 5
> **补充审查**: docs/plans/orion-upgrade-executable-plan-2026-05-22.md Section 11 DDL

---

## 一、总体统计

| 指标 | 数量 | 说明 |
|------|------|------|
| 正向迁移文件 | 211 个 | 编号 001-182，含 055b/055c 后缀及 15 组重复编号 |
| 回滚迁移文件 | 175 个 | **37 个正向迁移无对应 rollback 文件** |
| 唯一表名数 | 441 张 | `CREATE TABLE` 去重后 |
| CREATE TABLE 总次数 | 473 次 | 含 **32 张重复定义的表** |
| 有 RLS 策略的表 | 63+ 张 | RLS 覆盖率 ~14%（63/441） |
| `tenant_id UUID` 正确类型 | 57 个迁移文件 | |
| `tenant_id` 类型错误 | 19 个迁移文件，64 处 | VARCHAR/INTEGER 混用 |
| SERIAL 主键 | 11 个迁移文件，17+ 张表 | 应统一 UUID |
| CHECK 约束 | 1 个迁移文件 | 几乎为零 |
| 软删除 (deleted_at) | 1 个迁移文件 | 几乎为零 |

---

## 二、合规率总览

| 检查维度 | 合规表数 | 问题表数 | 合规率 |
|----------|---------|---------|--------|
| 租户隔离（tenant_id UUID FK） | ~130 张 | 64 张（类型错误）+ 79 张（缺失） | **35%** |
| RLS 策略 | 63+ 张 | ~378 张 | **14%** |
| 主键策略（UUID vs SERIAL） | 424 张 | 17+ 张 | **96%** |
| 审计字段（created_at/updated_at） | ~380 张 | 60 张缺 updated_at | **84%** |
| created_by / updated_by | ~176 张 | ~265 张 | **40%** |
| CHECK 约束（状态枚举） | ~5 张 | ~436 张 | **1%** |
| 软删除（deleted_at） | ~4 张 | ~437 张 | **<1%** |
| 索引命名（idx_{table}_{column}） | ~380 张 | ~60 张 | **86%** |
| Rollback 覆盖 | 175 个文件 | 37 个文件 | **83%** |
| 迁移编号唯一性 | 166 个 | 45 个文件（15 组重复） | **79%** |
| 无重复表名 | 409 张 | 32 张（重复定义） | **93%** |

**综合合规率：约 45%（有至少一个问题的表 243 / 总表 441）**

---

## 三、P0 Bug（数据不一致 / 运行时错误风险）

### P0-1: `tenant_id` 类型严重不一致（64 处，19 个迁移文件）

**问题**: 规范 `tenant_id UUID NOT NULL REFERENCES tenants(id)` 被大量违反，出现 `VARCHAR(32)`、`VARCHAR(64)`、`VARCHAR(255)`、`INTEGER` 四种错误类型。

| 表名 | 当前类型 | 所在迁移 | 违规类型 |
|------|---------|---------|---------|
| `sessions` | `VARCHAR(255)` | 051_create_sessions.sql | P0 FK 类型不匹配 |
| `events` | `VARCHAR(36)` | 054_create_event_bus_tables.sql | P0 无法关联 tenants |
| `event_outbox` | `VARCHAR(36)` | 054_create_event_bus_tables.sql | P0 无法关联 tenants |
| `confirmation_tasks` | `VARCHAR(255)` | 056_create_confirmation_tables.sql | P0 |
| `token_blacklist` | `INTEGER` | 072_create_token_blacklist.sql | P0 整型无法关联 UUID |
| `chatops_messages` | `INTEGER` | 073_enable_rls_policies.sql | P0 ALTER COLUMN 追加列 |
| `tenant_privacy_policies` | `INTEGER` | 076_create_privacy_policy.sql | P0 |
| `sanitization_audit_logs` | `INTEGER` | 076_create_privacy_policy.sql | P0 |
| `degradation_audit_logs` | `INTEGER` | 077_create_degradation_audit.sql | P0 |
| `security_scan_results` | `VARCHAR(32)` | 079_create_security_scan.sql | P0 |
| `security_vulnerabilities` | `VARCHAR(32)` | 079_create_security_scan.sql | P0 |
| `llm_traces` | `INTEGER` | 080_create_llm_traces.sql | P0 |
| `llm_token_daily_stats` | `INTEGER` | 080_create_llm_traces.sql | P0 |
| `cross_domain_workflows` | `VARCHAR(255)` | 165_create_cross_domain_workflows.sql | P0 |
| `cross_domain_workflow_steps` | 无 tenant_id | 165 | P0 间接继承 |
| `cross_domain_executions` | 无 tenant_id | 165 | P0 |
| `cross_domain_execution_steps` | 无 tenant_id | 165 | P0 |
| `malicious_detections` | `VARCHAR(64)` | 116_create_artifact_ops_tables.sql | P0 |
| `supply_chain_alerts` | `VARCHAR(64)` | 116 | P0 |
| `sbom_enrichment` | `VARCHAR(64)` | 116 | P0 |
| `artifact_signatures` | `VARCHAR(64)` | 116 | P0 |
| `compliance_records` | `VARCHAR(64)` | 116 | P0 |
| `compliance_policies` | `VARCHAR(255)` | 115 | P0 |
| `compliance_evaluations` | `VARCHAR(255)` | 115 | P0 |
| `compliance_evidence` | `VARCHAR(255)` | 115 | P0 |
| `compliance_tasks` | `VARCHAR(255)` | 115 | P0 |
| `compliance_templates` | `VARCHAR(255)` | 115 | P0 |
| `compliance_audit_logs` | `VARCHAR(255)` | 115 | P0 |
| `compliance_waivers` | `VARCHAR(255)` | 115 | P0 |
| `compliance_dashboard` | `VARCHAR(255)` | 115 | P0 |
| `compliance_rules` | `VARCHAR(255)` | 115 | P0 |
| `performance_baselines` | `VARCHAR(36)` | 117_create_performance_tables.sql | P0 |
| `performance_profiles` | `VARCHAR(36)` | 117 | P0 |
| `performance_anomalies` | `VARCHAR(36)` | 117 | P0 |
| `performance_slo_targets` | `VARCHAR(36)` | 117 | P0 |
| `resource_pools` | `VARCHAR(255)` | 120_create_resource_abstraction_tables.sql | P0 |
| `resource_allocations` | `VARCHAR(255)` | 120 | P0 |
| `api_contracts` | `VARCHAR(255)` | 150_create_api_governance_cost_optimization_tables.sql | P0 |
| `api_versions` | `VARCHAR(255)` | 150 | P0 |
| `api_contract_violations` | `VARCHAR(255)` | 150 | P0 |
| `governance_rules` | `VARCHAR(255)` | 150 | P0 |
| `api_inventory` | `VARCHAR(255)` | 150 | P0 |
| `cost_recommendations` | `VARCHAR(255)` | 150 | P0 |
| `savings_tracking` | `VARCHAR(255)` | 150 | P0 |
| `approval_gates` | `VARCHAR(255)` | 151_create_approval_gates_table.sql | P0 |
| `jwt_key_rotation` | 无 tenant_id | 071 | P0 安全表缺失租户 |
| `token_blacklist` | `INTEGER` | 072 | P0 |

**修复 SQL 模板**:

```sql
-- 批量修复 tenant_id 类型为 UUID 并追加外键
-- 示例：llm_traces (080)
ALTER TABLE llm_traces ALTER COLUMN tenant_id TYPE UUID USING NULLIF(tenant_id, '')::UUID;
ALTER TABLE llm_traces ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE llm_traces ADD CONSTRAINT fk_llm_traces_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- 示例：cross_domain_workflows (165) - VARCHAR(255) -> UUID
ALTER TABLE cross_domain_workflows ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
ALTER TABLE cross_domain_workflows ADD CONSTRAINT fk_cdw_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- 示例：chatops_messages (073 追加列) - INTEGER -> UUID
ALTER TABLE chatops_messages ALTER COLUMN tenant_id TYPE UUID USING NULL;
ALTER TABLE chatops_messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE chatops_messages ADD CONSTRAINT fk_chatops_messages_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
```

### P0-2: SERIAL 主键（11 个迁移文件，17+ 张表）

**问题**: 规范 `UUID PRIMARY KEY DEFAULT gen_random_uuid()` 被违反，使用 `SERIAL` 自增整数主键。

| 表名 | 所在迁移 | 主键类型 |
|------|---------|---------|
| `jwt_key_rotation` | 071 | SERIAL |
| `jwt_key_rotation_history` | 071 | SERIAL |
| `token_blacklist` | 072 | SERIAL |
| `token_revocation_batch` | 072 | SERIAL |
| `consistency_checks` | 074 | SERIAL |
| `consistency_history` | 074 | SERIAL |
| `disaster_recovery_config` | 075 | SERIAL |
| `disaster_recovery_events` | 075 | SERIAL |
| `tenant_privacy_policies` | 076 | SERIAL |
| `sanitization_audit_logs` | 076 | SERIAL |
| `degradation_audit_logs` | 077 | SERIAL |
| `output_validation_rules` | 078 | SERIAL |
| `output_validation_results` | 078 | SERIAL |
| `llm_traces` | 080 | SERIAL |
| `llm_token_daily_stats` | 080 | SERIAL |
| `malicious_detections` | 116 | SERIAL |
| `chatops_temporary_permissions` | 163 | SERIAL |
| `permission_requests` | 163 | SERIAL |

**修复 SQL 模板**:

```sql
-- 迁移 080: llm_traces
ALTER TABLE llm_traces ADD COLUMN new_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE llm_traces DROP CONSTRAINT llm_traces_pkey;
ALTER TABLE llm_traces DROP COLUMN IF EXISTS id;
ALTER TABLE llm_traces RENAME COLUMN new_id TO id;
ALTER TABLE llm_traces ADD PRIMARY KEY (id);
-- 需要同步更新所有引用 llm_traces.id 的外键
```

### P0-3: 32 张表重复定义（跨迁移文件）

**问题**: 同一张表在多个迁移文件中被 `CREATE TABLE IF NOT EXISTS` 重复创建，不同文件可能定义不同列结构。

| 表名 | 定义位置 | 风险 |
|------|---------|------|
| `api_contracts` | 110, 150, 152（3 处） | 结构可能不一致 |
| `api_versions` | 110, 150, 152（3 处） | 结构可能不一致 |
| `api_contract_violations` | 110, 150, 152（3 处） | 结构可能不一致 |
| `governance_rules` | 150, 152（2 处） | 结构可能不一致 |
| `api_inventory` | 150, 152（2 处） | 结构可能不一致 |
| `iac_plans` | 032, 044（2 处） | 032 已有，044 重复 |
| `ephemeral_environments` | 025, 066（2 处） | 025 已有，066 重复 |
| `environment_templates` | 025, 066（2 处） | 结构可能不一致 |
| `notification_settings` | 048, 056（2 处） | 结构可能不一致 |
| `twin_snapshots` | 084, 149（2 处） | 结构可能不一致 |
| `sbom_waivers` | 026, 045（2 处） | 结构可能不一致 |
| `project_members` | 003, 其他（2 处） | 结构可能不一致 |
| `policy_overrides` | 027, 122（2 处） | 结构可能不一致 |
| `pipeline_budgets` | 031, 156（2 处） | 结构可能不一致 |
| `permission_audit_logs` | 050_authz, 167（2 处） | 结构可能不一致 |
| `performance_baselines` | 099, 117（2 处） | 结构可能不一致 |
| `performance_profiles` | 099, 117（2 处） | 结构可能不一致 |
| `cost_records` | 031, 094（2 处） | 结构可能不一致 |
| `chaos_experiments` | 083, 147（2 处） | 结构可能不一致 |
| `chaos_runs` | 083, 147（2 处） | 结构可能不一致 |
| `backup_configs` | 015, 其他（2 处） | 结构可能不一致 |
| `audit_findings` | 018, 其他（2 处） | 结构可能不一致 |
| `artifact_operations` | 014, 103, 116（3 处） | 结构可能不一致 |
| `artifact_promotions` | 014, 其他（2 处） | 结构可能不一致 |
| `compliance_policies` | 027, 115（2 处） | 结构可能不一致 |
| `compliance_evaluations` | 018, 115（2 处） | 结构可能不一致 |
| `chatops_approval_configs` | 115, 164（2 处） | 结构可能不一致 |
| `webhook_endpoints` | 021, 053（2 处） | 结构可能不一致 |
| `webhook_deliveries` | 021, 053（2 处） | 结构可能不一致 |
| `config_change_requests` | 063, 其他（2 处） | 结构可能不一致 |
| `efficiency_metrics` | 019, 096（2 处） | 结构可能不一致 |
| `ai_model_versions` | 082, 118（2 处） | 结构可能不一致 |

**修复方案**:

```sql
-- 新增迁移: 183_consolidate_duplicate_tables.sql
-- 步骤：
-- 1. 确认实际生效的表结构（第一个执行的 CREATE TABLE IF NOT EXISTS）
-- 2. 将后续迁移中的重复 CREATE TABLE 替换为 ALTER TABLE ADD COLUMN IF NOT EXISTS
-- 3. 将后续迁移中的 CREATE INDEX 替换为 CREATE INDEX IF NOT EXISTS
-- 4. 删除多余迁移文件或标记为已合并
```

### P0-4: 15 组迁移编号重复

**问题**: 多个文件共享同一编号，`schema_migrations` 追踪依赖文件名排序但语义混乱。

| 编号 | 文件数 | 文件列表 |
|------|--------|---------|
| 050 | 3 | authz_unified, chatops_role_management, create_self_healing_incidents |
| 051 | 3 | chatops_command_versions, create_sessions, create_teams |
| 052 | 3 | chatops_rate_limits, create_capabilities, create_knowledge_base |
| 053 | 3 | chatops_webhooks, create_build_cache_tables, create_metrics |
| 061 | 3 | create_ticketing_sub_services, create_weekly_reports, webhook_enhanced |
| 010 | 2 | create_approvals, create_artifact_registry |
| 011 | 2 | create_plugins, create_tickets_healing |
| 046 | 2 | create_chatops_admin_tables, create_product_line_tables |
| 049 | 2 | add_notification_type_columns, create_monitoring_rules_channels |
| 060 | 2 | create_api_market_tables, create_namespace_allocations |
| 077 | 2 | create_degradation_audit, create_inception_tables |
| 135 | 2 | create_artifact_version_tracking, create_pipeline_environments |
| 138 | 2 | create_quality_gates, create_sub_pipeline_invocations |
| 176 | 2 | add_subapp_api_domain, test_selector_relations |
| 178 | 2 | add_pipeline_version_and_yaml, workflow_timer_persistence |

**修复方案**: 新迁移严格使用唯一连续编号（183 起），对已有重复编号保持现状（`IF NOT EXISTS` 兜底）。

### P0-5: 2 个迁移编号缺失

| 缺失编号 | 说明 |
|----------|------|
| 041 | 完全缺失，无对应文件 |
| 085 | 完全缺失，无对应文件 |

---

## 四、P1 规范问题（不阻断但需修复）

### P1-1: RLS 覆盖率极低（~14%）

**问题**: 441 张表中仅 ~63 张有 RLS 策略。ChatOps（20+ 表）、AI（LLM traces 等）、DBA、用户系统大量缺失。

| 模块 | 表数 | 有 RLS | 缺失表 |
|------|------|--------|--------|
| ChatOps | 20+ | 0 | chatops_commands, chatops_messages, chatops_installations... |
| AI/LLM | 5+ | 0 | llm_traces, llm_token_daily_stats, ai_model_versions... |
| 用户系统 | 5+ | 0 | sessions, refresh_tokens, user_activities... |
| 合规 | 10+ | 0 | compliance_policies, compliance_evaluations... |
| API 治理 | 7+ | 0 | api_contracts, api_versions, governance_rules... |

**修复 SQL 模板**:

```sql
-- 为缺失 RLS 的表批量追加（新建迁移 184_enable_rls_batch.sql）
ALTER TABLE llm_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_llm_traces ON llm_traces
  USING (tenant_id::text = current_setting('app.current_tenant_id'));

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sessions ON sessions
  USING (tenant_id = current_setting('app.current_tenant_id'));
-- ... 逐表追加
```

### P1-2: 审计字段不完整

**问题**: `created_at` 覆盖较好，但 `updated_at`、`created_by`、`updated_by` 大量缺失。

| 字段 | 覆盖率 | 缺失规模 |
|------|--------|---------|
| `created_at` | ~95% | ~22 张表 |
| `updated_at` | ~84% | ~60 张表 |
| `created_by` | ~40% | ~265 张表 |
| `updated_by` | ~15% | ~375 张表 |

**`created_by` 命名变体**（5 种）:
- `created_by`（标准）
- `author_id`
- `owner_id`
- `deployed_by`
- `published_by`

**修复 SQL 模板**:

```sql
-- 批量追加缺失的 updated_at 列
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
-- ...

-- 批量追加 created_by / updated_by
ALTER TABLE monitoring_configs ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE monitoring_configs ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);
-- ...

-- 创建统一触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为每个有 updated_at 的表创建触发器
CREATE TRIGGER set_updated_at BEFORE UPDATE ON monitoring_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### P1-3: 3 种时间戳格式混用

| 格式 | 使用比例 | 示例 |
|------|---------|------|
| `TIMESTAMPTZ` | ~60% | `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` |
| `TIMESTAMP WITH TIME ZONE` | ~20% | 080_create_llm_traces.sql |
| `TIMESTAMP`（无时区） | ~20% | 048, 050, 051, 053, 165 等 |

**涉及文件（使用无时区 TIMESTAMP）**:
- 048_create_notification_settings.sql
- 050_chatops_role_management.sql
- 051_chatops_command_versions.sql
- 052_chatops_rate_limits.sql
- 053_chatops_webhooks.sql
- 165_create_cross_domain_workflows.sql（4 处）

**修复 SQL 模板**:

```sql
ALTER TABLE chatops_role_management ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
-- ... 逐表修复
```

### P1-4: CHECK 约束几乎为零

**问题**: 状态枚举字段（如 `status VARCHAR(30)`）几乎没有任何 CHECK 约束。

| 表 | 状态字段 | 应有 CHECK | 实际 |
|----|---------|-----------|------|
| pipelines | status | `IN ('active','inactive','archived')` | 无 |
| alerts | severity | `IN ('info','warning','critical')` | 无 |
| deployments | status | `IN ('pending','running','success','failed','rollback')` | 无 |
| inspection_runs | status | `IN ('running','completed','failed','cancelled')` | 计划中有，未实现 |

**修复 SQL 模板**:

```sql
ALTER TABLE pipelines ADD CONSTRAINT chk_pipelines_status
  CHECK (status IN ('active', 'inactive', 'archived'));

ALTER TABLE alerts ADD CONSTRAINT chk_alerts_severity
  CHECK (severity IN ('info', 'warning', 'critical'));

ALTER TABLE deployments ADD CONSTRAINT chk_deployments_status
  CHECK (status IN ('pending', 'running', 'success', 'failed', 'rollback'));
```

### P1-5: 软删除（deleted_at）覆盖率极低

**问题**: 441 张表中仅 ~4 张有 `deleted_at`。核心业务表（pipelines, deployments, tickets 等）删除后无法恢复。

**修复 SQL 模板**:

```sql
-- 核心业务表追加软删除
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
-- ... 对需要软删除的业务表逐张追加
```

### P1-6: 37 个迁移文件缺少对应 rollback

| 迁移文件 | 说明 |
|----------|------|
| 046_create_chatops_admin_tables.sql | ChatOps 管理表 |
| 049_add_notification_type_columns.sql | 通知类型列追加 |
| 050_authz_unified.sql | 统一授权 |
| 050_chatops_role_management.sql | ChatOps 角色管理 |
| 051_chatops_command_versions.sql | ChatOps 命令版本 |
| 051_create_teams.sql | 团队表 |
| 052_chatops_rate_limits.sql | ChatOps 限流 |
| 052_create_capabilities.sql | 能力表 |
| 053_chatops_webhooks.sql | ChatOps Webhook |
| 060_create_api_market_tables.sql | API 市场 |
| 157-182 全部（26 个文件） | 最近迁移均无 rollback |

### P1-7: 165 号迁移全面违规

**表**: `cross_domain_workflows`（165_create_cross_domain_workflows.sql）

| 违规项 | 规范值 | 实际值 |
|--------|--------|--------|
| 主键类型 | `UUID DEFAULT gen_random_uuid()` | `VARCHAR(255) PRIMARY KEY` |
| tenant_id 类型 | `UUID NOT NULL REFERENCES tenants(id)` | `VARCHAR(255) NOT NULL DEFAULT 'default'` |
| 时间戳 | `TIMESTAMPTZ` | `TIMESTAMP`（无时区） |
| created_by 类型 | `VARCHAR(100)` | `VARCHAR(255)` |
| RLS 策略 | 必须有 | 缺失 |
| CHECK 约束 | 状态枚举应有 | 缺失 |

**这是单文件中违规最严重的迁移，建议优先修复**。

---

## 五、Section 11.5/11.6 新建表 DDL 审查

对照 `docs/plans/orion-upgrade-executable-plan-2026-05-22.md` 中 Section 11.5/11.6 的新建表 DDL：

### 11.5 新建 11 张表（智能巡检/容量规划/中间件运维）

| 表名 | 租户隔离 | RLS | 审计字段 | CHECK | 软删除 | 评价 |
|------|---------|-----|---------|-------|--------|------|
| inspection_plans | UUID FK | 有 | created_by, created_at, updated_at | 无 | 无 | P1: 缺 CHECK 和 deleted_at |
| inspection_runs | UUID FK | 有 | created_at 缺失 | 无 | 无 | P1: 缺 created_by, updated_at, deleted_at |
| inspection_results | UUID FK | 有 | recorded_at | 无 | 无 | P1: 缺 created_by, updated_at, deleted_at |
| inspection_actions | UUID FK | 有 | created_at | 无 | 无 | P1: 缺 created_by, updated_by, deleted_at |
| capacity_baselines | UUID FK | 有 | 完整 | 有 | 有 | **合规** |
| capacity_forecasts | UUID FK | 有 | 完整 | 有 | 有 | **合规** |
| capacity_alerts | UUID FK | 有 | 完整 | 有 | 有 | **合规** |
| middleware_instances | UUID FK | 有 | 完整 | 无 | 有 | P1: 缺 CHECK |
| middleware_health_checks | UUID FK | 有 | checked_at | 无 | 无 | P1: 缺审计+CHECK |
| middleware_metrics | UUID FK | 有 | collected_at | 无 | 无 | P1: 缺审计+CHECK |
| middleware_operations | UUID FK | 有 | started_at, completed_at | 无 | 无 | P1: 缺 CHECK |

**新建表合规率**: 3/11（27%） — 容量规划 3 张表完全合规，其余 8 张缺 CHECK/软删除/审计字段

### 修复建议（新建表）

```sql
-- inspection_runs 追加
ALTER TABLE inspection_runs ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE inspection_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE inspection_runs ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);
ALTER TABLE inspection_runs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE inspection_runs ADD CONSTRAINT chk_inspection_runs_trigger_type
  CHECK (trigger_type IN ('scheduled', 'manual'));
ALTER TABLE inspection_runs ADD CONSTRAINT chk_inspection_runs_status
  CHECK (status IN ('running', 'completed', 'failed', 'cancelled'));

-- inspection_results 追加
ALTER TABLE inspection_results ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE inspection_results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE inspection_results ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);
ALTER TABLE inspection_results ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE inspection_results ADD CONSTRAINT chk_inspection_results_result
  CHECK (result IN ('pass', 'fail', 'warning'));
ALTER TABLE inspection_results ADD CONSTRAINT chk_inspection_results_severity
  CHECK (severity IN ('info', 'warning', 'critical'));

-- inspection_actions 追加
ALTER TABLE inspection_actions ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE inspection_actions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE inspection_actions ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);
ALTER TABLE inspection_actions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE inspection_actions ADD CONSTRAINT chk_inspection_actions_type
  CHECK (action_type IN ('auto_fix', 'manual_fix', 'ignore', 'escalate'));
ALTER TABLE inspection_actions ADD CONSTRAINT chk_inspection_actions_status
  CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected'));

-- middleware_instances 追加
ALTER TABLE middleware_instances ADD CONSTRAINT chk_middleware_type
  CHECK (middleware_type IN ('redis', 'mysql', 'kafka', 'rabbitmq', 'elasticsearch', 'mongodb'));
ALTER TABLE middleware_instances ADD CONSTRAINT chk_middleware_status
  CHECK (status IN ('active', 'degraded', 'maintenance', 'retired'));
ALTER TABLE middleware_instances ADD CONSTRAINT chk_middleware_health
  CHECK (health_status IN ('healthy', 'warning', 'critical', 'unknown'));

-- middleware_health_checks 追加
ALTER TABLE middleware_health_checks ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE middleware_health_checks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE middleware_health_checks ADD CONSTRAINT chk_health_check_type
  CHECK (check_type IN ('connectivity', 'replication', 'cluster', 'performance'));
ALTER TABLE middleware_health_checks ADD CONSTRAINT chk_health_status
  CHECK (status IN ('healthy', 'warning', 'critical'));

-- middleware_metrics 追加
ALTER TABLE middleware_metrics ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE middleware_metrics ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- middleware_operations 追加
ALTER TABLE middleware_operations ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE middleware_operations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE middleware_operations ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);
ALTER TABLE middleware_operations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE middleware_operations ADD CONSTRAINT chk_ops_type
  CHECK (operation_type IN ('restart', 'scale', 'backup', 'restore', 'upgrade', 'config_change', 'failover'));
ALTER TABLE middleware_operations ADD CONSTRAINT chk_ops_status
  CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'rollback'));
```

---

## 六、修复优先级建议

| 优先级 | 修复项 | 工作量 | 风险 |
|--------|--------|--------|------|
| **P0** | 165 号迁移全面重写（主键/tenant_id/时间戳/RLS） | 0.5 天 | 中 |
| **P0** | tenant_id 类型统一（64 处 ALTER） | 1 天 | 高（需数据迁移） |
| **P0** | SERIAL 主键迁移 UUID（17+ 张表） | 2 天 | 高（需更新外键引用） |
| **P0** | 32 张重复表结构合并 | 1 天 | 中 |
| **P1** | RLS 策略批量追加（~378 张表） | 2 天 | 低 |
| **P1** | 审计字段批量追加 | 1 天 | 低 |
| **P1** | CHECK 约束追加（核心表 20+ 张） | 0.5 天 | 低 |
| **P1** | 新建表 DDL 补齐 CHECK/软删除/审计 | 0.5 天 | 无 |
| **P1** | 37 个迁移补写 rollback | 1 天 | 无 |
| **P1** | 时间戳格式统一 TIMESTAMPTZ | 0.5 天 | 低 |

**总预估工作量**: ~10 天（按优先级分 3 个批次）

---

## 七、新建迁移规范模板（183+ 号迁移必须遵守）

```sql
-- {编号}_{功能描述}.sql
-- 简短描述

CREATE TABLE IF NOT EXISTS {table_name} (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- 业务字段...
  status            VARCHAR(30) NOT NULL DEFAULT 'active',
  -- 审计字段
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        VARCHAR(100),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_{table_name} ON {table_name}
  USING (tenant_id::text = current_setting('app.current_tenant_id'));

-- 索引
CREATE INDEX idx_{table_name}_tenant ON {table_name}(tenant_id);
CREATE INDEX idx_{table_name}_status ON {table_name}(status);
CREATE INDEX idx_{table_name}_created_at ON {table_name}(created_at DESC);

-- CHECK 约束
ALTER TABLE {table_name} ADD CONSTRAINT chk_{table_name}_status
  CHECK (status IN ('active', 'inactive', 'archived'));
```

对应 rollback:

```sql
-- {编号}_{功能描述}_rollback.sql
DROP TABLE IF EXISTS {table_name} CASCADE;
```

---

*审计完成时间: 2026-05-22*
*审计工具: 正则扫描 + 人工复核 211 个迁移文件*
*后续行动: 按优先级分 3 个批次创建修复迁移*
