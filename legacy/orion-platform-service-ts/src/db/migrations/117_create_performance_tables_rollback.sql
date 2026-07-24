-- Rollback Migration 117_create_performance_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: performance_baselines
DROP TABLE IF EXISTS performance_baselines CASCADE;

-- Dropping table: performance_evaluations
DROP TABLE IF EXISTS performance_evaluations CASCADE;

-- Dropping table: performance_test_results
DROP TABLE IF EXISTS performance_test_results CASCADE;

-- Dropping table: performance_profiles
DROP TABLE IF EXISTS performance_profiles CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_perf_ba;
DROP INDEX IF EXISTS CREATE INDEX idx_perf_ba;
DROP INDEX IF EXISTS CREATE INDEX idx_perf_evaluation;
DROP INDEX IF EXISTS CREATE INDEX idx_perf_evaluation;
DROP INDEX IF EXISTS CREATE INDEX idx_perf_te;
DROP INDEX IF EXISTS CREATE INDEX idx_perf_te;
DROP INDEX IF EXISTS CREATE INDEX idx_perf_profile;
DROP INDEX IF EXISTS CREATE INDEX idx_perf_profile;
