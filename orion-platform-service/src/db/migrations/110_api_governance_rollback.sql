-- Rollback Migration 110_api_governance
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: api_contracts
DROP TABLE IF EXISTS api_contracts CASCADE;

-- Dropping table: contract_violations
DROP TABLE IF EXISTS contract_violations CASCADE;

-- Dropping table: api_versions
DROP TABLE IF EXISTS api_versions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_api_contract;
DROP INDEX IF EXISTS CREATE INDEX idx_api_contract;
DROP INDEX IF EXISTS CREATE INDEX idx_api_contract;
DROP INDEX IF EXISTS CREATE INDEX idx_api_contract;
DROP INDEX IF EXISTS CREATE INDEX idx_api_contract;
DROP INDEX IF EXISTS CREATE INDEX idx_contract_violation;
DROP INDEX IF EXISTS CREATE INDEX idx_contract_violation;
DROP INDEX IF EXISTS CREATE INDEX idx_contract_violation;
DROP INDEX IF EXISTS CREATE INDEX idx_contract_violation;
DROP INDEX IF EXISTS CREATE INDEX idx_contract_violation;
DROP INDEX IF EXISTS CREATE INDEX idx_contract_violation;
DROP INDEX IF EXISTS CREATE INDEX idx_api_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_api_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_api_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_api_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_api_ver;
