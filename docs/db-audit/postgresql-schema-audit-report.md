# Orion PostgreSQL 数据库结构审计报告

**审计日期**: 2026-05-22
**迁移文件数**: 202 正向迁移 + 对应 rollback 文件
**审计范围**: 重复编号冲突、外键类型不匹配、tenant_id 类型不一致、重复表名

---

## P0-1 重复编号迁移冲突分析

### 问题概述

15 组迁移编号（共 36 个文件）共享同一编号前缀，执行顺序不确定。

### 详细分析

| 编号 | 文件数 | 文件列表 | FK 依赖关系 | 顺序风险 |
|------|--------|---------|------------|---------|
| **010** | 2 | `010_create_approvals.sql`<br>`010_create_artifact_registry.sql` | 无互相依赖。approvals 引用 tenants/users，artifact_registry 无 FK | 低风险 - 两组表互相独立 |
| **011** | 2 | `011_create_plugins.sql`<br>`011_create_tickets_healing.sql` | 无互相依赖。plugins 无 FK；tickets 引用 tenants/users | 低风险 - 两组表互相独立 |
| **046** | 2 | `046_create_chatops_admin_tables.sql`<br>`046_create_product_line_tables.sql` | 无互相依赖。chatops 表无外部 FK；product_lines 引用 tenants | 低风险 |
| **049** | 2 | `049_add_notification_type_columns.sql` (ALTER TABLE)<br>`049_create_monitoring_rules_channels.sql` | ALTER 依赖 notifications 表已存在（017）；monitoring 表引用 tenants | **中风险** - ALTER 必须晚于 017 |
| **050** | 3 | `050_authz_unified.sql`<br>`050_chatops_role_management.sql`<br>`050_create_self_healing_incidents.sql` | authz 引用 tenants/users/projects；self_healing_incidents 无外部 FK；chatops_roles 无外部 FK | 低风险 - 互相独立 |
| **051** | 3 | `051_chatops_command_versions.sql`<br>`051_create_sessions.sql`<br>`051_create_teams.sql` | command_versions 无外部 FK；sessions 无外部 FK；teams 引用 tenants/users | 低风险 |
| **052** | 3 | `052_chatops_rate_limits.sql`<br>`052_create_capabilities.sql`<br>`052_create_knowledge_base.sql` | capabilities 引用 users；kb_spaces/kb_docs 引用 tenants/users；rate_limits 无 FK | 低风险 |
| **053** | 3 | `053_chatops_webhooks.sql`<br>`053_create_build_cache_tables.sql`<br>`053_create_metrics.sql` | webhooks 无外部 FK；build_cache_entries 引用 build_cache_configs（同文件）；metrics 无 FK | 低风险 |
| **060** | 2 | `060_create_api_market_tables.sql`<br>`060_create_namespace_allocations.sql` | api 表引用 users；namespace_allocations 无外部 FK | 低风险 |
| **061** | 3 | `061_create_ticketing_sub_services.sql`<br>`061_create_weekly_reports.sql`<br>`061_webhook_enhanced.sql` | ticketing 引用 tickets/users（011）；weekly_reports 无 FK；webhook 引用 users | **中风险** - ticketing 依赖 011 的 tickets 表 |
| **077** | 2 | `077_create_degradation_audit.sql`<br>`077_create_inception_tables.sql` | degradation_audit 无外部 FK；inception 无外部 FK | 低风险 |
| **135** | 2 | `135_create_artifact_version_tracking.sql`<br>`135_create_pipeline_environments.sql` | artifact_version 引用 tenants；pipeline_environments 无外部 FK | 低风险 |
| **138** | 2 | `138_create_quality_gates.sql`<br>`138_create_sub_pipeline_invocations.sql` | 均无外部 FK | 低风险 |
| **176** | 2 | `176_add_subapp_api_domain.sql` (ALTER TABLE)<br>`176_test_selector_relations.sql` | ALTER 依赖 subapp_configs 表（175）；test_selector 引用 test_cases/pipeline_runs/artifact_registry | **中风险** - ALTER 依赖 175 先执行 |
| **178** | 2 | `178_add_pipeline_version_and_yaml.sql` (ALTER TABLE)<br>`178_workflow_timer_persistence.sql` | ALTER 依赖 pipelines 表（004）；workflow_timers 动态 FK 到 lowcode_workflow_instance（180） | **高风险** - 178 动态 FK 引用 180 才创建的表 |

