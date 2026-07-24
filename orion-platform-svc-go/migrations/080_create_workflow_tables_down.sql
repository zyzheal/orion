-- Auto-generated rollback for version 080. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_lowcode_workflow_instance_created";

DROP INDEX IF EXISTS "idx_lowcode_workflow_instance_status";

DROP INDEX IF EXISTS "idx_lowcode_workflow_instance_workflow";

DROP INDEX IF EXISTS "idx_lowcode_workflow_definition_enabled";

DROP INDEX IF EXISTS "idx_lowcode_workflow_definition_tenant";

DROP TABLE IF EXISTS "lowcode_workflow_instance" CASCADE;
