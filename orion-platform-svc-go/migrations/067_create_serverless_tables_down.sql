-- Auto-generated rollback for version 067. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_serverless_triggers_type";

DROP INDEX IF EXISTS "idx_serverless_triggers_function_id";

DROP INDEX IF EXISTS "idx_serverless_triggers_tenant_id";

DROP TABLE IF EXISTS "serverless_triggers" CASCADE;

DROP INDEX IF EXISTS "idx_serverless_function_logs_created_at";

DROP INDEX IF EXISTS "idx_serverless_function_logs_level";

DROP INDEX IF EXISTS "idx_serverless_function_logs_function_id";

DROP INDEX IF EXISTS "idx_serverless_function_logs_tenant_id";

DROP TABLE IF EXISTS "serverless_function_logs" CASCADE;

DROP INDEX IF EXISTS "idx_serverless_deployments_created_at";

DROP INDEX IF EXISTS "idx_serverless_deployments_status";

DROP INDEX IF EXISTS "idx_serverless_deployments_function_id";

DROP INDEX IF EXISTS "idx_serverless_deployments_tenant_id";

DROP TABLE IF EXISTS "serverless_deployments" CASCADE;

DROP INDEX IF EXISTS "idx_serverless_functions_runtime";

DROP INDEX IF EXISTS "idx_serverless_functions_status";

DROP INDEX IF EXISTS "idx_serverless_functions_tenant_id";
