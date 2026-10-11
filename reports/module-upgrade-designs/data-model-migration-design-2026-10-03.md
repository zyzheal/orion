# 数据模型与 Migration 统一设计（AA，2026-10-03）

**范围**：把 8 份模块级升级设计（CMDB / ITSM / Inspection / Automation / BI / Alert / RDM / DevOps）+ 前端发现整合为**单一权威 Migration 号段 + 依赖 DAG + 类型规范 + 回滚策略**
**上游文档**：
- 8 份：`reports/module-upgrade-designs/{cmdb,itsm,inspection,automation,bi,alert,rdm,devops}-upgrade-design-2026-10-03.md`
- 方法级：`reports/expert-reviews/{cmdb-itsm,alert-devops,automation-bi-rdm,inspection}-expert-method-level-2026-10-03.md`
- 前端：`reports/frontend-frontend-method-level-2026-10-03.md`
- 综合：`reports/expert-reviews/cross-review-synthesis-2026-10-03-v5.md`
- **ADR 决策（v5.4 后补）**：`docs/adr/ADR-010~014-*.md`（5 份 ADR 涉及 Migration 700-702 / 730-731 / 736）
**硬约束**：不估算人天/工期；不修改生产代码；只产出 Markdown；Migration 编号与 8 份模块设计保持单一权威口径

> **v5.4 补丁（2026-10-03 后补）**：本 AA 文档 Migration 编号已按 5 份 ADR 决策重排：
> - **700-702**（原方案 CMDB 二阶模型 4 层）→ 改为 **ADR-013 决策的 2 层渐进方案**（700 ci_types / 701 cmdb_cis 加 type_id / 702 数据回填脚本）
> - **730-731**（原方案 BI dashboard_widgets / column_lineage）→ 让位给 **ADR-014 ArtifactBus**（730 pipeline_artifacts / 731 pipeline_runs 加 artifact_count）；BI 表顺延至 732-736
> - **736**（原方案 alert_correlations）→ 让位给 **ADR-010 AlertBreaker**（736 alert_breaker_state）；Alert 5 家族顺延至 737-745
>
> 详见 §2.5 v5.4 补丁章节。

---

## 0. TL;DR

- **Migration 号段分配**：**699-765**（67 号位，含 8 模块 + 4 ALTER）
- **当前基线**：生产最新 Migration 号 `698`（`698_ticket_sla_tracking_target_resolution_units.sql`，**无 `_down` 文件**）
- **总新表数**：约 **58 张新表** + **4 张 ALTER** = 62 项
- **执行顺序**：7 阶段按依赖 DAG（CMDB → ITSM → Inspection → Automation → BI → Alert → RDM → DevOps）
- **回滚策略**：每张表独立 `_down.sql`（数据表默认支持），4 张 ALTER 用 `IF EXISTS` 保护
- **类型规范**：统一 `BIGSERIAL` 主键、`TIMESTAMPTZ` 时间、`JSONB` 半结构化字段、`TEXT` 长文本、`JSONB CHECK (jsonb_typeof = 'array')` 数组
- **多租户约束**：所有新表包含 `tenant_id VARCHAR(64) NOT NULL DEFAULT 'default'` + 复合索引前缀
- **执行前提**：NeatLogic 一手代码扫描结果尚未落地（NL-1~NL-5 仍在运行），本文档基于 Orion 侧方法级真实率设计，NL 结果落地后如需调整表结构再走 patch

---

## 1. 当前状态（代码实证）

### 1.1 Migration 现有分布

| 类型 | 位置 | 数量 | 说明 |
|------|------|------|------|
| 全局 Migration | `orion-platform-svc-go/migrations/` | 903 个 .sql | 主流 |
| 最新连续号 | 同上 | 001-698 | 698 为当前生产号 |
| 例外命名 | `V20260724__graphviz.sql` | 1 | 带版本号前缀（历史遗留） |
| 模块内 Migration | `internal/*/migrations/` | 若干 | 模块自治（ai/alert-adapter/cmdb-collector 等） |
| 子目录 | `migrations/{cmdb-import,dba,file-handler,governance,notification,security,workflow}` | 7 子目录 | 域隔离 |

### 1.2 关键实证

- `ls migrations/699*.sql` → **空**（本轮分配 699 起无冲突）
- `ls migrations/698_ticket_sla_tracking_target_resolution_units_down.sql` → **不存在**（698 无回滚，注释明确说明"只有整段删除是唯一安全反转"）
- 模块内 Migration 命名：`001_xxx.sql` 相对序号（如 `internal/cmdb-collector/migrations/001_create_cmdb_tables.sql`）
- 全局 Migration 命名：`NNN_描述.sql`（3 位数字 + 下划线 + snake_case）
- 命名统一性：全局 vs 模块内两套命名并存，无 001 号冲突（模块内 001 与全局 001 分属不同目录）

### 1.3 8 模块设计与本轮 Migration 号段整合表

| 模块 | 原设计号段 | 本轮统一 | 是否冲突 |
|------|-----------|---------|---------|
| CMDB | 699-704 | **699-704** | 无 |
| ITSM | 706-712 | **705-712** | 补 705 = Ticket workflow 扩展 |
| Inspection | 713-720 | **713-720** | 无 |
| Automation | 721-728 | **721-728** | 无 |
| BI | 729-734 | **729-734** | 无 |
| Alert | 735-744 | **735-744** | 无 |
| RDM | 745-754 | **745-754** | 无 |
| DevOps | 755-765 | **755-765** | 无 |
| **合计** | 8 段 | **699-765** | **67 号位，零冲突** |

---

## 2. Migration 编号分配总表（699-765）

### 2.1 CMDB（699-704）