### 重新编号方案

```
原编号  重编号  文件名                               说明
010     010     010_create_approvals.sql
010     011     010_create_artifact_registry.sql     后续全部 +1
011     012     011_create_plugins.sql
011     013     011_create_tickets_healing.sql
012-045 014-047 原 012-045 全部 +2
046     048     046_create_chatops_admin_tables.sql
046     049     046_create_product_line_tables.sql
049     051     049_add_notification_type_columns.sql
049     052     049_create_monitoring_rules_channels.sql
050-052 原050→053, 原051→056, 原052→059 (每组+3)
053-059 原053→062 ... 依此类推
```

**推荐方案**: 使用后缀而非全量重编号，最小化改动：

```
010a → 010  (approvals)
010b → 010b (artifact_registry)
011a → 011  (plugins)
011b → 011b (tickets_healing)
...
```

但 PostgreSQL 迁移工具（如 node-pg-migrate/flyway）按文件名排序，字母序 "010b" > "010"，所以只需确保文件名唯一即可。当前文件名已经唯一，**实际执行风险取决于迁移框架是按前缀分组还是按完整文件名排序**。

**结论**: 如果迁移框架按完整文件名排序（多数框架如此），则当前顺序是确定的，无需重编号。但需要在迁移框架配置中确认这一点。

---

## P0-2 外键类型不匹配根因分析

### 已确认的类型不匹配

| # | 引用文件 | 引用列 | 被引用表 | 被引用列类型 | 问题 | 严重程度 |
|---|---------|--------|---------|------------|------|---------|
| 1 | `178_workflow_timer_persistence.sql` | `workflow_timers.instance_id VARCHAR(255)` | `lowcode_workflow_instance.id` | `VARCHAR(100)` | VARCHAR(255) 无法 FK 引用 VARCHAR(100)，PostgreSQL 要求精确类型匹配 | **P0** |
| 2 | `178_workflow_timer_persistence.sql` | `workflow_instance_dependencies.parent_instance_id VARCHAR(255)` | `lowcode_workflow_instance.id` | `VARCHAR(100)` | 同上 | **P0** |
| 3 | `178_workflow_timer_persistence.sql` | `workflow_instance_dependencies.child_instance_id VARCHAR(255)` | `lowcode_workflow_instance.id` | `VARCHAR(100)` | 同上 | **P0** |
| 4 | `137_add_environment_to_pipeline_runs.sql` | `pipeline_runs.environment_id` 引用 `pipeline_environments(tenant_id, name)` | `VARCHAR(64), VARCHAR(64)` | 复合 FK 引用复合 UNIQUE 约束，但 135 中 pipeline_environments.tenant_id 是 VARCHAR(64)，pipeline_runs.tenant_id 是 UUID | **P1** |

### 用户提到的 165 号文件分析

`165_create_cross_domain_workflows.sql` 第 20 行：
```sql
workflow_id VARCHAR(255) NOT NULL REFERENCES cross_domain_workflows(id)
```

**实际检查**: `cross_domain_workflows.id` 在同一文件中定义为 `VARCHAR(255) PRIMARY KEY`。
→ **类型匹配，无问题**。用户提到的 UUID 不匹配不成立。

### 类型匹配的检查项（无问题）

