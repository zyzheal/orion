-- Reverse 682_create_dba_approval_tables.sql.
-- Order: child tables first (records reference instances, instances reference workflows).
DROP INDEX IF EXISTS idx_dba_approval_records_instance;
DROP TABLE IF EXISTS dba_approval_records;
DROP INDEX IF EXISTS idx_dba_approval_instances_tenant;
DROP INDEX IF EXISTS idx_dba_approval_instances_order;
DROP TABLE IF EXISTS dba_approval_instances;
DROP INDEX IF EXISTS idx_dba_approval_workflows_tenant;
DROP TABLE IF EXISTS dba_approval_workflows;
