-- Rollback Migration 091_ai_decision_enhancement
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: ai_decision_explanations
DROP TABLE IF EXISTS ai_decision_explanations CASCADE;

-- Dropping table: ai_model_versions
DROP TABLE IF EXISTS ai_model_versions CASCADE;

-- Dropping table: ai_ab_test_results
DROP TABLE IF EXISTS ai_ab_test_results CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_ai_deci;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_deci;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_deci;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_deci;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_model_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_model_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_model_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_ab_te;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_ab_te;
DROP INDEX IF EXISTS CREATE INDEX idx_ai_ab_te;
DROP INDEX IF EXISTS idx_ai_deci;
DROP INDEX IF EXISTS idx_ai_model_ver;
DROP INDEX IF EXISTS idx_ai_ab_te;
