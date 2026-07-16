-- Rollback Migration 152_create_api_governance_repository_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: api_contracts
DROP TABLE IF EXISTS api_contracts CASCADE;

-- Dropping table: api_contract_violations
DROP TABLE IF EXISTS api_contract_violations CASCADE;

-- Dropping table: api_versions
DROP TABLE IF EXISTS api_versions CASCADE;

-- Dropping table: governance_rules
DROP TABLE IF EXISTS governance_rules CASCADE;

-- Dropping table: api_inventory
DROP TABLE IF EXISTS api_inventory CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_api_contract;
DROP INDEX IF EXISTS CREATE INDEX idx_api_contract;
DROP INDEX IF EXISTS CREATE INDEX idx_api_contract_violation;
DROP INDEX IF EXISTS CREATE INDEX idx_api_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_api_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_api_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_governance_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_governance_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_governance_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_api_inventory_tenant_id ON api_inventory(tenant_id);;
