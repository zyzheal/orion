-- Auto-generated rollback for version 025. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_contract_endpoints_contract";

DROP INDEX IF EXISTS "idx_api_contracts_tenant";

DROP TABLE IF EXISTS "contract_endpoints" CASCADE;
