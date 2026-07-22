-- Rollback Migration 015_create_backups
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: backup_configs
DROP TABLE IF EXISTS backup_configs CASCADE;

-- Dropping table: backup_jobs
DROP TABLE IF EXISTS backup_jobs CASCADE;

-- Dropping table: backup_restores
DROP TABLE IF EXISTS backup_restores CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_backup_config;
DROP INDEX IF EXISTS CREATE INDEX idx_backup_job;
DROP INDEX IF EXISTS CREATE INDEX idx_backup_job;