| 号 | 文件 | 表/操作 | 类型 | 回滚 |
|----|------|--------|------|------|
| 699 | `699_cmdb_ci_types.sql` | `cmdb_ci_types` | 新表 | `_down.sql` |
| 700 | `700_cmdb_ci_type_versions.sql` | `cmdb_ci_type_versions` | 新表 | `_down.sql` |
| 701 | `701_cmdb_ci_attributes.sql` | `cmdb_ci_attributes` | 新表 | `_down.sql` |
| 702 | `702_cmdb_collectors.sql` | `cmdb_collectors` | 新表 | `_down.sql` |
| 703 | `703_cmdb_discovery_rules.sql` | `cmdb_discovery_rules` | 新表 | `_down.sql` |
| 704 | `704_cmdb_ci_attr_values.sql` | `cmdb_ci_attr_values` | 新表 | `_down.sql` |

**表间依赖**：
- `700.ci_type_id → 699.id`
- `701.ci_type_id → 699.id`
- `702.parent_id → 699.id`（可选）
- `703.ci_type_id → 699.id`
- `704.ci_id → (existing cmdb_cis)`, `704.attr_id → 701.id`

### 2.2 ITSM（705-712）

| 号 | 文件 | 表/操作 | 类型 | 回滚 |
|----|------|--------|------|------|
| 705 | `705_ticket_workflow_nodes.sql` | `ticket_workflow_nodes` | 新表 | `_down.sql` |
| 706 | `706_itsm_sla_policies.sql` | `itsm_sla_policies` | 新表 | `_down.sql` |
| 707 | `707_itsm_sla_breaks.sql` | `itsm_sla_breaks` | 新表 | `_down.sql` |
| 708 | `708_itsm_sla_exceptions.sql` | `itsm_sla_exceptions` | 新表 | `_down.sql` |
| 709 | `709_itsm_escalation_matrix.sql` | `itsm_escalation_matrix` | 新表 | `_down.sql` |
| 710 | `710_itsm_workcenter_tables.sql` | `workcenter_workitems/queues/assignments/assignment_history` | 4 新表 | `_down.sql`（4 段） |
| 711 | `711_itsm_channel_types.sql` | `channel_types` | 新表 | `_down.sql` |
| 712 | `712_itsm_service_catalog_ext.sql` | ALTER `service_catalog_services` | 加 4 字段 | `_down.sql`（IF EXISTS） |

**表间依赖**：
- `707.sla_policy_id → 706.id`
- `708.sla_policy_id → 706.id`, `708.ticket_id → (existing tickets)`
- `709.sla_policy_id → 706.id`
- `710.*.queue_id → 710.workcenter_queues.id`
- `712` ALTER 依赖现有 `service_catalog_services`

### 2.3 Inspection（713-720）

| 号 | 文件 | 表/操作 | 类型 | 回滚 |
|----|------|--------|------|------|
| 713 | `713_inspection_thresholds.sql` | `inspection_thresholds` | 新表 | `_down.sql` |
| 714 | `714_inspection_results.sql` | `inspection_results` | 新表 | `_down.sql` |
| 715 | `715_inspection_config_file_versions.sql` | `inspection_config_file_versions` | 新表 | `_down.sql` |
| 716 | `716_inspection_config_file_audits.sql` | `inspection_config_file_audits` | 新表 | `_down.sql` |
| 717 | `717_inspection_reports.sql` | `inspection_reports` | 新表 | `_down.sql` |
| 718 | `718_inspection_problem_views.sql` | `inspection_problem_views` | 新表 | `_down.sql` |
| 719 | `719_inspection_schedules.sql` | `inspection_schedules` | 新表 | `_down.sql` |
| 720 | `720_inspection_jobs.sql` | `inspection_jobs` | 新表 | `_down.sql` |

**表间依赖**：
- `714.threshold_id → 713.id`
- `716.file_version_id → 715.id`
- `717.job_id → 720.id`
- `720.schedule_id → 719.id`

### 2.4 Automation（721-728）

| 号 | 文件 | 表/操作 | 类型 | 回滚 |
|----|------|--------|------|------|
| 721 | `721_automation_task_results.sql` | `pipeline_task_results` | 新表 | `_down.sql` |
| 722 | `722_automation_catalog.sql` | `automation_catalog_items/categories` | 2 新表 | `_down.sql` |
| 723 | `723_automation_scenarios.sql` | `automation_scenarios` | 新表 | `_down.sql` |
| 724 | `724_automation_profiles.sql` | `automation_profiles` | 新表 | `_down.sql` |
| 725 | `725_automation_combops.sql` | `automation_combops` | 新表 | `_down.sql` |
| 726 | `726_automation_custom_templates.sql` | `automation_custom_templates` | 新表 | `_down.sql` |
| 727 | `727_automation_runner_types.sql` | `automation_runner_types` | 新表 | `_down.sql` |
| 728 | `728_automation_artifact_bus.sql` | `automation_artifact_bus` | 新表 | `_down.sql` |

**表间依赖**：
- `723.pipeline_refs → pipeline_id (existing)`
- `723.profile_id → 724.id`
- `725.scenario_id → 723.id`

### 2.5 BI（729-734）

| 号 | 文件 | 表/操作 | 类型 | 回滚 |
|----|------|--------|------|------|
| 729 | `729_bi_report_executions_ext.sql` | ALTER `report_executions` | 加 3 字段 | `_down.sql`（IF EXISTS） |
| 730 | `730_bi_report_dashboard_widgets.sql` | `bi_dashboard_widgets` | 新表 | `_down.sql` |
| 731 | `731_bi_column_lineage.sql` | `bi_column_lineage` | 新表 | `_down.sql` |
| 732 | `732_bi_masking_consumption.sql` | `bi_masking_consumption` | 新表 | `_down.sql` |
| 733 | `733_bi_quality_scans.sql` | `bi_quality_scans` | 新表 | `_down.sql` |
| 734 | `734_bi_metadata_collections.sql` | `bi_metadata_collections` | 新表 | `_down.sql` |

