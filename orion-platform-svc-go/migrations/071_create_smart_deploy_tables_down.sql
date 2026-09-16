-- Auto-generated rollback for version 071. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- Fixed: policy cleanup (auto-generator had left CREATE body in down file).
-- Row-level security is disabled automatically when the table is dropped.
DROP POLICY IF EXISTS smart_deploy_audit_tenant ON smart_deploy_audit;
DROP POLICY IF EXISTS smart_deploy_rollbacks_tenant ON smart_deploy_rollbacks;
DROP POLICY IF EXISTS smart_deploy_deployments_tenant ON smart_deploy_deployments;

DROP INDEX IF EXISTS "idx_smart_audit_deployment";
DROP INDEX IF EXISTS "idx_smart_audit_tenant";
DROP TABLE IF EXISTS "smart_deploy_audit" CASCADE;

DROP INDEX IF EXISTS "idx_smart_rollback_deployment";
DROP INDEX IF EXISTS "idx_smart_rollback_tenant";
DROP TABLE IF EXISTS "smart_deploy_rollbacks" CASCADE;

DROP INDEX IF EXISTS "uq_smart_deploy_deployment_id";
DROP INDEX IF EXISTS "idx_smart_deploy_status";
DROP INDEX IF EXISTS "idx_smart_deploy_app_env";
DROP INDEX IF EXISTS "idx_smart_deploy_tenant";
