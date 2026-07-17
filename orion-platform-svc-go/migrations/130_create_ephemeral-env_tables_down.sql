-- Auto-generated rollback for version 130. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_ephemeral_envs_created";

DROP INDEX IF EXISTS "idx_ephemeral_envs_tenant";