### 2.6 Alert（735-744）

| 号 | 文件 | 表/操作 | 类型 | 回滚 |
|----|------|--------|------|------|
| 735 | `735_alerts_persistent.sql` | `alerts`（迁离 memory） | 新表 | `_down.sql` |
| 736 | `736_alert_correlations.sql` | `alert_correlations` | 新表 | `_down.sql` |
| 737 | `737_alert_deduplication.sql` | `alert_dedup_fingerprints` | 新表 | `_down.sql` |
| 738 | `738_alert_silences.sql` | `alert_silences` | 新表 | `_down.sql` |
| 739 | `739_alert_rules.sql` | `alert_rules` | 新表 | `_down.sql` |
| 740 | `740_alert_oncall.sql` | `alert_oncall_schedules/members/rotations` | 3 新表 | `_down.sql` |
| 741 | `741_alert_shift.sql` | `alert_shift_rules/assignments` | 2 新表 | `_down.sql` |
| 742 | `742_alert_sla.sql` | `alert_slas/violations` | 2 新表 | `_down.sql` |
| 743 | `743_alert_dashboard_stats.sql` | `alert_dashboard_stats` | 新表 | `_down.sql` |
| 744 | `744_alert_channel_templates_tenant.sql` | ALTER `alert_channel_templates` | 加 `tenant_id` | `_down.sql`（IF EXISTS） |

### 2.7 RDM（745-754）

| 号 | 文件 | 表/操作 | 类型 | 回滚 |
|----|------|--------|------|------|
| 745 | `745_rdm_requirements.sql` | `rdm_requirements` | 新表 | `_down.sql` |
| 746 | `746_rdm_requirement_children.sql` | `rdm_requirement_children` | 新表 | `_down.sql` |
| 747 | `747_rdm_tasks.sql` | `rdm_tasks`（或 ALTER `tickets`） | 新表 | `_down.sql` |
| 748 | `748_rdm_specs.sql` | `rdm_specs` | 新表 | `_down.sql` |
| 749 | `749_rdm_releases.sql` | `rdm_releases` | 新表 | `_down.sql` |
| 750 | `750_rdm_sprint_review.sql` | `rdm_sprint_reviews` | 新表 | `_down.sql` |
| 751 | `751_rdm_sprint_gantt.sql` | `rdm_sprint_gantt` | 新表 | `_down.sql` |
| 752 | `752_rdm_velocity.sql` | `rdm_velocity` | 新表 | `_down.sql` |
| 753 | `753_rdm_matrix.sql` | `rdm_matrix` | 新表 | `_down.sql` |
| 754 | `754_rdm_ticket_ext.sql` | ALTER `tickets`（6 字段） | ALTER | `_down.sql`（IF EXISTS） |

### 2.8 DevOps（755-765）

| 号 | 文件 | 表/操作 | 类型 | 回滚 |
|----|------|--------|------|------|
| 755 | `755_devops_runner_types.sql` | `runner_types` | 新表 | `_down.sql` |
| 756 | `756_devops_runner_credentials.sql` | `runner_credentials` | 新表 | `_down.sql` |
| 757 | `757_devops_appconfig.sql` | `appconfig` | 新表 | `_down.sql` |
| 758 | `758_devops_appconfig_env.sql` | `appconfig_envs` | 新表 | `_down.sql` |
| 759 | `759_devops_appconfig_module.sql` | `appconfig_modules` | 新表 | `_down.sql` |
| 760 | `760_devops_appconfig_system.sql` | `appconfig_systems` | 新表 | `_down.sql` |
| 761 | `761_devops_apppipeline.sql` | `apppipeline_bindings` | 新表 | `_down.sql` |
| 762 | `762_devops_pipeline_applications.sql` | `pipeline_applications` | 新表 | `_down.sql` |
| 763 | `763_devops_artifact_sbom.sql` | `artifact_sboms` | 新表 | `_down.sql` |
| 764 | `764_devops_artifact_signatures.sql` | `artifact_signatures` | 新表 | `_down.sql` |
| 765 | `765_devops_git_providers.sql` | ALTER `git_providers` | 加 3 字段 | `_down.sql`（IF EXISTS） |

### 2.9 v5.4 补丁：ADR 决策驱动的 Migration 编号重排（2026-10-03）

> **触发**：ADR-010/011/012/013/014 决策完成后，Migration 700-702 / 730-731 / 736 号位需重排。
> **权威依据**：ADR 决策优先于 AA 初版设计（ADR 有更深的一手证据 + 风险评级）。
> **兼容策略**：原方案保留编号空间，但**用途重排**；BI/Alert 后续表顺延。

#### 2.9.1 CMDB（699-704 → 699-702 精简，ADR-013 决策）

| 号 | 原用途 | **v5.4 新用途** | ADR |
|----|--------|-----------------|-----|
| 699 | `cmdb_ci_types` 新表 | **保留**：`cmdb_ci_types` 新表（类型定义）| ADR-013 |
| 700 | `cmdb_ci_type_versions` 新表 | **改为**：`cmdb_cis` ALTER 加 `type_id` 外键 | ADR-013 |
| 701 | `cmdb_ci_attributes` 新表 | **改为**：数据回填脚本（ci_type → type_id）| ADR-013 |
| 702 | `cmdb_collectors` 新表 | **预留**（阶段 2 模板层）| ADR-013 |
| 703-704 | `cmdb_discovery_rules` / `cmdb_ci_attr_values` | **预留**（阶段 3 事务层）| ADR-013 |

**变化**：ADR-013 决策采用**2 层渐进**（Type + Instance），不需要原方案的 6 张表；只需用 3 号位（699-701），702-704 保留给未来阶段 2/3。

