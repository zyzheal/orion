-- Rollback Migration 033_create_chatops_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: chatops_commands
DROP TABLE IF EXISTS chatops_commands CASCADE;

-- Dropping table: chatops_executions
DROP TABLE IF EXISTS chatops_executions CASCADE;

-- Dropping table: chatops_sessions
DROP TABLE IF EXISTS chatops_sessions CASCADE;

-- Dropping table: chatops_audit_logs
DROP TABLE IF EXISTS chatops_audit_logs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
