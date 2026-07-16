-- Rollback Migration 073_enable_rls_policies
-- Auto-generated rollback script
-- Review carefully before executing in production

DROP INDEX IF EXISTS idx_;
DROP INDEX IF EXISTS idx_audit_log;
DROP INDEX IF EXISTS idx_deployment;
DROP INDEX IF EXISTS idx_pipeline_run;
DROP INDEX IF EXISTS idx_build_env;
DROP INDEX IF EXISTS idx_build;
DROP INDEX IF EXISTS idx_kb_;
DROP INDEX IF EXISTS idx_kb_doc;
DROP INDEX IF EXISTS idx_knowledge_article;
DROP INDEX IF EXISTS idx_knowledge_categorie;
DROP INDEX IF EXISTS idx_agent_run;
DROP INDEX IF EXISTS idx_chatop;
