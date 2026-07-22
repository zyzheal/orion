-- Rollback Migration 099_performance_engineering
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: performance_baselines
DROP TABLE IF EXISTS performance_baselines CASCADE;

-- Dropping table: performance_profiles
DROP TABLE IF EXISTS performance_profiles CASCADE;

-- Dropping table: optimization_recommendations
DROP TABLE IF EXISTS optimization_recommendations CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_performance_ba;
DROP INDEX IF EXISTS CREATE INDEX idx_performance_ba;
DROP INDEX IF EXISTS CREATE INDEX idx_performance_ba;
DROP INDEX IF EXISTS CREATE INDEX idx_performance_ba;
DROP INDEX IF EXISTS CREATE INDEX idx_performance_profile;
DROP INDEX IF EXISTS CREATE INDEX idx_performance_profile;
DROP INDEX IF EXISTS CREATE INDEX idx_performance_profile;
DROP INDEX IF EXISTS CREATE INDEX idx_performance_profile;
DROP INDEX IF EXISTS CREATE INDEX idx_optimization_recommendation;
DROP INDEX IF EXISTS CREATE INDEX idx_optimization_recommendation;
DROP INDEX IF EXISTS CREATE INDEX idx_optimization_recommendation;
DROP INDEX IF EXISTS CREATE INDEX idx_optimization_recommendation;
