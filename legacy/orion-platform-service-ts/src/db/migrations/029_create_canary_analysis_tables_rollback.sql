-- Rollback Migration 029_create_canary_analysis_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: canary_analysis_runs
DROP TABLE IF EXISTS canary_analysis_runs CASCADE;

-- Dropping table: canary_metric_results
DROP TABLE IF EXISTS canary_metric_results CASCADE;

-- Dropping table: canary_ml_results
DROP TABLE IF EXISTS canary_ml_results CASCADE;

-- Dropping table: canary_analysis_configs
DROP TABLE IF EXISTS canary_analysis_configs CASCADE;

-- Dropping table: canary_decisions
DROP TABLE IF EXISTS canary_decisions CASCADE;

-- Dropping table: canary_retrain_jobs
DROP TABLE IF EXISTS canary_retrain_jobs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_canary_run;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_run;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_metric;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_metric;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_ml_run ON canary_ml_re;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_deci;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_deci;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_retrain_;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_retrain_;
