-- Auto-generated rollback for version 094. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_artifact_lifecycles_created";

DROP INDEX IF EXISTS "idx_artifact_lifecycles_tenant";
