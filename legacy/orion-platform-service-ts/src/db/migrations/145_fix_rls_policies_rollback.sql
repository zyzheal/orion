-- Rollback Migration 145_fix_rls_policies
-- Auto-generated rollback script
-- Review carefully before executing in production

DROP INDEX IF EXISTS idx_plugin_in;
DROP INDEX IF EXISTS idx_execution_timeline;
DROP INDEX IF EXISTS idx_;
DROP INDEX IF EXISTS idx_inline_;
