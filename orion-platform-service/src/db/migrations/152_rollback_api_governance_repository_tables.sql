-- 152_rollback: 回滚 API Governance Repository Tables

DROP TABLE IF EXISTS api_inventory CASCADE;
DROP TABLE IF EXISTS governance_rules CASCADE;
DROP TABLE IF EXISTS api_versions CASCADE;
DROP TABLE IF EXISTS api_contract_violations CASCADE;
DROP TABLE IF EXISTS api_contracts CASCADE;