-- Auto-generated rollback for version 011. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_retention_policies_tenant_id";

DROP TABLE IF EXISTS "retention_policies" CASCADE;

DROP INDEX IF EXISTS "idx_scan_reports_scan_id";

DROP INDEX IF EXISTS "idx_scan_reports_tenant_id";

DROP TABLE IF EXISTS "scan_reports" CASCADE;

DROP INDEX IF EXISTS "idx_artifact_scans_status";

DROP INDEX IF EXISTS "idx_artifact_scans_artifact_id";

DROP INDEX IF EXISTS "idx_artifact_scans_tenant_id";

DROP TABLE IF EXISTS "artifact_scans" CASCADE;

DROP INDEX IF EXISTS "idx_artifact_operations_artifact_id";

DROP INDEX IF EXISTS "idx_artifact_operations_tenant_id";
