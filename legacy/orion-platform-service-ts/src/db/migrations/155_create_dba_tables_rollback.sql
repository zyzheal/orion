-- Rollback Migration 155_create_dba_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: dba_data_sources
DROP TABLE IF EXISTS dba_data_sources CASCADE;

-- Dropping table: dba_audit_rules
DROP TABLE IF EXISTS dba_audit_rules CASCADE;

-- Dropping table: dba_sql_orders
DROP TABLE IF EXISTS dba_sql_orders CASCADE;

-- Dropping table: dba_user_permissions
DROP TABLE IF EXISTS dba_user_permissions CASCADE;

-- Dropping table: dba_audit_logs
DROP TABLE IF EXISTS dba_audit_logs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_dba_data_;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_data_;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_data_;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_audit_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_audit_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_u;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_u;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_dba_audit_log;
