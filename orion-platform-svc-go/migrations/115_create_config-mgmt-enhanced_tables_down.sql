-- Auto-generated rollback for version 115. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_drift_reports_created";

DROP INDEX IF EXISTS "idx_drift_reports_tenant";

DROP TABLE IF EXISTS "drift_reports" CASCADE;

DROP INDEX IF EXISTS "idx_change_histories_created";

DROP INDEX IF EXISTS "idx_change_histories_tenant";

DROP TABLE IF EXISTS "change_histories" CASCADE;

DROP INDEX IF EXISTS "idx_change_requests_created";

DROP INDEX IF EXISTS "idx_change_requests_tenant";

DROP TABLE IF EXISTS "change_requests" CASCADE;

DROP INDEX IF EXISTS "idx_config_mgmts_created";

DROP INDEX IF EXISTS "idx_config_mgmts_tenant";
