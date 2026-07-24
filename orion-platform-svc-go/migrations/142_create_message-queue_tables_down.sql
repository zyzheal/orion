-- Auto-generated rollback for version 142. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_message_queues_created";

DROP INDEX IF EXISTS "idx_message_queues_tenant";
