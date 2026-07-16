-- Rollback Migration 082_create_ai_model_versions
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: ai_model_versions
DROP TABLE IF EXISTS ai_model_versions CASCADE;

-- Dropping table: ai_decision_feedback
DROP TABLE IF EXISTS ai_decision_feedback CASCADE;

-- Dropping table: degradation_configs
DROP TABLE IF EXISTS degradation_configs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_ai_model_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_model_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_model_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_deci;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_deci;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_deci;
DROP INDEX IF EXISTS CREATE INDEX idx_degradation_config;
