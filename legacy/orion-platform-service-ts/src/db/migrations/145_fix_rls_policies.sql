-- Migration 145: Fix RLS Policies — FOR ALL + WITH CHECK + System Tenant Bypass
--
-- Issues fixed:
-- 1. Existing policies only have USING (read isolation), no WITH CHECK (write isolation)
--    → INSERT/UPDATE can write to other tenant's data
-- 2. Replace all policies with FOR ALL (covers SELECT, INSERT, UPDATE, DELETE)
-- 3. Add system tenant bypass for background tasks (Cron/EventBus/Saga)
-- 4. Add RLS for migrations 129-132 new tables
--
-- Execution: Run in a single transaction. If any policy fails, all roll back.

BEGIN;

-- ============================================================
-- Step 1: Drop existing policies from migration 073 (12 tables)
-- Policy naming: tenant_isolation_<table>
-- ============================================================

DO $$
DECLARE
    tables_073 text[] := ARRAY[
        'sessions', 'audit_logs', 'deployments', 'pipeline_runs', 'builds',
        'kb_spaces', 'kb_docs', 'knowledge_articles', 'knowledge_categories',
        'agent_runs', 'chatops_messages'
    ];
    tbl text;
    policy_name text;
BEGIN
    FOREACH tbl IN ARRAY tables_073
    LOOP
        policy_name := 'tenant_isolation_' || tbl;
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, tbl);
    END LOOP;
END $$;

-- ============================================================
-- Step 2: Drop existing policies from migration 127 (52 tables)
-- Policy naming: tenant_isolation_policy (same name for all)
-- ============================================================

DO $$
DECLARE
    tables_127 text[] := ARRAY[
        'configs', 'projects', 'pipelines', 'artifacts', 'artifact_registry',
        'environments', 'alerts', 'alert_rules', 'budgets', 'cost_records',
        'notifications', 'notification_channels', 'webhooks', 'api_keys',
        'cron_jobs', 'cron_executions', 'event_bus_events', 'tickets',
        'incidents', 'rollbacks', 'sbom_documents', 'sbom_vulnerabilities',
        'policies', 'policy_evaluations', 'approvals', 'skill_definitions',
        'skill_executions', 'vector_embeddings', 'confirmation_requests',
        'namespace_allocations', 'namespace_pools', 'product_lines',
        'internal_libraries', 'iac_workspaces', 'iac_plans',
        'iac_state_versions', 'oncall_schedules', 'oncall_assignments',
        'oncall_overrides', 'maintenance_windows', 'alert_suppressions',
        'known_issues', 'healing_actions', 'plugin_executions',
        'canary_analysis_runs', 'change_intelligence_records',
        'risk_assessments', 'risk_predictions', 'code_ownership',
        'branch_policies', 'build_cache_entries', 'build_logs'
    ];
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY tables_127
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    END LOOP;
END $$;

-- ============================================================
-- Step 3: Create FOR ALL policies for ALL 64 tables
-- Each policy:
--   - FOR ALL (covers SELECT, INSERT, UPDATE, DELETE)
--   - USING (read/delete isolation)
--   - WITH CHECK (insert/update isolation)
--   - System tenant bypass: __system__ can access all data
-- ============================================================

-- Helper: create FOR ALL policy for a table (tenant_id is UUID type)
DO $$
DECLARE
    all_tables text[] := ARRAY[
        -- Migration 073 tables (12)
        'sessions', 'audit_logs', 'deployments', 'pipeline_runs', 'builds',
        'kb_spaces', 'kb_docs', 'knowledge_articles', 'knowledge_categories',
        'agent_runs', 'chatops_messages',
        -- Migration 127 tables (52)
        'configs', 'projects', 'pipelines', 'artifacts', 'artifact_registry',
        'environments', 'alerts', 'alert_rules', 'budgets', 'cost_records',
        'notifications', 'notification_channels', 'webhooks', 'api_keys',
        'cron_jobs', 'cron_executions', 'event_bus_events', 'tickets',
        'incidents', 'rollbacks', 'sbom_documents', 'sbom_vulnerabilities',
        'policies', 'policy_evaluations', 'approvals', 'skill_definitions',
        'skill_executions', 'vector_embeddings', 'confirmation_requests',
        'namespace_allocations', 'namespace_pools', 'product_lines',
        'internal_libraries', 'iac_workspaces', 'iac_plans',
        'iac_state_versions', 'oncall_schedules', 'oncall_assignments',
        'oncall_overrides', 'maintenance_windows', 'alert_suppressions',
        'known_issues', 'healing_actions', 'plugin_executions',
        'canary_analysis_runs', 'change_intelligence_records',
        'risk_assessments', 'risk_predictions', 'code_ownership',
        'branch_policies', 'build_cache_entries', 'build_logs'
    ];
    tbl text;
    policy_name text;
