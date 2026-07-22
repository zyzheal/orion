-- Auto-generated rollback for version 053. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_monitoring_anomalies_metric";

DROP INDEX IF EXISTS "idx_monitoring_anomalies_tenant_id";

DROP TABLE IF EXISTS "monitoring_anomalies" CASCADE;

DROP INDEX IF EXISTS "idx_widget_configs_tenant_id";

DROP TABLE IF EXISTS "widget_configs" CASCADE;

DROP INDEX IF EXISTS "idx_notification_records_alert_id";

DROP INDEX IF EXISTS "idx_notification_records_tenant_id";

DROP TABLE IF EXISTS "notification_records" CASCADE;

DROP INDEX IF EXISTS "idx_escalation_policies_tenant_id";

DROP TABLE IF EXISTS "escalation_policies" CASCADE;

DROP INDEX IF EXISTS "idx_notification_channels_type";

DROP INDEX IF EXISTS "idx_notification_channels_tenant_id";

DROP TABLE IF EXISTS "notification_channels" CASCADE;

DROP INDEX IF EXISTS "idx_monitoring_alerts_status";

DROP INDEX IF EXISTS "idx_monitoring_alerts_rule_id";

DROP INDEX IF EXISTS "idx_monitoring_alerts_tenant_id";

DROP TABLE IF EXISTS "monitoring_alerts" CASCADE;

DROP INDEX IF EXISTS "idx_monitoring_alert_rules_enabled";

DROP INDEX IF EXISTS "idx_monitoring_alert_rules_metric";

DROP INDEX IF EXISTS "idx_monitoring_alert_rules_tenant_id";

DROP TABLE IF EXISTS "monitoring_alert_rules" CASCADE;

DROP INDEX IF EXISTS "idx_monitoring_metrics_name";

DROP INDEX IF EXISTS "idx_monitoring_metrics_tenant_id";
