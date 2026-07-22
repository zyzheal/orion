-- Auto-generated rollback for version 231. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_workflow_tasks_created";

DROP INDEX IF EXISTS "idx_workflow_tasks_tenant";
