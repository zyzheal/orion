-- Reverse 601_create_sbom_missing_tables.sql.
-- Order: child tables first (they reference sbom_documents).
DROP TABLE IF EXISTS sbom_attestations;
DROP TABLE IF EXISTS sbom_vulnerabilities;
DROP TABLE IF EXISTS sbom_components;
DROP TABLE IF EXISTS sbom_documents;
