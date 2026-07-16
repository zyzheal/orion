-- Migration 126: Enable RLS for Remaining Tables
-- Covers 51 tables declared in RLSPolicyManager.RLS_TABLES that were not
-- included in migration 073. All tables with tenant_id now have database-level
-- tenant isolation.
--
-- Tables covered:
-- configs, projects, pipelines, artifacts, artifact_registry, environments,
-- alerts, alert_rules, budgets, cost_records, notifications,
-- notification_channels, webhooks, api_keys, cron_jobs, cron_executions,
-- event_bus_events, tickets, incidents, rollbacks, sbom_documents,
-- sbom_vulnerabilities, policies, policy_evaluations, approvals,
-- skill_definitions, skill_executions, vector_embeddings,
-- confirmation_requests, namespace_allocations, namespace_pools,
-- product_lines, internal_libraries, iac_workspaces, iac_plans,
-- iac_state_versions, oncall_schedules, oncall_assignments, oncall_overrides,
-- maintenance_windows, alert_suppressions, known_issues, healing_actions,
-- plugin_executions, canary_analysis_runs, change_intelligence_records,
-- risk_assessments, risk_predictions, code_ownership, branch_policies,
-- build_cache_entries, build_logs
--
-- SECURITY NOTE: All policies validate that app.current_tenant_id is set and non-empty
-- before comparing with tenant_id. This prevents bypass when session variable is missing.

-- ============================================================
-- 1. CONFIGS Table RLS
-- ============================================================
ALTER TABLE configs ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE configs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON configs;
CREATE POLICY tenant_isolation_policy ON configs
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_configs_tenant_rls ON configs(tenant_id);

-- ============================================================
-- 2. PROJECTS Table RLS
-- ============================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON projects;
CREATE POLICY tenant_isolation_policy ON projects
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_projects_tenant_rls ON projects(tenant_id);

-- ============================================================
-- 3. PIPELINES Table RLS
-- ============================================================
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON pipelines;
CREATE POLICY tenant_isolation_policy ON pipelines
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_pipelines_tenant_rls ON pipelines(tenant_id);

-- ============================================================
-- 4. ARTIFACTS Table RLS
-- ============================================================
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON artifacts;
CREATE POLICY tenant_isolation_policy ON artifacts
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_rls ON artifacts(tenant_id);

-- ============================================================
-- 5. ARTIFACT_REGISTRY Table RLS
-- ============================================================
ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE artifact_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_registry FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON artifact_registry;
CREATE POLICY tenant_isolation_policy ON artifact_registry
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_artifact_registry_tenant_rls ON artifact_registry(tenant_id);

-- ============================================================
-- 6. ENVIRONMENTS Table RLS
-- ============================================================
ALTER TABLE environments ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON environments;
CREATE POLICY tenant_isolation_policy ON environments
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_environments_tenant_rls ON environments(tenant_id);

-- ============================================================
-- 7. ALERTS Table RLS
-- ============================================================
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON alerts;
CREATE POLICY tenant_isolation_policy ON alerts
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_rls ON alerts(tenant_id);

-- ============================================================
-- 8. ALERT_RULES Table RLS
-- ============================================================
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON alert_rules;
CREATE POLICY tenant_isolation_policy ON alert_rules
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant_rls ON alert_rules(tenant_id);

-- ============================================================
-- 9. BUDGETS Table RLS
-- ============================================================
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON budgets;
CREATE POLICY tenant_isolation_policy ON budgets
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_budgets_tenant_rls ON budgets(tenant_id);

-- ============================================================
-- 10. COST_RECORDS Table RLS
-- ============================================================
ALTER TABLE cost_records ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON cost_records;
CREATE POLICY tenant_isolation_policy ON cost_records
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_cost_records_tenant_rls ON cost_records(tenant_id);

-- ============================================================
-- 11. NOTIFICATIONS Table RLS
-- ============================================================
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON notifications;
CREATE POLICY tenant_isolation_policy ON notifications
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_rls ON notifications(tenant_id);

-- ============================================================
-- 12. NOTIFICATION_CHANNELS Table RLS
-- ============================================================
ALTER TABLE notification_channels ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON notification_channels;
CREATE POLICY tenant_isolation_policy ON notification_channels
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant_rls ON notification_channels(tenant_id);

-- ============================================================
-- 13. WEBHOOKS Table RLS
-- ============================================================
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON webhooks;
CREATE POLICY tenant_isolation_policy ON webhooks
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_rls ON webhooks(tenant_id);

-- ============================================================
-- 14. API_KEYS Table RLS
-- ============================================================
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON api_keys;
CREATE POLICY tenant_isolation_policy ON api_keys
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_rls ON api_keys(tenant_id);