#### 2.9.2 BI（729-734 → 732-737 顺延，ADR-014 让位）

| 号 | 原用途 | **v5.4 新用途** | ADR |
|----|--------|-----------------|-----|
| 729 | `bi_report_executions_ext` ALTER | 保留 | — |
| 730 | `bi_dashboard_widgets` 新表 | **让位给 ADR-014**：`pipeline_artifacts` 新表 | ADR-014 |
| 731 | `bi_column_lineage` 新表 | **让位给 ADR-014**：`pipeline_runs` ALTER 加 `artifact_count` | ADR-014 |
| **732** | — | **新增**：`bi_dashboard_widgets`（原 730 顺延）| — |
| **733** | — | **新增**：`bi_column_lineage`（原 731 顺延）| — |
| 734 | `bi_masking_consumption` 新表 | 保留 | — |
| 735 | — | 原 733 quality_scans（顺延）| — |
| 736 | — | 原 734 metadata_collections（顺延）| — |

**变化**：ADR-014 占用 730-731，BI 6 张表从 729-734 顺延至 729+732-737（保留 729，其余顺延）。

#### 2.9.3 Alert（735-744 → 737-746 顺延，ADR-010 让位）

| 号 | 原用途 | **v5.4 新用途** | ADR |
|----|--------|-----------------|-----|
| 735 | `alerts` 主表（迁离 memory）| 保留 | — |
| 736 | `alert_correlations` 新表 | **让位给 ADR-010**：`alert_breaker_state` 新表 | ADR-010 |
| 737 | `alert_dedup_fingerprints` 新表 | **新增**：`alert_correlations`（原 736 顺延）| — |
| 738 | `alert_silences` 新表 | 保留（原用途）| — |
| 739 | `alert_rules` 新表 | 保留（原用途）| — |
| 740-746 | oncall/shift/sla/dashboard/channel_templates | 顺延 1 号位 | — |

**变化**：ADR-010 占用 736（AlertBreaker State 是 Alert 5 家族之前的关键组件），Alert 5 家族从 735-744 顺延至 735+737-745。

#### 2.9.4 号段汇总（v5.4 后）

| 号段 | v5.3 用途 | **v5.4 用途** |
|------|-----------|-------------|
| 699-702 | CMDB 6 表 | CMDB 3 表（含 ALTER）|
| 703-704 | CMDB 补充 | 预留（阶段 2/3）|
| 705-729 | ITSM/Inspection/Automation | 不变 |
| **730-731** | BI dashboard_widgets / column_lineage | **Pipeline ArtifactBus**（ADR-014）|
| **732-737** | BI 6 张（部分） | **BI 6 张（顺延）** |
| **735** | Alert 主表 | 保留 |
| **736** | Alert correlations | **AlertBreaker State**（ADR-010）|
| **737-746** | Alert 补充 | Alert 顺延 |
| 745-765 | RDM/DevOps | 部分顺延 |

**总号位**：仍是 699-765（67 号位），但**内部分配已按 ADR 决策重排**。

#### 2.9.5 ADR 决策的 Migration 优先级

**执行顺序（依 ADR 依赖）**：

```
S0 基础设施：
    699 cmdb_ci_types（ADR-013）
    700 cmdb_cis ALTER type_id（ADR-013）
    701 cmdb_cis 数据回填（ADR-013）

S4 Automation：
    730 pipeline_artifacts（ADR-014）
    731 pipeline_runs ALTER artifact_count（ADR-014）

S6 Alert：
    735 alerts（迁离 memory）
    736 alert_breaker_state（ADR-010）
    737 alert_correlations
    738-745 alert 5 家族（顺延）
```

**Migration 依赖图**：

```
699 cmdb_ci_types
    ↓ (700 引用 type_id)
700 cmdb_cis ALTER
    ↓ (701 回填)
701 cmdb_cis 数据回填

730 pipeline_artifacts（独立）
731 pipeline_runs ALTER（依赖 730）

735 alerts（独立）
    ↓ (736 与 alerts 同事务边界)
736 alert_breaker_state（ADR-010 Serializable 事务）
    ↓
737-745 alert 5 家族
```

### 2.10 号段使用汇总

| 号段 | 模块 | 新表数 | ALTER | 合计 |
|------|------|-------|-------|------|
| 699-704 | CMDB | 6 | 0 | 6 |
| 705-712 | ITSM | 6 | 1 | 7 |
| 713-720 | Inspection | 8 | 0 | 8 |
| 721-728 | Automation | 9 | 0 | 9 |
| 729-734 | BI | 5 | 1 | 6 |
| 735-744 | Alert | 12 | 1 | 13 |
| 745-754 | RDM | 9 | 1 | 10 |
| 755-765 | DevOps | 10 | 1 | 11 |
| **合计** | **8 模块** | **65** | **5** | **70 号位**（含子表编号合并） |

**说明**：710（workcenter 4 表）、722（catalog 2 表）、740（oncall 3 表）、741（shift 2 表）、742（sla 2 表）、743-744 等合并到单号是刻意设计——同一模块的原子表组用一个号统一 up/down，避免碎片化。

---

## 3. Migration 依赖 DAG

### 3.1 全局执行顺序

