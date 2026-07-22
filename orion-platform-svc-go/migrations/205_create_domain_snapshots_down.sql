-- Auto-generated rollback for version 205. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_domain_snapshots_aggregate";

DROP INDEX IF EXISTS "idx_domain_snapshots_tenant";
