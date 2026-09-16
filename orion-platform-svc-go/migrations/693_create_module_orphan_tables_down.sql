-- Reverse 693_create_module_orphan_tables.sql.

DROP INDEX IF EXISTS idx_cmdb_relationships_target;
DROP INDEX IF EXISTS idx_cmdb_relationships_source;
DROP TABLE IF EXISTS cmdb_relationships;

DROP INDEX IF EXISTS idx_cmdb_rel_types_tenant;
DROP TABLE IF EXISTS cmdb_relationship_types;

DROP INDEX IF EXISTS idx_cmdb_drift_records_status;
DROP INDEX IF EXISTS idx_cmdb_drift_records_tenant;
DROP TABLE IF EXISTS cmdb_drift_records;

DROP INDEX IF EXISTS idx_recovery_actions_tenant;
DROP TABLE IF EXISTS recovery_actions;

DROP INDEX IF EXISTS idx_auto_recovery_rules_tenant;
DROP TABLE IF EXISTS auto_recovery_rules;

DROP INDEX IF EXISTS idx_alert_events_status;
DROP INDEX IF EXISTS idx_alert_events_tenant;
DROP TABLE IF EXISTS alert_events;

DROP INDEX IF EXISTS idx_alert_adapters_tenant;
DROP TABLE IF EXISTS alert_adapters;

DROP TABLE IF EXISTS event_bus_config;

DROP INDEX IF EXISTS idx_event_logs_status;
DROP INDEX IF EXISTS idx_event_logs_tenant;
DROP TABLE IF EXISTS event_logs;

DROP INDEX IF EXISTS idx_event_subscriptions_tenant;
DROP TABLE IF EXISTS event_subscriptions;

DROP SEQUENCE IF EXISTS event_bus_seq;

DROP INDEX IF EXISTS idx_git_sync_configs_tenant;
DROP TABLE IF EXISTS git_sync_configs;

DROP INDEX IF EXISTS idx_config_drifts_tenant;
DROP TABLE IF EXISTS config_drifts;

DROP INDEX IF EXISTS idx_config_canaries_tenant;
DROP TABLE IF EXISTS config_canaries;

DROP INDEX IF EXISTS idx_config_approvals_tenant;
DROP TABLE IF EXISTS config_approvals;

DROP INDEX IF EXISTS idx_sla_policies_tenant;
DROP TABLE IF EXISTS sla_policies;

DROP INDEX IF EXISTS idx_automation_rule_execs_tenant;
DROP TABLE IF EXISTS automation_rule_executions;

DROP INDEX IF EXISTS idx_automation_rules_tenant;
DROP TABLE IF EXISTS automation_rules;

DROP TABLE IF EXISTS assignment_rules;

DROP INDEX IF EXISTS idx_notification_history_tenant;
DROP TABLE IF EXISTS notification_history;

DROP INDEX IF EXISTS idx_metric_data_points_key;
DROP TABLE IF EXISTS metric_data_points;

DROP INDEX IF EXISTS idx_alert_instances_status;
DROP INDEX IF EXISTS idx_alert_instances_tenant;
DROP TABLE IF EXISTS alert_instances;

DROP INDEX IF EXISTS idx_monitor_hosts_status;
DROP INDEX IF EXISTS idx_monitor_hosts_tenant;
DROP TABLE IF EXISTS monitor_hosts;