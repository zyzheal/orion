-- Rollback Migration 077_create_inception_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: sql_audit_history
DROP TABLE IF EXISTS sql_audit_history CASCADE;

-- Dropping table: sql_blacklist
DROP TABLE IF EXISTS sql_blacklist CASCADE;

-- Dropping table: inception_configs
DROP TABLE IF EXISTS inception_configs CASCADE;

-- Dropping table: audit_reports
DROP TABLE IF EXISTS audit_reports CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_inception_config;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_report;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_report;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_report;