-- ============================================================
-- 15. CRON_JOBS Table RLS
-- ============================================================
ALTER TABLE cron_jobs ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE cron_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON cron_jobs;
CREATE POLICY tenant_isolation_policy ON cron_jobs
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_cron_jobs_tenant_rls ON cron_jobs(tenant_id);

-- ============================================================
-- 16. CRON_EXECUTIONS Table RLS
-- ============================================================
ALTER TABLE cron_executions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE cron_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_executions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON cron_executions;
CREATE POLICY tenant_isolation_policy ON cron_executions
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_cron_executions_tenant_rls ON cron_executions(tenant_id);

-- ============================================================
-- 17. EVENT_BUS_EVENTS Table RLS
-- ============================================================
ALTER TABLE event_bus_events ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE event_bus_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_bus_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON event_bus_events;
CREATE POLICY tenant_isolation_policy ON event_bus_events
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_event_bus_events_tenant_rls ON event_bus_events(tenant_id);

-- ============================================================
-- 18. TICKETS Table RLS
-- ============================================================
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON tickets;
CREATE POLICY tenant_isolation_policy ON tickets
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_rls ON tickets(tenant_id);

-- ============================================================
-- 19. INCIDENTS Table RLS
-- ============================================================
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON incidents;
CREATE POLICY tenant_isolation_policy ON incidents
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_incidents_tenant_rls ON incidents(tenant_id);

-- ============================================================
-- 20. ROLLBACKS Table RLS
-- ============================================================
ALTER TABLE rollbacks ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE rollbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollbacks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON rollbacks;
CREATE POLICY tenant_isolation_policy ON rollbacks
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_rollbacks_tenant_rls ON rollbacks(tenant_id);

-- ============================================================
-- 21. SBOM_DOCUMENTS Table RLS
-- ============================================================
ALTER TABLE sbom_documents ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE sbom_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sbom_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON sbom_documents;
CREATE POLICY tenant_isolation_policy ON sbom_documents
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_sbom_documents_tenant_rls ON sbom_documents(tenant_id);

-- ============================================================
-- 22. SBOM_VULNERABILITIES Table RLS
-- ============================================================
ALTER TABLE sbom_vulnerabilities ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE sbom_vulnerabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sbom_vulnerabilities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON sbom_vulnerabilities;
CREATE POLICY tenant_isolation_policy ON sbom_vulnerabilities
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_sbom_vulnerabilities_tenant_rls ON sbom_vulnerabilities(tenant_id);

-- ============================================================
-- 23. POLICIES Table RLS
-- ============================================================
ALTER TABLE policies ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON policies;
CREATE POLICY tenant_isolation_policy ON policies
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_policies_tenant_rls ON policies(tenant_id);

-- ============================================================
-- 24. POLICY_EVALUATIONS Table RLS
-- ============================================================
ALTER TABLE policy_evaluations ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE policy_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_evaluations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON policy_evaluations;
CREATE POLICY tenant_isolation_policy ON policy_evaluations
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_policy_evaluations_tenant_rls ON policy_evaluations(tenant_id);

-- ============================================================
-- 25. APPROVALS Table RLS
-- ============================================================
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON approvals;
CREATE POLICY tenant_isolation_policy ON approvals
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_approvals_tenant_rls ON approvals(tenant_id);

-- ============================================================
-- 26. SKILL_DEFINITIONS Table RLS
-- ============================================================
ALTER TABLE skill_definitions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE skill_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_definitions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON skill_definitions;
CREATE POLICY tenant_isolation_policy ON skill_definitions
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_skill_definitions_tenant_rls ON skill_definitions(tenant_id);

-- ============================================================
-- 27. SKILL_EXECUTIONS Table RLS
-- ============================================================
ALTER TABLE skill_executions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE skill_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_executions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON skill_executions;
CREATE POLICY tenant_isolation_policy ON skill_executions
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_skill_executions_tenant_rls ON skill_executions(tenant_id);

-- ============================================================
-- 28. VECTOR_EMBEDDINGS Table RLS
-- ============================================================
ALTER TABLE vector_embeddings ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE vector_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_embeddings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON vector_embeddings;
CREATE POLICY tenant_isolation_policy ON vector_embeddings
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_vector_embeddings_tenant_rls ON vector_embeddings(tenant_id);

-- ============================================================
-- 29. CONFIRMATION_REQUESTS Table RLS
-- ============================================================
ALTER TABLE confirmation_requests ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE confirmation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmation_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON confirmation_requests;
CREATE POLICY tenant_isolation_policy ON confirmation_requests
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_confirmation_requests_tenant_rls ON confirmation_requests(tenant_id);

