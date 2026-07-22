-- Auto-generated rollback for version 021. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_ci_type_versions_ci_type_id";

DROP TABLE IF EXISTS "ci_type_versions" CASCADE;

DROP INDEX IF EXISTS "idx_ci_type_attributes_ci_type_id";

DROP TABLE IF EXISTS "ci_type_attributes" CASCADE;

DROP INDEX IF EXISTS "idx_ci_types_status";

DROP INDEX IF EXISTS "idx_ci_types_tenant";
