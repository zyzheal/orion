# 孤儿表盘点 — 代码引用但无迁移创建 (2026-09-16)

> 阶段 C 交付物：29 个非活跃模块代码激活盘点的最终孤儿表清单。
> 方法：扫描 `internal/*/repository` 中 `FROM/INTO/UPDATE/JOIN` 引用的全部表名，与 `migrations/*.sql` 已创建表做差集，剔除子目录迁移与误报，得到 **80 张**真实孤儿表。

## 结论摘要

| 指标 | 值 |
|---|---|
| 600-686 迁移创建的新表 | 186 |
| 其中被 Go 代码引用的 | 185（138 个激活 + 47 个历史引用） |
| **纯蓝图（无代码引用）** | **1**（`'above'` — 迁移头注释的误报，实际 0） |
| 孤儿表（代码引用但无迁移创建） | **80** |
| 孤儿表所属模块 | 22 个，全部 live-wired 于 `cmd/server/` |
| 已通过 687/688 修复 | `ticket_automation` → 687（未提交）；`notification_management` 等 18 张 → 688 |
| **仍缺迁移的孤儿表** | **80** |

> 注：严格口径为 **80 张**。早期手写清单含 3 个单复数词干误报（`artifact_lifecycle`/`disaster_plan`/`sla_tracking`，真实表为复数形式且已由迁移创建）与 1 张已修复表 `ticket_automation`（687 迁移已创建，未提交）。

## 孤儿表全清单（80 张，按模块分组）

### ai (14 张)
`ai_agent_audit_logs` `ai_agents` `ai_canary_configs` `ai_cost_records` `ai_cost_savings` `ai_models` `ai_review` `ai_security` `intelligence_tasks` `knowledge_bases` `model_custom_pricing` `orchestration_runs` `orchestrations` `skill_packages`

### infrastructure (12 张)
`capacity_alerts` `capacity_forecasts` `capacity_metrics` `capacity_reports` `dba_orders` `dba_query_logs` `multicloud_providers` `scaling_policies` `serverless_logs` `serverless_metrics` `twin_sandboxes` `twin_snapshots`

### ci-cd (10 张)
`artifact_entries` `artifact_registries` `artifact_versions` `builder_images` `deploy_emergencies` `deploy_progressive_stages` `deployment_events` `runners` `stage_executions` `task_executions`

### governance (5 张)
`api_contract_violations` `api_inventory` `api_versions` `compliance_remediations` `governance_rules`

### code-repo (5 张)
`code_repo_codeowners` `code_repo_commits` `code_repo_diffs` `code_repo_repos` `code_repo_webhook_logs`

### visor (4 张)
`alert_instances` `metric_data_points` `monitor_hosts` `notification_history`

### ticket (4 张)
`assignment_rules` `automation_rule_executions` `automation_rules` `sla_policies`

### config (4 张)
`config_approvals` `config_canaries` `config_drifts` `git_sync_configs`

### eventbus (3 张)
`event_bus_config` `event_logs` `event_subscriptions`

### alert-adapter (2 张)
`alert_adapters` `alert_events`

### auto-recovery (2 张)
`auto_recovery_rules` `recovery_actions`

### cmdb-relationship (2 张)
`cmdb_relationship_types` `cmdb_relationships`

### cron (2 张)
`scheduler_job_definitions` `scheduler_job_execution_logs`

### degradation (2 张)
`degradation_actions` `degradation_triggers`

### llm-trace (2 张)
`llm_model_pricing` `llm_traces`

### 单表模块 (7 个, 7 张)
chatops `chatops_roles` / cmdb-drift `cmdb_drift_records` / crossover `crossover_calls` / gateway-dynamic `gateway_gray_release` / queue `queue_jobs` / skill `skill_versions` / webhook `webhook_config`

## 已判定误报（不计入）

| 表名 | 误报原因 |
|---|---|
| `arguments` | 测试文件中的 Go 字符串字面量 |
| `sqlite_master` | data-catalog 模块的 SQLite 内省 |
| `perm_probe` | 仅出现在测试注释里（`permission/repository/repository_test.go`） |
| `notification` | 仅出现在 Go 注释/import 包名中，非 SQL 表 |

## 与子目录迁移的交叉核对

`migrations/cmdb-import/` `migrations/dba/` `migrations/file-handler/` `migrations/governance/` `migrations/notification/` `migrations/security/` `migrations/workflow/` 等子目录迁移**不会被扁平迁移 runner `LoadMigrations` 加载**（它跳过子目录）。已逐一交叉核对 80 张孤儿表，**无一张被子目录迁移覆盖** —— 这些表的匹配迁移文件若存在，必须被提升到扁平目录（如 687/688 先例）才能被执行。

## 修复优先级建议

所有 26 个模块均已 live-wired（`cmd/server/` 中有对应 wiring 文件），故按"HTTP 路由是否已注册"区分：

1. **P0（路由已注册，当前 500）**：`ticket-automation`（687 已创建）、`incident-action`（377 已创建）。检查有无其他模块在 `router.go` 中注册了依赖缺失表的 handler。
2. **P1（wiring 已建，但路由未注册或模块 dormant）**：其余 24 模块的 82 张孤儿表。建议按域分批创建扁平迁移：
   - 688 已覆盖域（消息/通知/脚本/服务目录/网关），其余分组见上面清单。
   - 每批新迁移须带 `_down.sql` 反向文件，并复跑干净库 UP/DOWN 全链路验证（B1 方法）。
3. **P2（历史引用，无活跃路由）**：若某张孤儿表只在 dormant 代码路径中被引用，可按需创建迁移或标记待删除。

## 相关迁移编号

| 编号 | 迁移 | 状态 |
|---|---|---|
| 687 | `create_ticket_automation_table` | 已修复（本次盘点驱动） |
| 688 | `create_hyphen_named_module_tables` | 已修复（覆盖 notification_management 等） |