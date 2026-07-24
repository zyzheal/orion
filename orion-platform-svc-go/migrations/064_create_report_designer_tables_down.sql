-- Auto-generated rollback for version 064. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_report_executions_status";

DROP INDEX IF EXISTS "idx_report_executions_schedule_id";

DROP INDEX IF EXISTS "idx_report_executions_report_id";

DROP INDEX IF EXISTS "idx_report_executions_tenant";

DROP INDEX IF EXISTS "idx_report_schedules_enabled";

DROP INDEX IF EXISTS "idx_report_schedules_report_id";

DROP INDEX IF EXISTS "idx_report_schedules_tenant";

DROP INDEX IF EXISTS "idx_report_datasources_status";

DROP INDEX IF EXISTS "idx_report_datasources_report_id";

DROP INDEX IF EXISTS "idx_report_datasources_tenant";

DROP INDEX IF EXISTS "idx_report_definitions_enabled";

DROP INDEX IF EXISTS "idx_report_definitions_status";

DROP INDEX IF EXISTS "idx_report_definitions_category";

DROP INDEX IF EXISTS "idx_report_definitions_tenant";
