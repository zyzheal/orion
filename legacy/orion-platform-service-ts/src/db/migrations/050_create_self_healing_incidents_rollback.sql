-- Rollback Migration 050_create_self_healing_incidents
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: self_healing_incidents
DROP TABLE IF EXISTS self_healing_incidents CASCADE;

-- Dropping table: self_healing_approvals
DROP TABLE IF EXISTS self_healing_approvals CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_healing_incident;
DROP INDEX IF EXISTS CREATE INDEX idx_healing_incident;
DROP INDEX IF EXISTS CREATE INDEX idx_healing_incident;
DROP INDEX IF EXISTS CREATE INDEX idx_healing_incident;
DROP INDEX IF EXISTS CREATE INDEX idx_healing_incident;
DROP INDEX IF EXISTS CREATE INDEX idx_healing_approval;
DROP INDEX IF EXISTS CREATE INDEX idx_healing_approval;