BEGIN
    FOREACH tbl IN ARRAY all_tables
    LOOP
        policy_name := 'tenant_isolation_' || tbl;

        EXECUTE format(
            'CREATE POLICY %I ON %I FOR ALL
             USING (
                 current_setting(''app.current_tenant_id'', true) = ''__system__''
                 OR (
                     current_setting(''app.current_tenant_id'', true) IS NOT NULL
                     AND current_setting(''app.current_tenant_id'', true) != ''''
                     AND tenant_id::text = current_setting(''app.current_tenant_id'')
                 )
             )
             WITH CHECK (
                 current_setting(''app.current_tenant_id'', true) = ''__system__''
                 OR (
                     current_setting(''app.current_tenant_id'', true) IS NOT NULL
                     AND current_setting(''app.current_tenant_id'', true) != ''''
                     AND tenant_id::text = current_setting(''app.current_tenant_id'')
                 )
             )',
            policy_name, tbl
        );
    END LOOP;
END $$;

-- ============================================================
-- Step 4: Add RLS for migrations 129-132 new tables
-- ============================================================

-- 4.1 plugin_installations (from migration 130)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_installations') THEN
        ALTER TABLE plugin_installations ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plugin_installations FORCE ROW LEVEL SECURITY;
        CREATE POLICY tenant_isolation_plugin_installations ON plugin_installations FOR ALL
            USING (
                current_setting('app.current_tenant_id', true) = '__system__'
                OR (current_setting('app.current_tenant_id', true) IS NOT NULL
                    AND current_setting('app.current_tenant_id', true) != ''
                    AND tenant_id::text = current_setting('app.current_tenant_id'))
            )
            WITH CHECK (
                current_setting('app.current_tenant_id', true) = '__system__'
                OR (current_setting('app.current_tenant_id', true) IS NOT NULL
                    AND current_setting('app.current_tenant_id', true) != ''
                    AND tenant_id::text = current_setting('app.current_tenant_id'))
            );
        CREATE INDEX IF NOT EXISTS idx_plugin_installations_tenant_rls ON plugin_installations(tenant_id);
    END IF;
END $$;

-- 4.2 execution_timelines (from migration 131)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'execution_timelines') THEN
        ALTER TABLE execution_timelines ENABLE ROW LEVEL SECURITY;
        ALTER TABLE execution_timelines FORCE ROW LEVEL SECURITY;
        CREATE POLICY tenant_isolation_execution_timelines ON execution_timelines FOR ALL
            USING (
                current_setting('app.current_tenant_id', true) = '__system__'
                OR (current_setting('app.current_tenant_id', true) IS NOT NULL
                    AND current_setting('app.current_tenant_id', true) != ''
                    AND tenant_id::text = current_setting('app.current_tenant_id'))
            )
            WITH CHECK (
                current_setting('app.current_tenant_id', true) = '__system__'
                OR (current_setting('app.current_tenant_id', true) IS NOT NULL
                    AND current_setting('app.current_tenant_id', true) != ''
                    AND tenant_id::text = current_setting('app.current_tenant_id'))
            );
        CREATE INDEX IF NOT EXISTS idx_execution_timelines_tenant_rls ON execution_timelines(tenant_id);
    END IF;
END $$;

-- 4.3 secrets (from migration 132 — already has RLS, replace with FOR ALL)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'secrets') THEN
        DROP POLICY IF EXISTS secrets_tenant_isolation ON secrets;
        ALTER TABLE secrets FORCE ROW LEVEL SECURITY;
        CREATE POLICY tenant_isolation_secrets ON secrets FOR ALL
            USING (
                current_setting('app.current_tenant_id', true) = '__system__'
                OR (current_setting('app.current_tenant_id', true) IS NOT NULL
                    AND current_setting('app.current_tenant_id', true) != ''
                    AND tenant_id = current_setting('app.current_tenant_id'))
            )
            WITH CHECK (
                current_setting('app.current_tenant_id', true) = '__system__'
                OR (current_setting('app.current_tenant_id', true) IS NOT NULL
                    AND current_setting('app.current_tenant_id', true) != ''
                    AND tenant_id = current_setting('app.current_tenant_id'))
            );
        CREATE INDEX IF NOT EXISTS idx_secrets_tenant_rls ON secrets(tenant_id);
    END IF;
END $$;

-- 4.4 inline_script_approvals (from migration 129)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inline_script_approvals') THEN
        ALTER TABLE inline_script_approvals ENABLE ROW LEVEL SECURITY;
        ALTER TABLE inline_script_approvals FORCE ROW LEVEL SECURITY;
        CREATE POLICY tenant_isolation_inline_script_approvals ON inline_script_approvals FOR ALL
            USING (
                current_setting('app.current_tenant_id', true) = '__system__'
                OR (current_setting('app.current_tenant_id', true) IS NOT NULL
                    AND current_setting('app.current_tenant_id', true) != ''
                    AND tenant_id::text = current_setting('app.current_tenant_id'))
            )
            WITH CHECK (
                current_setting('app.current_tenant_id', true) = '__system__'
                OR (current_setting('app.current_tenant_id', true) IS NOT NULL
                    AND current_setting('app.current_tenant_id', true) != ''
                    AND tenant_id::text = current_setting('app.current_tenant_id'))
            );
        CREATE INDEX IF NOT EXISTS idx_inline_script_approvals_tenant_rls ON inline_script_approvals(tenant_id);
    END IF;
END $$;

-- ============================================================
-- Done
-- ============================================================

COMMIT;
