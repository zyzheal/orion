-- Auto-generated rollback for version 139. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_lowcode_instances_created";

DROP INDEX IF EXISTS "idx_lowcode_instances_tenant";

DROP TABLE IF EXISTS "lowcode_instances" CASCADE;

DROP INDEX IF EXISTS "idx_lowcode_flows_created";

DROP INDEX IF EXISTS "idx_lowcode_flows_tenant";
