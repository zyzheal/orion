-- Rollback Migration 055c_create_self_healing_audit_log
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: self_healing_audit_log
DROP TABLE IF EXISTS self_healing_audit_log CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_healing_audit_incident ON;
DROP INDEX IF EXISTS CREATE INDEX idx_healing_audit_;
DROP INDEX IF EXISTS CREATE INDEX idx_healing_audit_environment ON;
DROP INDEX IF EXISTS CREATE INDEX idx_healing_audit_created ON;