| 引用关系 | 引用列类型 | 被引用列类型 | 状态 |
|---------|-----------|------------|------|
| capabilities(capability_id VARCHAR(100)) → capabilities(capability_id VARCHAR(100)) | VARCHAR(100) | VARCHAR(100) | OK |
| confirmation_requests(id VARCHAR(255)) 自引用 | VARCHAR(255) | VARCHAR(255) | OK |
| security_scans(id VARCHAR(64)) 自引用 | VARCHAR(64) | VARCHAR(64) | OK |
| retention_policies(id VARCHAR(64)) 自引用 | VARCHAR(64) | VARCHAR(64) | OK |
| performance_baselines(id VARCHAR(36)) 自引用 | VARCHAR(36) | VARCHAR(36) | OK |
| cross_domain_workflows(id VARCHAR(255)) 自引用 | VARCHAR(255) | VARCHAR(255) | OK |

### 修复 SQL

```sql
-- 修复 178: 将 VARCHAR(255) 改为 VARCHAR(100) 匹配 lowcode_workflow_instance.id
-- 方案 A: 修改 178 迁移文件中的列定义
-- workflow_timers.instance_id VARCHAR(100) NOT NULL
-- workflow_instance_dependencies.parent_instance_id VARCHAR(100) NOT NULL
-- workflow_instance_dependencies.child_instance_id VARCHAR(100) NOT NULL

-- 方案 B: 如果 lowcode_workflow_instance 已经部署，需要 ALTER
ALTER TABLE workflow_timers ALTER COLUMN instance_id TYPE VARCHAR(100);
ALTER TABLE workflow_instance_dependencies ALTER COLUMN parent_instance_id TYPE VARCHAR(100);
ALTER TABLE workflow_instance_dependencies ALTER COLUMN child_instance_id TYPE VARCHAR(100);
```

---

## P0-3 tenant_id 类型不一致分析

### 类型分布统计

| 类型 | 出现次数 | 表/列 | 备注 |
|------|---------|-------|------|
| **UUID** | ~120+ | 大多数表 | 标准类型，多数有 REFERENCES tenants(id) |
| **UUID NOT NULL** (无 FK) | ~15 | metrics, runner_pool, chaos_experiments 等 | 有 UUID 类型但缺少 FK 约束 |
| **VARCHAR(255)** | 14 | sessions, chatops_approval_configs, cross_domain_workflows, permission_audit_logs(167), api_contract_versions(150), approval_gates(151) 等 | **类型不一致** |
| **VARCHAR(100)** | 5 | sql_audit_history(077), quality_gates(138), risk_reports(149), twin_snapshots(149), workflow_sample_data(180) | **类型不一致** |
| **VARCHAR(64)** | 5 | notification_settings(048), pipeline_environments(135), pipeline_triggers(134), queue_jobs(148), secrets(132) | **类型不一致** |
| **VARCHAR(36)** | 4 | event_bus_tables(054), performance_baselines(117), api_contract_versions(150-部分) | **类型不一致** |
| **INTEGER** | 8 | namespace_allocations(060), token_blacklist(072), chatops_messages(073-ADD), privacy_policy(076), degradation_audit(077), llm_traces(080-2列) | **类型不一致** |
| **VARCHAR(36) DEFAULT 'default'** | 2 | event_bus_tables(054) | 带默认值 |

### 非 UUID 类型的详细清单