```
        ┌─────────────────────────────────────────────────────────────┐
        │                                                             │
        │  [699-704]  CMDB ── CIType/Attribute 底座（G0 核心）      │
        │        │  依赖：无                                          │
        │        │  为以下所有模块提供 CI 引用外键                     │
        │        ↓                                                    │
        │  [705-712]  ITSM ── Workflow+SLA+Workcenter                 │
        │        │  依赖：CMDB（工单关联 CI）                          │
        │        ↓                                                    │
        │  [713-720]  Inspection ── Threshold/ConfigFile/Report       │
        │        │  依赖：CMDB（巡检对象）+ Alert（问题视图告警）     │
        │        ↓                                                    │
        │  [721-728]  Automation ── TaskRunner+Catalog+Scenario       │
        │        │  依赖：CMDB（Runner 目标机器）+ ITSM（触发的 CR）  │
        │        ↓                                                    │
        │  [729-734]  BI ── Report Dashboard+Lineage+Quality          │
        │        │  依赖：CMDB（血缘起点）+ Automation（数据源）      │
        │        ↓                                                    │
        │  [735-744]  Alert ── Persistent+Oncall+Shift+SLA+Dashboard  │
        │        │  依赖：CMDB（告警资源）+ ITSM（升级→Incident）     │
        │        ↓                                                    │
        │  [745-754]  RDM ── Requirement+Task+Sprint+Matrix           │
        │        │  依赖：ITSM（Ticket 扩展）+ BI（数据聚合）         │
        │        ↓                                                    │
        │  [755-765]  DevOps ── Runner+AppConfig+AppPipeline+SBOM    │
        │             依赖：CMDB（Runner 目标）+ Automation（TaskRunner 复用）│
        │                                                             │
        └─────────────────────────────────────────────────────────────┘
```

### 3.2 关键跨模块外键

| 子表 | 外键 | 目标表 | Migration 号 |
|------|------|--------|-------------|
| `cmdb_ci_attr_values.ci_id` | existing `cmdb_cis.id` | existing | - |
| `itsm_sla_breaks.sla_policy_id` | `itsm_sla_policies.id` | 706 |
| `itsm_sla_exceptions.ticket_id` | existing `tickets.id` | existing |
| `inspection_results.threshold_id` | `inspection_thresholds.id` | 713 |
| `inspection_reports.job_id` | `inspection_jobs.id` | 720 |
| `automation_scenarios.profile_id` | `automation_profiles.id` | 724 |
| `automation_combops.scenario_id` | `automation_scenarios.id` | 723 |
| `bi_column_lineage.column_id` | existing | existing |
| `alert_correlations.alert_id` | `alerts.id` | 735 |
| `alert_silences.alert_id` | `alerts.id` | 735 |
| `alert_sla_violations.ticket_id` | existing `tickets.id` | existing |
| `rdm_tasks.ticket_id` | existing `tickets.id` | existing |
| `rdm_requirements.parent_id` | `rdm_requirements.id` | 745（自引用） |
| `rdm_matrix.requirement_id` | `rdm_requirements.id` | 745 |
| `apppipeline_bindings.pipeline_id` | existing `pipelines.id` | existing |
| `apppipeline_bindings.app_id` | existing `applications.id` | existing |

### 3.3 阶段启动前置

| 阶段 | 模块 | 前置号段 | 前置条件（代码侧） |
|------|------|---------|------------------|
| S0 | CMDB | 无 | `go build ./...` + 698 已应用 |
| S1 | ITSM | 699-704 | CMDB CI 类型服务上线 |
| S2 | Inspection | 705-712 | ITSM Workflow 引擎消费 Nodes/Edges |
| S3 | Automation | 713-720 | Runner 类型注册接口存在 |
| S4 | BI | 721-728 | StageExecutor artifact 传播已实现 |
| S5 | Alert | 729-734 | ReportDesigner Execute 真实化 |
| S6 | RDM | 735-744 | Oncall/Shift 通知渠道就绪 |
| S7 | DevOps | 745-754 | TaskRunner SSH/K8s-Exec 已扩展 |

---

## 4. 类型规范（Unified Data Model Standard）

### 4.1 通用字段

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `BIGSERIAL PRIMARY KEY` | NOT NULL | 主键，64-bit |
| `tenant_id` | `VARCHAR(64)` | NOT NULL DEFAULT `'default'` | 多租户，全表 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` | 更新时间 |
| `created_by` | `VARCHAR(128)` | NULL | 创建人 |
| `updated_by` | `VARCHAR(128)` | NULL | 修改人 |
| `is_deleted` | `BOOLEAN` | NOT NULL DEFAULT `false` | 软删除 |
| `version` | `INTEGER` | NOT NULL DEFAULT `1` | 乐观锁（可选） |
| `metadata` | `JSONB` | NOT NULL DEFAULT `'{}'::jsonb` | 扩展元数据 |

### 4.2 数据字段类型映射

| 语义 | PG 类型 | 使用场景 |
|------|---------|---------|
| 短代码/枚举 | `VARCHAR(32)` | status, level, priority |
| 名称/标题 | `VARCHAR(256)` | name, title |
| 描述/长文本 | `TEXT` | description, content |
| JSON 结构 | `JSONB` | config, params, result, payload |
| 数组 | `JSONB CHECK (jsonb_typeof = 'array')` | tags, labels |
| 金额 | `NUMERIC(18,2)` | cost, price |
| 时间戳 | `TIMESTAMPTZ` | 所有时间字段 |
| 时间区间 | `tsrange` | SLA window, maintenance |
| 二进制 | `BYTEA` | 附件（可选，一般用 URL） |
| 加密字段 | `BYTEA` + `BYTEA`（key） | credentials, secrets |

### 4.3 JSONB 使用规范

**推荐使用场景**：
- 半结构化配置：`config JSONB`
- 结果 payload：`result JSONB`
- 扩展字段：`metadata JSONB`

**避免使用场景**：
- 频繁查询的字段（需索引）
- 需要 JOIN 的关系字段
- 大量数据（>1MB）

**JSONB 索引策略**：
```sql
-- GIN 索引：JSON 内部查询
CREATE INDEX idx_xxx_config_gin ON xxx USING GIN (config);

