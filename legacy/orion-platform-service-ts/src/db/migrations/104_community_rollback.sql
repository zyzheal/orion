-- Rollback Migration 104_community
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: community_contributors
DROP TABLE IF EXISTS community_contributors CASCADE;

-- Dropping table: community_plugins
DROP TABLE IF EXISTS community_plugins CASCADE;

-- Dropping table: community_discussions
DROP TABLE IF EXISTS community_discussions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_community_contributor;
DROP INDEX IF EXISTS CREATE INDEX idx_community_contributor;
DROP INDEX IF EXISTS CREATE INDEX idx_community_contributor;
DROP INDEX IF EXISTS CREATE INDEX idx_community_contributor;
DROP INDEX IF EXISTS CREATE INDEX idx_community_plugin;
DROP INDEX IF EXISTS CREATE INDEX idx_community_plugin;
DROP INDEX IF EXISTS CREATE INDEX idx_community_plugin;
DROP INDEX IF EXISTS CREATE INDEX idx_community_plugin;
DROP INDEX IF EXISTS CREATE INDEX idx_community_plugin;
DROP INDEX IF EXISTS CREATE INDEX idx_community_di;
DROP INDEX IF EXISTS CREATE INDEX idx_community_di;
DROP INDEX IF EXISTS CREATE INDEX idx_community_di;
DROP INDEX IF EXISTS CREATE INDEX idx_community_di;
DROP INDEX IF EXISTS CREATE INDEX idx_community_di;
