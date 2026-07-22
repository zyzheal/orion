-- Rollback Migration 130: Drop plugin_installations tables

DROP TABLE IF EXISTS plugin_versions CASCADE;
DROP TABLE IF EXISTS plugin_installations CASCADE;
