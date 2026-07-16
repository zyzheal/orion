-- Rollback Migration 093_observability_enhancement
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: custom_alert_rules
DROP TABLE IF EXISTS custom_alert_rules CASCADE;

-- Dropping table: rca_analyses
DROP TABLE IF EXISTS rca_analyses CASCADE;

-- Dropping table: alert_silences
DROP TABLE IF EXISTS alert_silences CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_cu;
DROP INDEX IF EXISTS CREATE INDEX idx_cu;
DROP INDEX IF EXISTS CREATE INDEX idx_cu;
DROP INDEX IF EXISTS CREATE INDEX idx_cu;
DROP INDEX IF EXISTS CREATE INDEX idx_rca_analy;
DROP INDEX IF EXISTS CREATE INDEX idx_rca_analy;
DROP INDEX IF EXISTS CREATE INDEX idx_rca_analy;
DROP INDEX IF EXISTS CREATE INDEX idx_alert_;
DROP INDEX IF EXISTS CREATE INDEX idx_alert_;
DROP INDEX IF EXISTS CREATE INDEX idx_alert_;
DROP INDEX IF EXISTS idx_cu;
DROP INDEX IF EXISTS idx_rca_analy;
DROP INDEX IF EXISTS idx_alert_;
