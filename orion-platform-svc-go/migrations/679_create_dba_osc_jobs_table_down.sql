-- Reverse 679_create_dba_osc_jobs_table.sql.
DROP INDEX IF EXISTS idx_dba_osc_jobs_datasource;
DROP INDEX IF EXISTS idx_dba_osc_jobs_tenant_created;
DROP INDEX IF EXISTS idx_dba_osc_jobs_status;
DROP INDEX IF EXISTS idx_dba_osc_jobs_tenant;
DROP TABLE IF EXISTS dba_osc_jobs;
