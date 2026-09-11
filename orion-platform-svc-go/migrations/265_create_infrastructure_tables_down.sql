-- Auto-generated rollback for version 050. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_sandbox_network_policies_sandbox_id";

DROP TABLE IF EXISTS "sandbox_network_policies" CASCADE;

DROP INDEX IF EXISTS "idx_infrastructure_sandboxes_isolation_status";

DROP INDEX IF EXISTS "idx_infrastructure_sandboxes_tenant_id";

DROP TABLE IF EXISTS "infrastructure_sandboxes" CASCADE;

DROP INDEX IF EXISTS "idx_infrastructure_connectors_status";

DROP INDEX IF EXISTS "idx_infrastructure_connectors_type";

DROP INDEX IF EXISTS "idx_infrastructure_connectors_tenant_id";
