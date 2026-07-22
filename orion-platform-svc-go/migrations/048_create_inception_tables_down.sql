-- Auto-generated rollback for version 048. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_audit_reports_created";

DROP INDEX IF EXISTS "idx_audit_reports_status";

DROP INDEX IF EXISTS "idx_audit_reports_tenant";

DROP INDEX IF EXISTS "idx_inception_configs_tenant";

DROP INDEX IF EXISTS "idx_sql_blacklist_enabled";

DROP INDEX IF EXISTS "idx_sql_blacklist_pattern";

DROP INDEX IF EXISTS "idx_sql_audit_history_created";

DROP INDEX IF EXISTS "idx_sql_audit_history_status";

DROP INDEX IF EXISTS "idx_sql_audit_history_db";

DROP INDEX IF EXISTS "idx_sql_audit_history_tenant";
