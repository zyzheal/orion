-- Auto-generated rollback for version 188. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_artifact_signatures_created";

DROP INDEX IF EXISTS "idx_artifact_signatures_tenant";

DROP TABLE IF EXISTS "artifact_signatures" CASCADE;

DROP INDEX IF EXISTS "idx_s_b_o_ms_created";

DROP INDEX IF EXISTS "idx_s_b_o_ms_tenant";

DROP TABLE IF EXISTS "s_b_o_ms" CASCADE;

DROP INDEX IF EXISTS "idx_artifacts_created";

DROP INDEX IF EXISTS "idx_artifacts_tenant";
