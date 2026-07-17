-- Auto-generated rollback for version 206. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_saga_instances_type";

DROP INDEX IF EXISTS "idx_saga_instances_status";

DROP INDEX IF EXISTS "idx_saga_instances_tenant";
