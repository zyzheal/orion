-- Auto-generated rollback for version 071. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- REVIEW: ALTER TABLE may need manual rollback:
--   ALTER TABLE smart_deploy_audit ENABLE ROW LEVEL SECURITY
-- REVIEW: unknown or non-reversible statement:
--   CREATE POLICY smart_deploy_audit_tenant ON smart_deploy_audit
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE))

DROP INDEX IF EXISTS "idx_smart_audit_deployment";

DROP INDEX IF EXISTS "idx_smart_audit_tenant";

-- REVIEW: ALTER TABLE may need manual rollback:
--   ALTER TABLE smart_deploy_rollbacks ENABLE ROW LEVEL SECURITY
-- REVIEW: unknown or non-reversible statement:
--   CREATE POLICY smart_deploy_rollbacks_tenant ON smart_deploy_rollbacks
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE))
DROP TABLE IF EXISTS "smart_deploy_audit" CASCADE;

DROP INDEX IF EXISTS "idx_smart_rollback_deployment";

DROP INDEX IF EXISTS "idx_smart_rollback_tenant";

-- REVIEW: ALTER TABLE may need manual rollback:
--   ALTER TABLE smart_deploy_deployments ENABLE ROW LEVEL SECURITY
-- REVIEW: unknown or non-reversible statement:
--   CREATE POLICY smart_deploy_deployments_tenant ON smart_deploy_deployments
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE))
DROP TABLE IF EXISTS "smart_deploy_rollbacks" CASCADE;

DROP INDEX IF EXISTS "uq_smart_deploy_deployment_id";

DROP INDEX IF EXISTS "idx_smart_deploy_status";

DROP INDEX IF EXISTS "idx_smart_deploy_app_env";

DROP INDEX IF EXISTS "idx_smart_deploy_tenant";
