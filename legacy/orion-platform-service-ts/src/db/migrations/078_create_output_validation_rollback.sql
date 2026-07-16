-- Rollback Migration 078_create_output_validation
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: output_validation_rules
DROP TABLE IF EXISTS output_validation_rules CASCADE;

-- Dropping table: output_validation_results
DROP TABLE IF EXISTS output_validation_results CASCADE;

-- Dropping table: security_boundary_patterns
DROP TABLE IF EXISTS security_boundary_patterns CASCADE;

-- Dropping table: patch_schemas
DROP TABLE IF EXISTS patch_schemas CASCADE;

-- Dropping table: output_validation_stats
DROP TABLE IF EXISTS output_validation_stats CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_output_validation_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_output_validation_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_output_validation_re;
DROP INDEX IF EXISTS CREATE INDEX idx_output_validation_re;
DROP INDEX IF EXISTS CREATE INDEX idx_output_validation_re;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_patch_;
DROP INDEX IF EXISTS CREATE INDEX idx_patch_;
DROP INDEX IF EXISTS CREATE INDEX idx_output_validation_;