-- btree 索引：JSON 特定键（更快）
CREATE INDEX idx_xxx_config_status ON xxx ((config->>'status'));
```

### 4.4 多租户索引策略

**强制规范**：所有查询都带 `WHERE tenant_id = ?`，因此所有表的索引都必须以 `tenant_id` 为前缀。

```sql
-- ✅ 正确
CREATE INDEX idx_xxx ON xxx(tenant_id, name);
CREATE UNIQUE INDEX idx_xxx_name ON xxx(tenant_id, name);

-- ❌ 错误（无 tenant_id 前缀）
CREATE INDEX idx_xxx ON xxx(name);
```

### 4.5 命名规范

| 对象 | 规范 | 示例 |
|------|------|------|
| 表名 | `snake_case` + 域前缀 | `cmdb_ci_types`, `itsm_sla_policies` |
| 列名 | `snake_case` | `created_at`, `tenant_id` |
| 索引 | `idx_<table>_<cols>` | `idx_cmdb_ci_types_name` |
| 唯一索引 | `uq_<table>_<cols>` | `uq_cmdb_ci_types_key` |
| 外键约束 | `fk_<table>_<col>` | `fk_alerts_tenant_id` |
| Migration 文件 | `NNN_<module>_<action>[_ext]_down.sql` | `704_cmdb_ci_attr_values.sql` |

### 4.6 迁移模板

**新建表模板**：
```sql
-- {NNN}_{module}_{table}.sql
--
-- 说明：本 migration 创建 {module} 域的 {table} 表，用于 {业务场景}
-- 依赖：{前置 migration 号 / 无}
-- 相关设计：reports/module-upgrade-designs/{module}-upgrade-design-2026-10-03.md
-- 回滚：{NNN}_{module}_{table}_down.sql

