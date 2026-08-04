-- Auto-generated rollback for version 258. Review before use.
DROP INDEX IF EXISTS idx_pss_created;
DROP INDEX IF EXISTS idx_pss_tenant;
DROP INDEX IF EXISTS idx_psc_tenant;
DROP TABLE IF EXISTS prompt_security_scans CASCADE;
DROP TABLE IF EXISTS prompt_security_configs CASCADE;
