-- Rollback Migration 175: Drop SubApp Configuration Tables

-- Drop tables in reverse order
DROP TABLE IF EXISTS subapp_config_history;
DROP TABLE IF EXISTS subapp_configs;

-- Update schema migrations
DELETE FROM schema_migrations WHERE version = '175';