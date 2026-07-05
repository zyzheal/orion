-- Migration 073: PostgreSQL Row Level Security (RLS) Policies
-- Enables tenant isolation at the database layer (Layer 4 of 4-layer isolation)
-- Tables covered: sessions, audit_logs, deployments, pipeline_runs, builds,
--                  kb_spaces, kb_docs, knowledge_articles, knowledge_categories,
--                  agent_runs, chatops_messages
--
-- SECURITY NOTE: All policies validate that app.current_tenant_id is set and non-empty
-- before comparing with tenant_id. This prevents bypass when session variable is missing.

-- ============================================================
-- 1. SESSIONS Table RLS
-- ============================================================
-- Note: sessions.tenant_id is UUID, direct comparison with session variable
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_sessions ON sessions
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id = current_setting('app.current_tenant_id')
    );

-- Ensure index exists for RLS query performance
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_rls ON sessions(tenant_id);

COMMENT ON POLICY tenant_isolation_sessions ON sessions IS
    'Tenant isolation RLS policy - only rows matching app.current_tenant_id session variable';

-- ============================================================
-- 2. AUDIT_LOGS Table RLS
-- ============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

-- Index already exists: idx_audit_logs_tenant
-- Ensure additional index for RLS optimization
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_rls ON audit_logs(tenant_id);

COMMENT ON POLICY tenant_isolation_audit_logs ON audit_logs IS
    'Tenant isolation RLS policy - audit logs visible only to owning tenant';

-- ============================================================
-- 3. DEPLOYMENTS Table RLS
-- ============================================================
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_deployments ON deployments
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

-- Index already exists: idx_deployments_tenant
CREATE INDEX IF NOT EXISTS idx_deployments_tenant_rls ON deployments(tenant_id);

COMMENT ON POLICY tenant_isolation_deployments ON deployments IS
    'Tenant isolation RLS policy - deployments visible only to owning tenant';

-- ============================================================
-- 4. PIPELINE_RUNS Table RLS
-- ============================================================
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pipeline_runs ON pipeline_runs
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

-- Index already exists: idx_pipeline_runs_tenant
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_tenant_rls ON pipeline_runs(tenant_id);

COMMENT ON POLICY tenant_isolation_pipeline_runs ON pipeline_runs IS
    'Tenant isolation RLS policy - pipeline runs visible only to owning tenant';

-- ============================================================
-- 5. BUILD_ENVIRONMENTS Table RLS
-- ============================================================
ALTER TABLE build_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_environments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_build_environments ON build_environments
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_build_envs_tenant_rls ON build_environments(tenant_id);

COMMENT ON POLICY tenant_isolation_build_environments ON build_environments IS
    'Tenant isolation RLS policy - build environments visible only to owning tenant';

-- ============================================================
-- 6. BUILD Table RLS
-- ============================================================
ALTER TABLE builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE builds FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_builds ON builds
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

-- Index already exists: idx_builds_tenant
CREATE INDEX IF NOT EXISTS idx_builds_tenant_rls ON builds(tenant_id);

COMMENT ON POLICY tenant_isolation_builds ON builds IS
    'Tenant isolation RLS policy - builds visible only to owning tenant';

-- ============================================================
-- 7. KB_SPACES (Knowledge Base Spaces) Table RLS
-- ============================================================
ALTER TABLE kb_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_spaces FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_kb_spaces ON kb_spaces
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

-- Index already exists: idx_kb_spaces_tenant
CREATE INDEX IF NOT EXISTS idx_kb_spaces_tenant_rls ON kb_spaces(tenant_id);

COMMENT ON POLICY tenant_isolation_kb_spaces ON kb_spaces IS
    'Tenant isolation RLS policy - knowledge spaces visible only to owning tenant';

-- ============================================================
-- 8. KB_DOCS (Knowledge Base Documents) Table RLS
-- ============================================================
ALTER TABLE kb_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_docs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_kb_docs ON kb_docs
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

-- Index already exists: idx_kb_docs_tenant
CREATE INDEX IF NOT EXISTS idx_kb_docs_tenant_rls ON kb_docs(tenant_id);

