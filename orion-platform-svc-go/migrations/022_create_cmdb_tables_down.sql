-- Auto-generated rollback for version 022. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_ci_versions_ci_id";

DROP INDEX IF EXISTS "idx_ci_versions_tenant_id";

DROP TABLE IF EXISTS "ci_versions" CASCADE;

DROP INDEX IF EXISTS "idx_ci_relations_to_ci_id";

DROP INDEX IF EXISTS "idx_ci_relations_from_ci_id";

DROP INDEX IF EXISTS "idx_ci_relations_tenant_id";

DROP TABLE IF EXISTS "ci_relations" CASCADE;

DROP INDEX IF EXISTS "idx_cis_status";

DROP INDEX IF EXISTS "idx_cis_ci_type";

DROP INDEX IF EXISTS "idx_cis_ci_id";

DROP INDEX IF EXISTS "idx_cis_tenant_id";
