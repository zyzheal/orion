-- Rollback: Migration 364
DROP INDEX IF EXISTS idx_config_metadata_sensitivity;
DROP INDEX IF EXISTS idx_config_metadata_key;
DROP INDEX IF EXISTS idx_config_metadata_domain;
DROP TABLE IF EXISTS config_metadata;