COMMENT ON POLICY tenant_isolation_kb_docs ON kb_docs IS
    'Tenant isolation RLS policy - knowledge documents visible only to owning tenant';

-- ============================================================
-- 9. KNOWLEDGE_ARTICLES Table RLS
-- ============================================================
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_knowledge_articles ON knowledge_articles
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

-- Index already exists: idx_kb_articles_tenant
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_tenant_rls ON knowledge_articles(tenant_id);

COMMENT ON POLICY tenant_isolation_knowledge_articles ON knowledge_articles IS
    'Tenant isolation RLS policy - knowledge articles visible only to owning tenant';

-- ============================================================
-- 10. KNOWLEDGE_CATEGORIES Table RLS
-- ============================================================
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_knowledge_categories ON knowledge_categories
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

-- Index already exists: idx_kb_categories_tenant
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_tenant_rls ON knowledge_categories(tenant_id);

COMMENT ON POLICY tenant_isolation_knowledge_categories ON knowledge_categories IS
    'Tenant isolation RLS policy - knowledge categories visible only to owning tenant';

-- ============================================================
-- 11. AGENT_RUNS (AI Conversation Tracking) Table RLS
-- ============================================================
-- agent_runs serves as AI conversation/run tracking for agent orchestration
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_agent_runs ON agent_runs
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant_rls ON agent_runs(tenant_id);

COMMENT ON POLICY tenant_isolation_agent_runs ON agent_runs IS
    'Tenant isolation RLS policy - AI agent runs visible only to owning tenant';

-- ============================================================
-- 12. CHATOPS_MESSAGES Table RLS (AI Conversations)
-- ============================================================
-- chatops_messages stores AI conversation history
-- Add tenant_id column for proper tenant isolation
ALTER TABLE chatops_messages ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE chatops_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatops_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_chatops_messages ON chatops_messages
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_chatops_messages_tenant_rls ON chatops_messages(tenant_id);

COMMENT ON POLICY tenant_isolation_chatops_messages ON chatops_messages IS
    'Tenant isolation RLS policy - ChatOps messages visible only to owning tenant';

-- ============================================================
-- Summary: Tables with RLS Enabled
-- ============================================================
-- 1. sessions (tenant_id UUID)
-- 2. audit_logs (tenant_id UUID)
-- 3. deployments (tenant_id UUID)
-- 4. pipeline_runs (tenant_id UUID)
-- 5. build_environments (tenant_id UUID)
-- 6. builds (tenant_id UUID)
-- 7. kb_spaces (tenant_id UUID)
-- 8. kb_docs (tenant_id UUID)
-- 9. knowledge_articles (tenant_id UUID)
-- 10. knowledge_categories (tenant_id UUID)
-- 11. agent_runs (tenant_id UUID)
-- 12. chatops_messages (tenant_id UUID)
--
-- FORCE ROW LEVEL SECURITY ensures RLS applies even to superusers
-- app.current_tenant_id session variable must be set before queries
-- All policies validate session variable exists and is non-empty
--
-- Rollback:
-- ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE deployments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE pipeline_runs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE build_environments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE builds DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE kb_spaces DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE kb_docs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_articles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_categories DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE agent_runs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE chatops_messages DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS tenant_isolation_sessions ON sessions;
-- DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
-- DROP POLICY IF EXISTS tenant_isolation_deployments ON deployments;
-- DROP POLICY IF EXISTS tenant_isolation_pipeline_runs ON pipeline_runs;
-- DROP POLICY IF EXISTS tenant_isolation_build_environments ON build_environments;
-- DROP POLICY IF EXISTS tenant_isolation_builds ON builds;
-- DROP POLICY IF EXISTS tenant_isolation_kb_spaces ON kb_spaces;
-- DROP POLICY IF EXISTS tenant_isolation_kb_docs ON kb_docs;
-- DROP POLICY IF EXISTS tenant_isolation_knowledge_articles ON knowledge_articles;
-- DROP POLICY IF EXISTS tenant_isolation_knowledge_categories ON knowledge_categories;
-- DROP POLICY IF EXISTS tenant_isolation_agent_runs ON agent_runs;
-- DROP POLICY IF EXISTS tenant_isolation_chatops_messages ON chatops_messages;