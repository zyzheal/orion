-- Rollback Migration 026: Drop SBOM Attestation tables
DROP TABLE IF EXISTS sbom_waivers CASCADE;
DROP TABLE IF EXISTS sbom_vulnerability_results CASCADE;
DROP TABLE IF EXISTS sbom_attestations CASCADE;
DROP TABLE IF EXISTS sbom_packages CASCADE;
DROP TABLE IF EXISTS sbom_documents CASCADE;
