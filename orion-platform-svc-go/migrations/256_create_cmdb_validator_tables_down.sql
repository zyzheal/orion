-- Rollback for migration 256: CMDB Validator Tables
DROP TABLE IF EXISTS cmdb_validation_results;
DROP TABLE IF EXISTS cmdb_validation_rules;
