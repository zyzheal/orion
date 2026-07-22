-- Auto-generated rollback for version 169. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_queues_created";

DROP INDEX IF EXISTS "idx_queues_tenant";
