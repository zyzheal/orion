-- Rollback Migration 011_create_plugins
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: CREATE TABLE plugins
DROP TABLE IF EXISTS CREATE TABLE plugins CASCADE;

-- Dropping table: CREATE TABLE plugin_tags
DROP TABLE IF EXISTS CREATE TABLE plugin_tags CASCADE;

-- Dropping table: CREATE TABLE plugin_downloads
DROP TABLE IF EXISTS CREATE TABLE plugin_downloads CASCADE;

-- Dropping table: CREATE TABLE plugin_usage_stats
DROP TABLE IF EXISTS CREATE TABLE plugin_usage_stats CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_plugin;
DROP INDEX IF EXISTS CREATE INDEX idx_plugin;
DROP INDEX IF EXISTS CREATE INDEX idx_plugin;
DROP INDEX IF EXISTS CREATE INDEX idx_plugin;
DROP INDEX IF EXISTS CREATE INDEX idx_plugin;
DROP INDEX IF EXISTS CREATE INDEX idx_plugin_tag;
DROP INDEX IF EXISTS CREATE INDEX idx_plugin_download;
DROP INDEX IF EXISTS CREATE INDEX idx_plugin_u;
DROP INDEX IF EXISTS CREATE INDEX idx_plugin_u;
