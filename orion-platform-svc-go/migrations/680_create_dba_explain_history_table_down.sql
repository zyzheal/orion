-- Reverse 680_create_dba_explain_history_table.sql.
DROP INDEX IF EXISTS idx_dba_explain_ds_created;
DROP INDEX IF EXISTS idx_dba_explain_tenant_created;
DROP TABLE IF EXISTS dba_explain_history;
