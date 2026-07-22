-- Rollback Migration 150_create_api_governance_cost_optimization_tables
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

-- Dropping table: cost_recommendations
DROP TABLE IF EXISTS cost_recommendations CASCADE;

-- Dropping table: savings_tracking
DROP TABLE IF EXISTS savings_tracking CASCADE;

DROP INDEX IF EXISTS idx_api_contract;
DROP INDEX IF EXISTS idx_api_contract;
DROP INDEX IF EXISTS idx_api_contract_violation;
DROP INDEX IF EXISTS idx_api_ver;
DROP INDEX IF EXISTS idx_api_ver;
DROP INDEX IF EXISTS idx_governance_rule;
DROP INDEX IF EXISTS idx_governance_rule;
DROP INDEX IF EXISTS idx_api_inventory_tenant ON api_inventory(tenant_id);;
DROP INDEX IF EXISTS idx_co;
DROP INDEX IF EXISTS idx_co;
DROP INDEX IF EXISTS idx_;
DROP INDEX IF EXISTS idx_;