| 迁移文件 | 表名 | tenant_id 类型 | 有无 FK |
|---------|------|---------------|---------|
| 048 | notification_settings | VARCHAR(64) | 无 |
| 051 | sessions | VARCHAR(255) | 无 |
| 053 | metrics | UUID | 无 FK (NOT NULL) |
| 054 | events | VARCHAR(36) DEFAULT 'default' | 无 |
| 054 | event_subscriptions | VARCHAR(36) DEFAULT 'default' | 无 |
| 056 | confirmation_requests | VARCHAR(255) | 无 |
| 060 | namespace_allocations | INTEGER | 无 |
| 072 | token_blacklist | INTEGER | 无 |
| 073 | chatops_messages | INTEGER | 无 |
| 076 | privacy_policies | INTEGER | 无 |
| 076 | privacy_consent_records | INTEGER | 无 |
| 077 | degradation_audit_logs | INTEGER | 无 |
| 077 | sql_audit_history | VARCHAR(100) | 无 |
| 077 | sql_blacklist | VARCHAR(100) | 无 |
| 077 | inception_configs | VARCHAR(100) | 无 |
| 077 | audit_reports | VARCHAR(100) | 无 |
| 080 | llm_traces | INTEGER | 无 |
| 080 | llm_metrics | INTEGER | 无 |
| 125 | canary_traffic_configs | VARCHAR(255) (ADD COLUMN) | 无 |
| 125 | canary_traffic_history | VARCHAR(255) (ADD COLUMN) | 无 |
| 125 | federation_executors | VARCHAR(255) (ADD COLUMN) | 无 |
| 125 | federation_executor_health | VARCHAR(255) (ADD COLUMN) | 无 |
| 132 | secrets | VARCHAR(36) | 无 |
| 134 | pipeline_triggers | VARCHAR(64) | 无 |
| 135 | pipeline_environments | VARCHAR(64) | 无 |
| 138 | quality_gates | VARCHAR(100) | 无 |
| 148 | queue_jobs | VARCHAR(64) | 无 |
| 149 | risk_reports | VARCHAR(100) | 无 |
| 149 | digital_twin_snapshots | VARCHAR(100) | 无 |
| 150 | api_contracts (多个表) | VARCHAR(255) | 无 |
| 151 | approval_gates | VARCHAR(255) | 无 |
| 165 | cross_domain_workflows | VARCHAR(255) | 无 |
| 167 | permission_audit_logs | VARCHAR(255) | 无 |
| 180 | lowcode_workflow_definition | VARCHAR(100) | 无 |
| 180 | lowcode_workflow_instance | VARCHAR(100) | 无 |

### 125 号迁移分析

`125_add_tenant_id_to_canary_and_federation.sql` 追加 4 列 VARCHAR(255)：
- canary_traffic_configs.tenant_id
- canary_traffic_history.tenant_id
- federation_executors.tenant_id
- federation_executor_health.tenant_id

这些表在其他迁移中未定义 tenant_id，125 是唯一来源。

### 修复迁移脚本

```sql
-- ============================================================
-- 统一 tenant_id 类型为 UUID（推荐）
-- ============================================================
-- 按风险等级分批执行

-- Phase 1: INTEGER → UUID (影响 8 列，需数据迁移)
-- 注意: INTEGER tenant_id 需要映射到 UUID，需创建映射表或默认 UUID

-- 1. namespace_allocations (060)
ALTER TABLE namespace_allocations ADD COLUMN tenant_id_new UUID;
-- 数据迁移: 如果有现有 INTEGER tenant_id，需要映射
UPDATE namespace_allocations SET tenant_id_new = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NOT NULL;
ALTER TABLE namespace_allocations DROP COLUMN tenant_id;
ALTER TABLE namespace_allocations RENAME COLUMN tenant_id_new TO tenant_id;
ALTER TABLE namespace_allocations ADD CONSTRAINT fk_namespace_allocations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- 2. token_blacklist (072)
ALTER TABLE token_blacklist ADD COLUMN tenant_id_new UUID;
ALTER TABLE token_blacklist DROP COLUMN tenant_id;
ALTER TABLE token_blacklist RENAME COLUMN tenant_id_new TO tenant_id;

-- 3. chatops_messages (073)
ALTER TABLE chatops_messages ADD COLUMN tenant_id_new UUID;
ALTER TABLE chatops_messages DROP COLUMN tenant_id;
ALTER TABLE chatops_messages RENAME COLUMN tenant_id_new TO tenant_id;

-- 4-6. privacy_policies, privacy_consent_records, degradation_audit_logs
-- 同上模式

-- 7-8. llm_traces, llm_metrics
-- 同上模式

-- Phase 2: VARCHAR → UUID (影响 ~30 列)
-- 对每个 VARCHAR tenant_id 列:
-- ALTER TABLE xxx ADD COLUMN tenant_id_new UUID;
-- ALTER TABLE xxx DROP COLUMN tenant_id;
-- ALTER TABLE xxx RENAME COLUMN tenant_id_new TO tenant_id;

-- Phase 3: UUID 但无 FK 的列 (~15 列)
-- ALTER TABLE metrics ADD CONSTRAINT fk_metrics_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
```

