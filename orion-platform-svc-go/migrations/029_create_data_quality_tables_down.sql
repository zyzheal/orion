-- Auto-generated rollback for version 029. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_quality_alerts_tenant";

DROP INDEX IF EXISTS "idx_quality_scan_results_rule";

DROP INDEX IF EXISTS "idx_quality_scan_results_tenant";

DROP INDEX IF EXISTS "idx_data_quality_rules_tenant";

DROP TABLE IF EXISTS "quality_alerts" CASCADE;

DROP TABLE IF EXISTS "quality_scan_results" CASCADE;
