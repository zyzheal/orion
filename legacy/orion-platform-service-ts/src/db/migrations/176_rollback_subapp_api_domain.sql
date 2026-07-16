-- Rollback Migration 176: Remove api_domain from SubApp Configuration

UPDATE subapp_configs SET api_domain = NULL;

ALTER TABLE subapp_configs DROP COLUMN IF EXISTS api_domain;

DELETE FROM schema_migrations WHERE version = '176';
