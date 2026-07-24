-- Auto-generated rollback for version 096. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_auth_token_blacklists_created";

DROP INDEX IF EXISTS "idx_auth_token_blacklists_tenant";

DROP TABLE IF EXISTS "auth_token_blacklists" CASCADE;

DROP INDEX IF EXISTS "idx_auth_keies_created";

DROP INDEX IF EXISTS "idx_auth_keies_tenant";