-- ============================================================
-- 30. NAMESPACE_ALLOCATIONS Table RLS
-- ============================================================
ALTER TABLE namespace_allocations ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE namespace_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE namespace_allocations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON namespace_allocations;
CREATE POLICY tenant_isolation_policy ON namespace_allocations
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_namespace_allocations_tenant_rls ON namespace_allocations(tenant_id);

-- ============================================================
-- 31. NAMESPACE_POOLS Table RLS
-- ============================================================
ALTER TABLE namespace_pools ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE namespace_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE namespace_pools FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON namespace_pools;
CREATE POLICY tenant_isolation_policy ON namespace_pools
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_namespace_pools_tenant_rls ON namespace_pools(tenant_id);

-- ============================================================
-- 32. PRODUCT_LINES Table RLS
-- ============================================================
ALTER TABLE product_lines ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE product_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON product_lines;
CREATE POLICY tenant_isolation_policy ON product_lines
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_product_lines_tenant_rls ON product_lines(tenant_id);

-- ============================================================
-- 33. INTERNAL_LIBRARIES Table RLS
-- ============================================================
ALTER TABLE internal_libraries ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE internal_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_libraries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON internal_libraries;
CREATE POLICY tenant_isolation_policy ON internal_libraries
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_internal_libraries_tenant_rls ON internal_libraries(tenant_id);

-- ============================================================
-- 34. IAC_WORKSPACES Table RLS
-- ============================================================
ALTER TABLE iac_workspaces ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE iac_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE iac_workspaces FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON iac_workspaces;
CREATE POLICY tenant_isolation_policy ON iac_workspaces
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_iac_workspaces_tenant_rls ON iac_workspaces(tenant_id);

-- ============================================================
-- 35. IAC_PLANS Table RLS
-- ============================================================
ALTER TABLE iac_plans ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE iac_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE iac_plans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON iac_plans;
CREATE POLICY tenant_isolation_policy ON iac_plans
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_iac_plans_tenant_rls ON iac_plans(tenant_id);

-- ============================================================
-- 36. IAC_STATE_VERSIONS Table RLS
-- ============================================================
ALTER TABLE iac_state_versions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE iac_state_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iac_state_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON iac_state_versions;
CREATE POLICY tenant_isolation_policy ON iac_state_versions
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_iac_state_versions_tenant_rls ON iac_state_versions(tenant_id);

-- ============================================================
-- 37. ONCALL_SCHEDULES Table RLS
-- ============================================================
ALTER TABLE oncall_schedules ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE oncall_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE oncall_schedules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON oncall_schedules;
CREATE POLICY tenant_isolation_policy ON oncall_schedules
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_oncall_schedules_tenant_rls ON oncall_schedules(tenant_id);

-- ============================================================
-- 38. ONCALL_ASSIGNMENTS Table RLS
-- ============================================================
ALTER TABLE oncall_assignments ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE oncall_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE oncall_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON oncall_assignments;
CREATE POLICY tenant_isolation_policy ON oncall_assignments
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_oncall_assignments_tenant_rls ON oncall_assignments(tenant_id);

-- ============================================================
-- 39. ONCALL_OVERRIDES Table RLS
-- ============================================================
ALTER TABLE oncall_overrides ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE oncall_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE oncall_overrides FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON oncall_overrides;
CREATE POLICY tenant_isolation_policy ON oncall_overrides
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_oncall_overrides_tenant_rls ON oncall_overrides(tenant_id);

-- ============================================================
-- 40. MAINTENANCE_WINDOWS Table RLS
-- ============================================================
ALTER TABLE maintenance_windows ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE maintenance_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_windows FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON maintenance_windows;
CREATE POLICY tenant_isolation_policy ON maintenance_windows
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_tenant_rls ON maintenance_windows(tenant_id);

-- ============================================================
-- 41. ALERT_SUPPRESSIONS Table RLS
-- ============================================================
ALTER TABLE alert_suppressions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE alert_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_suppressions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON alert_suppressions;
CREATE POLICY tenant_isolation_policy ON alert_suppressions
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_alert_suppressions_tenant_rls ON alert_suppressions(tenant_id);

-- ============================================================
-- 42. KNOWN_ISSUES Table RLS
-- ============================================================
ALTER TABLE known_issues ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE known_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_issues FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON known_issues;
CREATE POLICY tenant_isolation_policy ON known_issues
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_known_issues_tenant_rls ON known_issues(tenant_id);

-- ============================================================
-- 43. HEALING_ACTIONS Table RLS
-- ============================================================
ALTER TABLE healing_actions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE healing_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE healing_actions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON healing_actions;
CREATE POLICY tenant_isolation_policy ON healing_actions
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_healing_actions_tenant_rls ON healing_actions(tenant_id);

