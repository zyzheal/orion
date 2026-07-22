-- Rollback Migration 010_create_artifact_registry
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: CREATE TABLE artifact_registry
DROP TABLE IF EXISTS CREATE TABLE artifact_registry CASCADE;

-- Dropping table: CREATE TABLE artifact_tags
DROP TABLE IF EXISTS CREATE TABLE artifact_tags CASCADE;

-- Dropping table: CREATE TABLE artifact_downloads
DROP TABLE IF EXISTS CREATE TABLE artifact_downloads CASCADE;

-- Dropping table: CREATE TABLE artifact_metadata
DROP TABLE IF EXISTS CREATE TABLE artifact_metadata CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_artifact_regi;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_regi;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_regi;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_regi;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_regi;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_tag;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_download;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_metadata_artifact_id ON artifact_metadata(artifact_id);;