CREATE TABLE IF NOT EXISTS {table_name} (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    -- 业务字段...
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_{table}_tenant ON {table_name}(tenant_id);
-- 其他业务索引...

COMMENT ON TABLE {table_name} IS '{一句话说明}';
COMMENT ON COLUMN {table_name}.{关键列} IS '{业务含义}';
```

**ALTER 模板**：
```sql
-- {NNN}_{module}_xxx_ext.sql
ALTER TABLE {existing_table}
    ADD COLUMN IF NOT EXISTS {new_col} {TYPE} NOT NULL DEFAULT {DEFAULT_VALUE};

CREATE INDEX IF NOT EXISTS idx_{table}_{new_col} ON {table_name}(tenant_id, {new_col});

COMMENT ON COLUMN {table_name}.{new_col} IS '{业务含义}';
```

**Down 模板**：
```sql
-- {NNN}_{module}_{table}_down.sql
DROP TABLE IF EXISTS {table_name} CASCADE;
```

**ALTER Down 模板**：
```sql
-- {NNN}_{module}_xxx_ext_down.sql
ALTER TABLE {existing_table} DROP COLUMN IF EXISTS {new_col};
DROP INDEX IF EXISTS idx_{table}_{new_col};
```

---

## 5. 数据模型 ERD（关键跨模块关系）

```
┌─────────────────────────────────────────────────────────────────┐
│                          CMDB (699-704)                         │
│  cmdb_ci_types ──1:N── cmdb_ci_type_versions                    │
│      │                                                           │
│      ├──1:N── cmdb_ci_attributes ──1:N── cmdb_ci_attr_values   │
│      │                        (关联 existing cmdb_cis)          │
│      ├──1:N── cmdb_collectors                                    │
│      └──1:N── cmdb_discovery_rules                               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ├── 供 ITSM/RDM/Ticket 关联 CI
                        ├── 供 Inspection 巡检对象
                        ├── 供 Alert 关联告警资源
                        └── 供 Automation Runner 目标
                        │
┌─────────────────────────────────────────────────────────────────┐
│                        ITSM (705-712)                            │
│  itsm_sla_policies ──1:N── itsm_sla_breaks                        │
│      │                                                           │
│      ├──1:N── itsm_sla_exceptions ──N:1── tickets (existing)    │
│      └──1:N── itsm_escalation_matrix                             │
│                                                                  │
│  workcenter_workitems ←→ workcenter_queues                       │
│      └── workcenter_assignments ──1:N── assignment_history      │
│                                                                  │
│  channel_types ──1:N── channels (existing)                       │
│                                                                  │
│  ALTER service_catalog_services + sla_id/owner_id/...           │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ├── ITSM 工单 ↔ Automation 触发自愈
                        └── ITSM Incident ← Alert 升级
                        │
┌─────────────────────────────────────────────────────────────────┐
│                   Automation (721-728)                           │
│  pipeline_task_results (721)                                     │
│      └── 跨 stage artifact 传播（G0-1 修复）                     │
│                                                                  │
│  automation_catalog ── N:M ─ automation_scenarios                │
│      ├── automation_profiles ── 参数模板                         │
│      ├── automation_combops ── 组合操作                          │
│      ├── automation_custom_templates                             │
│      ├── automation_runner_types                                  │
│      └── automation_artifact_bus                                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        └── 供 DevOps Runner 复用（SSH/K8s-Exec）
                        │
┌─────────────────────────────────────────────────────────────────┐
│                     Alert (735-744)                              │
│  alerts (735) ── 主表持久化（迁离 memory）                       │
│      ├── alert_correlations (736)                                │
│      ├── alert_dedup_fingerprints (737)                          │
│      ├── alert_silences (738)                                    │
│      ├── alert_rules (739)                                       │
│      ├── alert_oncall_schedules/members/rotations (740)          │
│      ├── alert_shift_rules/assignments (741)                     │
│      ├── alert_slas/violations (742)                             │
│      └── alert_dashboard_stats (743)                             │
│                                                                  │
│  ALTER alert_channel_templates + tenant_id (744)                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        └── Alert → ITSM Incident 转换
                        │
┌─────────────────────────────────────────────────────────────────┐
│                       RDM (745-754)                              │
│  rdm_requirements ──1:N── rdm_requirement_children (self-ref)   │
│      ├── rdm_tasks (关联 tickets)                                │
│      ├── rdm_specs                                                │
│      ├── rdm_releases                                             │
│      ├── rdm_sprint_reviews                                       │
│      ├── rdm_sprint_gantt                                         │
│      ├── rdm_velocity                                             │
│      └── rdm_matrix (requirement→task→test→release)             │
│                                                                  │
│  ALTER tickets + 6 字段 (754)                                    │
└─────────────────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────────────────┐
│                      BI (729-734)                                │
│  ALTER report_executions + input_sql/row_count/exec_duration_ms │
│      ├── bi_dashboard_widgets                                     │
│      ├── bi_column_lineage                                        │
│      ├── bi_masking_consumption                                   │
│      ├── bi_quality_scans                                         │
│      └── bi_metadata_collections                                  │
└─────────────────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────────────────┐
│                     DevOps (755-765)                             │
│  runner_types ──1:N── runner_credentials                         │
│                                                                  │
│  appconfig (757) ──1:N── envs/modules/systems (758-760)         │
│                                                                  │
│  apppipeline_bindings ── pipeline_applications                    │
│      └── 双向外键：pipeline_id ↔ app_id (existing)              │
│                                                                  │
│  artifact_sboms ── artifact_signatures                           │
│      └── 关联 existing artifacts                                  │
│                                                                  │
│  ALTER git_providers + webhook_secret/endpoint (765)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Migration 编排工具链

### 6.1 执行命令

```bash
# 单个模块执行（按号段）
cd orion-platform-svc-go
go run ./cmd/migrate up 699  # 执行 CMDB 全部
go run ./cmd/migrate up 705  # 执行 ITSM 全部
go run ./cmd/migrate up 765  # 全量执行到 765

# 单个 migration
go run ./cmd/migrate up 699_cmdb_ci_types.sql

# 单个 down（回滚）
go run ./cmd/migrate down 699_cmdb_ci_types_down.sql

# 检查当前状态
go run ./cmd/migrate status

# 批量检查
for f in migrations/699* migrations/705* migrations/713*; do
    echo "=== $f ==="
    go run ./cmd/migrate validate "$f"
done
```

### 6.2 前置验证

**每个 migration 落地前必须**：

1. **语法检查**：
   ```bash
   psql -f migrations/NNN_xxx.sql --set ON_ERROR_STOP=1
   ```
2. **回滚验证**：
   ```bash
   psql -f migrations/NNN_xxx.sql && psql -f migrations/NNN_xxx_down.sql
   ```
3. **表结构快照**：
   ```bash
   \d {table_name} > docs/migrations/NNN_snapshot.md
   ```
4. **单库跑通后**：
   ```bash
   go run ./cmd/migrate up NNN
   go test ./internal/{module}/... -run Migration
   ```

### 6.3 灰度策略

| 阶段 | 环境 | 执行方式 | 验证 |
|------|------|---------|------|
| Dev | 本地 PG | `migrate up NNN` | 语法 + 结构 |
| Staging | 单实例 | `migrate up NNN-段` | 单测 + e2e |
| Prod-Canary | 1 实例 | `migrate up NNN` 单号 | 观察 24h |
| Prod-Full | 全实例 | `migrate up NNN-段` | 观察 72h |

### 6.4 版本锁定

- **PG 版本要求**：PostgreSQL 14+（JSONB / tsrange 依赖）
- **执行顺序保证**：Migration runner 按 NNN 数字序执行，不允许跳号
- **回滚限制**：ALTER 类 migration 回滚需确认数据未依赖新字段（`SELECT COUNT(*) WHERE new_col IS NOT NULL`）

---

## 7. 回滚策略

### 7.1 通用回滚模式

**新建表 → 直接 DROP**：
```sql
-- NNN_module_table_down.sql
DROP TABLE IF EXISTS {table_name} CASCADE;
-- CASCADE 处理依赖的外键
```

**ALTER 表 → 分场景**：
```sql
-- NNN_xxx_ext_down.sql

-- 场景 A：新字段全部为 NULL（写入者未启用）
ALTER TABLE {table} DROP COLUMN IF EXISTS {new_col};

-- 场景 B：新字段有部分数据（需先清理）
DELETE FROM {table} WHERE {new_col} IS NOT NULL;
ALTER TABLE {table} DROP COLUMN IF EXISTS {new_col};

-- 场景 C：新字段有 NOT NULL DEFAULT（数据已填）
-- 无法安全回滚，只能整段删除（同 698）
```

### 7.2 不可逆 Migration（标记 & 处理）

**标记规则**：Migration 注释首行明确写 `-- IRREVERSIBLE: {原因}`

**当前识别为不可逆的**：
- `698_ticket_sla_tracking_target_resolution_units.sql`（已存在，`target_ms * 1000` 无法回滚）
- 所有含 `ALTER COLUMN TYPE` 强制类型转换的
- 所有含 `NOT NULL` 且填充实际数据的

**处理原则**：
- 不禁止不可逆 migration，但必须：
  1. 有清晰的注释说明为什么不可逆
  2. 提供数据快照导出脚本（`SELECT * INTO table_bak_NNN`）
  3. 提供数据修复脚本（作为兜底）

### 7.3 数据迁移场景（memory → PG）

Alert 5 家族（735-739）需要把 memory 数据迁到 PG：

```sql
-- 迁移脚本（在应用启动时运行）
INSERT INTO alert_correlations (tenant_id, alert_id, group_key, created_at, ...)
SELECT tenant_id, id, group_key, created_at, ...
FROM alert_correlations_memory_export  -- 一次性导出视图
ON CONFLICT DO NOTHING;
```

**回滚策略**：memory 数据保留在代码内存直到完全验证（双写期 2 周）

### 7.4 模块整体回滚

**单模块回滚**（按模块号段批量）：
```bash
# CMDB 全量回滚
for n in 704 703 702 701 700 699; do
    go run ./cmd/migrate down ${n}_cmdb_*_down.sql
done

# ITSM 全量回滚
for n in 712 711 710 709 708 707 706 705; do
    go run ./cmd/migrate down ${n}_itsm_*_down.sql
done
```

**回滚顺序规则**：**逆序**（后建的先删），避免外键依赖错误。

---

## 8. 风险与门控

### 8.1 Migration 冲突风险

| 风险 | 概率 | 缓解 |
|------|------|------|
| 号段冲突（699-765 已被占用） | 低 | 已验证 `ls migrations/699*.sql` 空 |
| 模块内 Migration 与全局冲突 | 中 | 模块内 001_NNN 相对序号，不与全局 NNN_ 混淆 |
| ALTER 与已有字段冲突 | 中 | 使用 `IF NOT EXISTS` |
| 外键依赖未建的表 | 高 | 严格按 DAG 顺序执行 |
| 不可逆 migration 累积 | 高 | 强制注释标记 + 快照导出 |

### 8.2 Migration 执行门控

**每个号段落地前**：

1. **代码编译**：`go build ./...` 0 错误
2. **单表测试**：`go test ./internal/{module}/... -run TestMigration`
3. **单库全流程**：本地 PG 从 001 到 NNN 全量跑通
4. **结构快照对比**：`pg_dump --schema-only > after_NNN.sql` diff 前一次
5. **性能回归**：关键查询计划对比（`EXPLAIN ANALYZE`）
6. **回滚验证**：至少 3 号位逆序 down 后 up 验证幂等

### 8.3 生产发布前置

**每次 Prod 变更前**：

1. **数据快照**：`pg_dump --data-only --inserts > snapshot_${date}.sql`
2. **执行计划检查**：所有涉及表的关键查询 `EXPLAIN (ANALYZE, BUFFERS)`
3. **灰度验证**：单实例执行 + 观察 24h
4. **回滚预案**：预先写好完整回滚脚本 + 命令清单

### 8.4 认知边界

- 未验证 PG 14+ 与 Orion 现有部署版本的兼容性（需 DevOps 确认）
- 未量化 5 家族 Alert memory → PG 迁移时的双写期数据一致性
- 未评估 70 号位 Migration 一次性执行对生产数据库的锁时间
- 未评估 JSONB 在大量数据（>100 万行）时的 GIN 索引内存占用
- 未评估跨模块外键（如 `rdm_tasks.ticket_id → tickets.id`）在 tickets 表被清理时的行为

---

## 9. 落地清单（可直接执行）

### 9.1 阶段 0（前置）

- [ ] 确认 PG 版本 >= 14
- [ ] `ls migrations/699*.sql` 仍为空
- [ ] `go build ./...` 0 错误基线
- [ ] 创建 `docs/migrations/` 目录存放快照
- [ ] 编写 `migrations/698_ticket_sla_tracking_target_resolution_units_down.sql`（虽然 698 标为不可逆，但为一致性补齐）

### 9.2 阶段 1（CMDB 699-704）

- [ ] 编写 `699_cmdb_ci_types.sql` + `_down.sql`
- [ ] 编写 `700_cmdb_ci_type_versions.sql` + `_down.sql`
- [ ] 编写 `701_cmdb_ci_attributes.sql` + `_down.sql`
- [ ] 编写 `702_cmdb_collectors.sql` + `_down.sql`
- [ ] 编写 `703_cmdb_discovery_rules.sql` + `_down.sql`
- [ ] 编写 `704_cmdb_ci_attr_values.sql` + `_down.sql`
- [ ] 单库跑通 699 → 704
- [ ] 结构快照 `pg_dump --schema-only`
- [ ] 单测：6 张表 CRUD

### 9.3 阶段 2-7（ITSM / Inspection / Automation / BI / Alert / RDM / DevOps）

按 2.1-2.8 表格顺序，每段完成后：
- [ ] 单库跑通
- [ ] 结构快照
- [ ] 单测覆盖
- [ ] 与前一阶段外键连通性验证

### 9.4 阶段 8（全量验证）

- [ ] 从 699 到 765 全量跑通（67 号位）
- [ ] 全量逆序回滚验证
- [ ] 生产 Canaries 1 实例执行
- [ ] 观察 24h 无异常
- [ ] 全量生产发布

---

## 10. 与 8 份模块设计的对齐

| 模块设计文档 | Migration 号段 | 本设计对应 | 差异说明 |
|-------------|---------------|-----------|---------|
| cmdb-upgrade-design | 699-704 | 一致 | 完全对齐 |
| itsm-upgrade-design | 706-712 | 扩展 705 | 补 workflow_nodes |
| inspection-upgrade-design | 713-720 | 一致 | 完全对齐 |
| automation-upgrade-design | 721-728 | 一致 | 完全对齐 |
| bi-upgrade-design | 729-734 | 一致 | 完全对齐 |
| alert-upgrade-design | 735-744 | 一致 | 完全对齐 |
| rdm-upgrade-design | 745-754 | 一致 | 完全对齐 |
| devops-upgrade-design | 755-765 | 一致 | 完全对齐 |

**总对齐率**：7/8 完全对齐 + 1/8 增强（ITSM 补 705）

---

**文档编号**：`data-model-migration-design-2026-10-03.md`
**关联文档**：
- 上游：8 份 `module-upgrade-designs/*.md`
- 下游：BB（架构融入）+ CC（风险与降级）
- 权威：本文件是唯一 Migration 号段分配权威，8 份模块设计中的号段说明以本文为准

**待更新**：NL-1~NL-5 NeatLogic 一手代码扫描完成后，如需调整某模块表结构，走 patch migration（`NNNx` 号）而非改动现有号段。
