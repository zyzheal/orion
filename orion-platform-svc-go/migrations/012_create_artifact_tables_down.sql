-- Auto-generated rollback for version 012. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_artifact_promotions_artifact_id";

DROP INDEX IF EXISTS "idx_artifact_promotions_tenant_id";

DROP TABLE IF EXISTS "artifact_promotions" CASCADE;

DROP INDEX IF EXISTS "idx_artifact_downloads_artifact_id";

DROP INDEX IF EXISTS "idx_artifact_downloads_tenant_id";

DROP TABLE IF EXISTS "artifact_downloads" CASCADE;

DROP INDEX IF EXISTS "idx_artifact_tags_artifact_id";

DROP INDEX IF EXISTS "idx_artifact_tags_tenant_id";

DROP TABLE IF EXISTS "artifact_tags" CASCADE;

DROP INDEX IF EXISTS "idx_artifacts_status";

DROP INDEX IF EXISTS "idx_artifacts_type";

DROP INDEX IF EXISTS "idx_artifacts_namespace";

DROP INDEX IF EXISTS "idx_artifacts_tenant_id";
