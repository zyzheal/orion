-- Rollback Migration 419: Drop DBA query execution audit log table

DROP TABLE IF EXISTS dba_query_audit_log;
