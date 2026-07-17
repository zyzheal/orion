-- Auto-generated rollback for version 007. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_ag_verification_history_verified_at";

DROP INDEX IF EXISTS "idx_ag_verification_history_contract_id";

DROP TABLE IF EXISTS "api_governance_verification_history" CASCADE;

DROP INDEX IF EXISTS "idx_ag_rules_created_at";

DROP INDEX IF EXISTS "idx_ag_rules_enabled";

DROP INDEX IF EXISTS "idx_ag_rules_tenant_id";

DROP TABLE IF EXISTS "api_governance_rules" CASCADE;

DROP INDEX IF EXISTS "idx_ag_violations_detected_at";

DROP INDEX IF EXISTS "idx_ag_violations_severity";

DROP INDEX IF EXISTS "idx_ag_violations_contract_id";

DROP TABLE IF EXISTS "api_governance_violations" CASCADE;

DROP INDEX IF EXISTS "idx_ag_versions_registered_at";

DROP INDEX IF EXISTS "idx_ag_versions_status";

DROP INDEX IF EXISTS "idx_ag_versions_version";

DROP INDEX IF EXISTS "idx_ag_versions_contract_id";

DROP INDEX IF EXISTS "idx_ag_versions_tenant_id";

DROP TABLE IF EXISTS "api_governance_versions" CASCADE;

DROP INDEX IF EXISTS "idx_ag_contracts_created_at";

DROP INDEX IF EXISTS "idx_ag_contracts_status";

DROP INDEX IF EXISTS "idx_ag_contracts_api_name";

DROP INDEX IF EXISTS "idx_ag_contracts_tenant_id";
