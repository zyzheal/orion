-- Reverse 681_create_dba_slowquery_records_table.sql.
DROP INDEX IF EXISTS idx_dba_slowquery_tenant;
DROP INDEX IF EXISTS idx_dba_slowquery_collected_at;
DROP INDEX IF EXISTS idx_dba_slowquery_ds_time;
DROP INDEX IF EXISTS idx_dba_slowquery_ds_hash;
DROP TABLE IF EXISTS dba_slowquery_records;