---

## P0-4 重复表名合并分析

### 重复表详细对比

| 表名 | 定义位置 | IF NOT EXISTS | 列差异 | 风险等级 |
|------|---------|--------------|--------|---------|
| **project_members** | 003 (8列), 050 (8列) | 是 | 003: `created_at`, role DEFAULT 'developer'<br>050: `joined_at`, role 无默认值 | **中** - 003 先执行则 050 跳过，缺失 `joined_at` 列 |
| **environment_templates** | 025 (11列), 089 (13列) | 是 | 025: 全局模板，无 tenant_id<br>089: 租户隔离，有 tenant_id, template_type, is_default 等 | **高** - 完全不同的语义，025 先执行则 089 全跳过 |
| **iac_plans** | 032 (10列), 044 (13列) | 是 | 032: workspace_id NOT NULL, 有 cost_estimate, ai_review<br>044: workspace_id NULL, 有 name, plan_content, applied 标志 | **高** - 列差异大，032 先执行则 044 全跳过 |
| **performance_baselines** | 099 (15列), 117 (10列) | 是 | 099: 每行一个 metric，有 p50/p95/p99<br>117: JSONB 存储所有 metrics，有 version 字段 | **高** - 完全不同的数据模型 |
| **performance_profiles** | 099 (15列), 117 (11列) | 是 | 099: 性能指标数据（latency, throughput 等）<br>117: 测试配置和结果（config, status, results） | **高** - 完全不同的用途 |
| **twin_snapshots** | 084 (13列), 109 (11列) | 是 | 084: 环境快照（environment, topology）<br>109: 数字孪生快照（twin_id FK, state_hash, snapshot_type） | **高** - 084 先执行则 109 全跳过，109 的 twin_id FK 丢失 |
| **compliance_policies** | 108 (16列), 115 (13列) | 是 | 108: policy_name, framework, rule_expression, version<br>115: name, framework_type, requirements, rules | **高** - 不同框架的数据模型 |
| **compliance_evaluations** | 108 (12列), 115 (12列) | 是 | 108: evaluation_type, compliance_score, result<br>115: total_checks, passed_checks, failed_checks | **高** - 不同评估模型 |
| **audit_findings** | 108 (19列), 115 (15列) | 是 | 108: evaluation_id FK, finding_id, evidence<br>115: execution_id FK, evidence, closed_at | **高** - 不同 FK 引用 |
| **permission_audit_logs** | 050 (11列), 167 (11列) | 是 | 050: UUID 主键，UUID tenant_id/user_id<br>167: BIGSERIAL 主键，VARCHAR(255) tenant_id/user_id | **高** - 完全不同的主键策略和类型 |

### 根因分析

所有重复表名的根本原因：

1. **多团队并行开发**：不同开发者/Agent 在不同时间创建了相同表名的迁移
2. **依赖 `IF NOT EXISTS` 逃避冲突**：后创建的迁移用 `IF NOT EXISTS` 避免执行时报错，但实际上依赖的列和约束也被跳过
3. **设计模式不一致**：早期迁移用 UUID + FK 约束，后期迁移用 VARCHAR + 无 FK
4. **语义漂移**：同一个表名在不同模块中被用于不同目的（如 twin_snapshots 在 084 是环境快照，在 109 是数字孪生快照）

