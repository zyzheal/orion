-- Rollback Migration 087_deploy_release_enhancement
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: deploy_windows
DROP TABLE IF EXISTS deploy_windows CASCADE;

-- Dropping table: deploy_emergencies
DROP TABLE IF EXISTS deploy_emergencies CASCADE;

-- Dropping table: deploy_service_dependencies
DROP TABLE IF EXISTS deploy_service_dependencies CASCADE;

-- Dropping table: deploy_progressive_stages
DROP TABLE IF EXISTS deploy_progressive_stages CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_deploy_window;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_window;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_window;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_emergencie;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_emergencie;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_emergencie;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_prog_;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_prog_;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_prog_;
DROP INDEX IF EXISTS CREATE INDEX idx_deploy_prog_;
DROP INDEX IF EXISTS idx_deploy_window;
DROP INDEX IF EXISTS idx_deploy_emergencie;
DROP INDEX IF EXISTS idx_deploy_;
DROP INDEX IF EXISTS idx_deploy_prog_;
