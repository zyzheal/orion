-- Auto-generated rollback for version 232. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_trigger_logs_created";

DROP INDEX IF EXISTS "idx_trigger_logs_tenant";

DROP TABLE IF EXISTS "trigger_logs" CASCADE;

DROP INDEX IF EXISTS "idx_workflow_triggers_created";

DROP INDEX IF EXISTS "idx_workflow_triggers_tenant";