### 影响评估

| 影响类型 | 受影响表数 | 具体影响 |
|---------|-----------|---------|
| **列缺失** | 10 张表 | 后执行的迁移被 IF NOT EXISTS 跳过，导致缺少列 |
| **FK 约束缺失** | 6 张表 | 需要 FK 的表因 IF NOT EXISTS 跳过了 FK 定义 |
| **索引缺失** | 10 张表 | 后执行迁移的索引未被创建 |
| **数据类型冲突** | 4 组 | 同一表名但列类型不同（如 permission_audit_logs 的 id 类型） |
| **语义冲突** | 3 组 | 同一表名但用途完全不同（如 twin_snapshots, performance_profiles） |

### 修复方案

#### 方案 A: 重命名冲突表（推荐）

```sql
-- 对语义完全不同的表，重命名后执行
-- twin_snapshots: 084 保留，109 重命名为 twin_state_snapshots
-- performance_baselines: 099 保留，117 重命名为 perf_baselines_v2
-- performance_profiles: 099 保留，117 重命名为 perf_test_profiles

-- 创建新迁移: 199_rename_duplicate_tables.sql
ALTER TABLE IF EXISTS twin_snapshots RENAME TO twin_environment_snapshots;
-- 然后执行 109 的创建语句（重命名为 twin_snapshots）

-- 对列不同的表，追加缺失列
ALTER TABLE IF EXISTS project_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE IF EXISTS iac_plans ADD COLUMN IF NOT EXISTS name VARCHAR(200);
ALTER TABLE IF EXISTS compliance_policies ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}';
```

#### 方案 B: 合并表结构

```sql
-- 创建统一迁移文件，合并两个定义的所有列
-- 删除两个旧迁移文件中的 CREATE TABLE 语句
-- 在新迁移文件中定义完整结构

-- 示例: merge_environment_templates.sql
CREATE TABLE IF NOT EXISTS environment_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name             VARCHAR(200) NOT NULL,
  description      TEXT,
  template_type    VARCHAR(30) DEFAULT 'standard',
  services         JSONB,
  dependencies     JSONB,
  data_seed_config JSONB,
  network_policies JSONB,
  resource_limits  JSONB,
  resources        JSONB DEFAULT '{}',
  variables        JSONB DEFAULT '{}',
  network_config   JSONB DEFAULT '{}',
  is_default       BOOLEAN DEFAULT false,
  created_by       VARCHAR(100),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
```

---

## 汇总统计表

| 问题类别 | 发现问题数 | P0 级别 | P1 级别 | 需修复 |
|---------|-----------|---------|---------|--------|
| 重复编号迁移冲突 | 15 组 | 1 (178→180) | 3 (049, 061, 176) | 15 组 |
| 外键类型不匹配 | 3 处 | 3 (178 三列) | 1 (137 复合 FK) | 4 处 |
| tenant_id 类型不一致 | 34 列 | 8 (INTEGER) | 26 (VARCHAR) | 34 列 |
| 重复表名定义 | 10 张 | 4 (语义冲突) | 6 (列差异) | 10 张 |
| **合计** | **63** | **16** | **36** | **63** |

## 建议修复优先级

1. **P0 立即修复**: 178 号迁移的 VARCHAR(255) → VARCHAR(100) 类型匹配
2. **P0 立即修复**: 重复表中语义冲突的 4 组（twin_snapshots, performance_baselines, performance_profiles, permission_audit_logs）
3. **P1 短期修复**: INTEGER tenant_id 统一为 UUID（8 列）
4. **P1 短期修复**: VARCHAR tenant_id 统一为 UUID（26 列）
5. **P2 中期修复**: 重复编号迁移文件重命名（确保文件名唯一性）
6. **P2 中期修复**: UUID 但无 FK 的列添加外键约束
