-- Rollback Migration 030_create_skill_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: skill_packages
DROP TABLE IF EXISTS skill_packages CASCADE;

-- Dropping table: skill_versions
DROP TABLE IF EXISTS skill_versions CASCADE;

-- Dropping table: skill_reviews
DROP TABLE IF EXISTS skill_reviews CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
