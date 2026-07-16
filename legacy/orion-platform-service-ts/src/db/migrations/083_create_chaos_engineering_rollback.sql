-- Rollback Migration 083_create_chaos_engineering
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: chaos_experiments
DROP TABLE IF EXISTS chaos_experiments CASCADE;

-- Dropping table: chaos_runs
DROP TABLE IF EXISTS chaos_runs CASCADE;

-- Dropping table: resilience_scores
DROP TABLE IF EXISTS resilience_scores CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_chao;
DROP INDEX IF EXISTS CREATE INDEX idx_chao;
DROP INDEX IF EXISTS CREATE INDEX idx_chao;
DROP INDEX IF EXISTS CREATE INDEX idx_chao;
DROP INDEX IF EXISTS CREATE INDEX idx_re;
DROP INDEX IF EXISTS CREATE INDEX idx_re;
