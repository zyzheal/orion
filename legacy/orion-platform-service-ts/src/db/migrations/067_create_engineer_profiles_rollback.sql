-- Rollback Migration 067_create_engineer_profiles
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: engineer_profiles
DROP TABLE IF EXISTS engineer_profiles CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_engineer_profile;
DROP INDEX IF EXISTS CREATE INDEX idx_engineer_profile;
