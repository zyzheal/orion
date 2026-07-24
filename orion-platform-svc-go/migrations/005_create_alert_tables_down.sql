-- Auto-generated rollback for version 005. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_known_issues_status";

DROP INDEX IF EXISTS "idx_known_issues_tenant_id";

DROP TABLE IF EXISTS "alert_known_issues" CASCADE;

DROP INDEX IF EXISTS "idx_maintenance_windows_status";

DROP INDEX IF EXISTS "idx_maintenance_windows_tenant_id";

DROP TABLE IF EXISTS "alert_maintenance_windows" CASCADE;

DROP INDEX IF EXISTS "idx_alert_node_health_tenant_id";

DROP TABLE IF EXISTS "alert_node_health" CASCADE;

DROP INDEX IF EXISTS "idx_alert_topologies_tenant_id";

DROP TABLE IF EXISTS "alert_topologies" CASCADE;

DROP INDEX IF EXISTS "idx_alerts_created_at";

DROP INDEX IF EXISTS "idx_alerts_status";

DROP INDEX IF EXISTS "idx_alerts_fingerprint";

DROP INDEX IF EXISTS "idx_alerts_group_id";

DROP INDEX IF EXISTS "idx_alerts_tenant_id";
