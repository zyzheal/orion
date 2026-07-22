-- Auto-generated rollback for version 088. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_canary_configs_created";

DROP INDEX IF EXISTS "idx_canary_configs_tenant";

DROP TABLE IF EXISTS "canary_configs" CASCADE;

DROP INDEX IF EXISTS "idx_model_versions_created";

DROP INDEX IF EXISTS "idx_model_versions_tenant";

DROP TABLE IF EXISTS "model_versions" CASCADE;

DROP INDEX IF EXISTS "idx_a_i_models_created";

DROP INDEX IF EXISTS "idx_a_i_models_tenant";
