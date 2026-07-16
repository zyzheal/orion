-- Rollback Migration 026_create_sbom_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: sbom_documents
DROP TABLE IF EXISTS sbom_documents CASCADE;

-- Dropping table: sbom_packages
DROP TABLE IF EXISTS sbom_packages CASCADE;

-- Dropping table: sbom_attestations
DROP TABLE IF EXISTS sbom_attestations CASCADE;

-- Dropping table: sbom_vulnerability_results
DROP TABLE IF EXISTS sbom_vulnerability_results CASCADE;

-- Dropping table: sbom_waivers
DROP TABLE IF EXISTS sbom_waivers CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
