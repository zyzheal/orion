-- ============================================================================
-- Rollback: Task 2.14 DBA Direct Query Execution - Saved Queries Table
-- ============================================================================

DROP TRIGGER IF EXISTS trg_dba_saved_queries_updated_at ON dba_saved_queries;
DROP FUNCTION IF EXISTS update_dba_saved_queries_updated_at;

DROP INDEX IF EXISTS uq_dba_saved_queries_tenant_user_name;
DROP INDEX IF EXISTS idx_dba_saved_queries_updated;
DROP INDEX IF EXISTS idx_dba_saved_queries_tenant_user;
DROP INDEX IF EXISTS idx_dba_saved_queries_tenant_id;

DROP TABLE IF EXISTS dba_saved_queries;
