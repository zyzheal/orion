-- Auto-generated rollback for version 114. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_compliance_schedules_created";

DROP INDEX IF EXISTS "idx_compliance_schedules_tenant";

DROP TABLE IF EXISTS "compliance_schedules" CASCADE;

DROP INDEX IF EXISTS "idx_compliance_reports_created";

DROP INDEX IF EXISTS "idx_compliance_reports_tenant";
