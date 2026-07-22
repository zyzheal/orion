-- Auto-generated rollback for version 034. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_diagnostic_patterns_tenant";

DROP INDEX IF EXISTS "idx_diagnostic_reports_session";

DROP INDEX IF EXISTS "idx_diagnostic_symptoms_session";

DROP INDEX IF EXISTS "idx_diagnostic_sessions_status";

DROP INDEX IF EXISTS "idx_diagnostic_sessions_tenant";

DROP TABLE IF EXISTS "diagnostic_patterns" CASCADE;

DROP TABLE IF EXISTS "diagnostic_reports" CASCADE;

DROP TABLE IF EXISTS "diagnostic_symptoms" CASCADE;
