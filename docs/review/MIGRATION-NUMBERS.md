# 迁移编号映射表

> 生成日期: 2026-05-05
> 最后更新: 2026-05-05
> 总计: 119 个迁移文件

## Phase 1 迁移 (086-090)

| 编号 | 文件名 | 能力域 | 表 |
|------|--------|--------|-----|
| 086 | 086_quality_gate_enhancement.sql | 质量门禁增强 | policy_overrides, policy_exemptions, quality_gate_snapshots |
| 087 | 087_deploy_release_enhancement.sql | 部署发布增强 | deploy_windows, deploy_emergencies, deploy_service_dependencies, deploy_progressive_stages |
| 088 | 088_developer_portal.sql | 开发者门户 | portal_documents |
| 089 | 089_environment_management.sql | 环境管理 | environment_templates, environment_hibernation_log, environment_ttl_config |
| 090 | 090_artifacts_persistence.sql | 构建制品 | artifacts |

## Phase 2 迁移 (091-096)

| 编号 | 文件名 | 能力域 | 表 |
|------|--------|--------|-----|
| 091 | 091_ai_decision_enhancement.sql | AI 决策引擎 | ai_decision_explanations, ai_model_versions, ai_ab_test_results |
| 092 | 092_autonomous_pipeline.sql | 自治流水线 | pipeline_error_classification, pipeline_stage_baselines, pipeline_auto_retries |
| 093 | 093_observability_enhancement.sql | 全栈可观测性 | custom_alert_rules, rca_analyses, alert_silences |
| 094 | 094_cost_operations.sql | 成本运营 | cost_budget_guards, cost_records, cost_anomalies |
| 095 | 095_approval_workflow.sql | 审批工作流 | approval_requests, approval_templates |
| 096 | 096_efficiency_operations.sql | 效率运营 | developer_profiles, efficiency_metrics, efficiency_dashboard_snapshots |

## Phase 3 迁移 (097-111) — 计划中

| 编号 | 能力域 | 预期表 |
|------|--------|--------|
| 097 | 混沌工程 | chaos_experiments, chaos_faults, chaos_recovery_results |
| 098 | 供应链安全 | supply_chain_sboms, dependency_graphs, artifact_signatures |
| 099 | 联邦调度 | federation_clusters, cluster_health, cross_cluster_jobs |
| 100 | 多云适配 | cloud_accounts, cloud_resources, cloud_providers |
| 101 | 插件市场 | marketplace_plugins, plugin_installations, plugin_ratings |
| 102 | 灰度流量 | canary_deployments, traffic_splits, canary_analysis_results |
| 103 | 制品运营 | artifact_operations, artifact_scans, artifact_retention_policies |
| 104 | 灾备恢复 | disaster_recovery_plans, dr_failover_tests, backup_configs |
| 105 | 数据管道 | data_pipelines, pipeline_schedules, data_lineage |
| 106 | 性能工程 | performance_baselines, performance_profiles, optimization_recommendations |
| 107 | 社区生态 | community_contributors, community_plugins, community_discussions |
| 108 | 多模态触发 | trigger_definitions, trigger_executions, webhook_registrations |
| 109 | 跨域编排 | orchestration_workflows, workflow_steps, step_executions |
| 110 | 配置管理 | config_change_requests, config_drift_records, remediation_logs |
| 111 | 安全合规 | compliance_policies, compliance_evaluations, audit_findings |

## Phase 4 迁移 (112-116) — 计划中

| 编号 | 能力域 | 预期表 |
|------|--------|--------|
| 112 | 数字孪生 | twin_snapshots, twin_configurations, twin_replay_logs |
| 113 | API 治理 | api_contracts, contract_violations, api_versions |
| 114 | 社区生态进阶 | contributor_badges, community_incentives, mentorship_pairs |
| 115 | 联邦调度进阶 | cross_cluster_scheduling, policy_engines, resource_pools |
| 116 | 多云混合云 | cross_zone_dr, multi_cloud_cost, cloud_networking |

## 历史迁移 (001-084)

001-079: 基础架构和功能迁移
080: pipeline_versions (LLM traces)
081: pipeline_versions
082: ai_model_versions
083: chaos_engineering
084: digital_twin
085: 已删除（与 089 合并）