-- ============================================================
-- 44. PLUGIN_EXECUTIONS Table RLS
-- ============================================================
ALTER TABLE plugin_executions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE plugin_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_executions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON plugin_executions;
CREATE POLICY tenant_isolation_policy ON plugin_executions
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_plugin_executions_tenant_rls ON plugin_executions(tenant_id);

-- ============================================================
-- 45. CANARY_ANALYSIS_RUNS Table RLS
-- ============================================================
ALTER TABLE canary_analysis_runs ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE canary_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE canary_analysis_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON canary_analysis_runs;
CREATE POLICY tenant_isolation_policy ON canary_analysis_runs
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_canary_analysis_runs_tenant_rls ON canary_analysis_runs(tenant_id);

-- ============================================================
-- 46. CHANGE_INTELLIGENCE_RECORDS Table RLS
-- ============================================================
ALTER TABLE change_intelligence_records ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE change_intelligence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_intelligence_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON change_intelligence_records;
CREATE POLICY tenant_isolation_policy ON change_intelligence_records
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_change_intelligence_records_tenant_rls ON change_intelligence_records(tenant_id);

-- ============================================================
-- 47. RISK_ASSESSMENTS Table RLS
-- ============================================================
ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON risk_assessments;
CREATE POLICY tenant_isolation_policy ON risk_assessments
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_risk_assessments_tenant_rls ON risk_assessments(tenant_id);

-- ============================================================
-- 48. RISK_PREDICTIONS Table RLS
-- ============================================================
ALTER TABLE risk_predictions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE risk_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_predictions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON risk_predictions;
CREATE POLICY tenant_isolation_policy ON risk_predictions
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_risk_predictions_tenant_rls ON risk_predictions(tenant_id);

-- ============================================================
-- 49. CODE_OWNERSHIP Table RLS
-- ============================================================
ALTER TABLE code_ownership ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE code_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_ownership FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON code_ownership;
CREATE POLICY tenant_isolation_policy ON code_ownership
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_code_ownership_tenant_rls ON code_ownership(tenant_id);

-- ============================================================
-- 50. BRANCH_POLICIES Table RLS
-- ============================================================
ALTER TABLE branch_policies ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE branch_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_policies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON branch_policies;
CREATE POLICY tenant_isolation_policy ON branch_policies
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_branch_policies_tenant_rls ON branch_policies(tenant_id);

-- ============================================================
-- 51. BUILD_CACHE_ENTRIES Table RLS
-- ============================================================
ALTER TABLE build_cache_entries ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE build_cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_cache_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON build_cache_entries;
CREATE POLICY tenant_isolation_policy ON build_cache_entries
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_build_cache_entries_tenant_rls ON build_cache_entries(tenant_id);

-- ============================================================
-- 52. BUILD_LOGS Table RLS
-- ============================================================
ALTER TABLE build_logs ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE build_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON build_logs;
CREATE POLICY tenant_isolation_policy ON build_logs
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_build_logs_tenant_rls ON build_logs(tenant_id);

-- ============================================================
-- Summary: Tables with RLS Enabled (Migration 126)
-- ============================================================
-- 1. configs
-- 2. projects
-- 3. pipelines
-- 4. artifacts
-- 5. artifact_registry
-- 6. environments
-- 7. alerts
-- 8. alert_rules
-- 9. budgets
-- 10. cost_records
-- 11. notifications
-- 12. notification_channels
-- 13. webhooks
-- 14. api_keys
-- 15. cron_jobs
-- 16. cron_executions
-- 17. event_bus_events
-- 18. tickets
-- 19. incidents
-- 20. rollbacks
-- 21. sbom_documents
-- 22. sbom_vulnerabilities
-- 23. policies
-- 24. policy_evaluations
-- 25. approvals
-- 26. skill_definitions
-- 27. skill_executions
-- 28. vector_embeddings
-- 29. confirmation_requests
-- 30. namespace_allocations
-- 31. namespace_pools
-- 32. product_lines
-- 33. internal_libraries
-- 34. iac_workspaces
-- 35. iac_plans
-- 36. iac_state_versions
-- 37. oncall_schedules
-- 38. oncall_assignments
-- 39. oncall_overrides
-- 40. maintenance_windows
-- 41. alert_suppressions
-- 42. known_issues
-- 43. healing_actions
-- 44. plugin_executions
-- 45. canary_analysis_runs
-- 46. change_intelligence_records
-- 47. risk_assessments
-- 48. risk_predictions
-- 49. code_ownership
-- 50. branch_policies
-- 51. build_cache_entries
-- 52. build_logs
--
-- Combined with migration 073 (12 tables), all 63 tables in RLSPolicyManager
-- now have database-level tenant isolation via RLS policies.
--
-- FORCE ROW LEVEL SECURITY ensures RLS applies even to table owners
-- app.current_tenant_id session variable must be set before queries
-- All policies validate session variable exists and is non-empty
