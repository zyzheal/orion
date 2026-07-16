-- Rollback Migration 018_create_risk
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: risk_assessments
DROP TABLE IF EXISTS risk_assessments CASCADE;

-- Dropping table: risk_rules
DROP TABLE IF EXISTS risk_rules CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_ri;
DROP INDEX IF EXISTS CREATE INDEX idx_ri;
