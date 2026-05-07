-- Migration 127 Rollback: Disable RLS for Remaining Tables
-- Reverses the RLS policies enabled by migration 127.

-- ============================================================
-- Drop policies and disable RLS for all 52 tables
-- ============================================================

-- 1. configs
DROP POLICY IF EXISTS tenant_isolation_policy ON configs;
ALTER TABLE configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE configs UNFORCE ROW LEVEL SECURITY;

-- 2. projects
DROP POLICY IF EXISTS tenant_isolation_policy ON projects;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects UNFORCE ROW LEVEL SECURITY;

-- 3. pipelines
DROP POLICY IF EXISTS tenant_isolation_policy ON pipelines;
ALTER TABLE pipelines DISABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines UNFORCE ROW LEVEL SECURITY;

-- 4. artifacts
DROP POLICY IF EXISTS tenant_isolation_policy ON artifacts;
ALTER TABLE artifacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts UNFORCE ROW LEVEL SECURITY;

-- 5. artifact_registry
DROP POLICY IF EXISTS tenant_isolation_policy ON artifact_registry;
ALTER TABLE artifact_registry DISABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_registry UNFORCE ROW LEVEL SECURITY;

-- 6. environments
DROP POLICY IF EXISTS tenant_isolation_policy ON environments;
ALTER TABLE environments DISABLE ROW LEVEL SECURITY;
ALTER TABLE environments UNFORCE ROW LEVEL SECURITY;

-- 7. alerts
DROP POLICY IF EXISTS tenant_isolation_policy ON alerts;
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE alerts UNFORCE ROW LEVEL SECURITY;

-- 8. alert_rules
DROP POLICY IF EXISTS tenant_isolation_policy ON alert_rules;
ALTER TABLE alert_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules UNFORCE ROW LEVEL SECURITY;

-- 9. budgets
DROP POLICY IF EXISTS tenant_isolation_policy ON budgets;
ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE budgets UNFORCE ROW LEVEL SECURITY;

-- 10. cost_records
DROP POLICY IF EXISTS tenant_isolation_policy ON cost_records;
ALTER TABLE cost_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE cost_records UNFORCE ROW LEVEL SECURITY;

-- 11. notifications
DROP POLICY IF EXISTS tenant_isolation_policy ON notifications;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications UNFORCE ROW LEVEL SECURITY;

-- 12. notification_channels
DROP POLICY IF EXISTS tenant_isolation_policy ON notification_channels;
ALTER TABLE notification_channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels UNFORCE ROW LEVEL SECURITY;

-- 13. webhooks
DROP POLICY IF EXISTS tenant_isolation_policy ON webhooks;
ALTER TABLE webhooks DISABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks UNFORCE ROW LEVEL SECURITY;

-- 14. api_keys
DROP POLICY IF EXISTS tenant_isolation_policy ON api_keys;
ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys UNFORCE ROW LEVEL SECURITY;

-- 15. cron_jobs
DROP POLICY IF EXISTS tenant_isolation_policy ON cron_jobs;
ALTER TABLE cron_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE cron_jobs UNFORCE ROW LEVEL SECURITY;

-- 16. cron_executions
DROP POLICY IF EXISTS tenant_isolation_policy ON cron_executions;
ALTER TABLE cron_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE cron_executions UNFORCE ROW LEVEL SECURITY;

-- 17. event_bus_events
DROP POLICY IF EXISTS tenant_isolation_policy ON event_bus_events;
ALTER TABLE event_bus_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_bus_events UNFORCE ROW LEVEL SECURITY;

-- 18. tickets
DROP POLICY IF EXISTS tenant_isolation_policy ON tickets;
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets UNFORCE ROW LEVEL SECURITY;

-- 19. incidents
DROP POLICY IF EXISTS tenant_isolation_policy ON incidents;
ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidents UNFORCE ROW LEVEL SECURITY;

-- 20. rollbacks
DROP POLICY IF EXISTS tenant_isolation_policy ON rollbacks;
ALTER TABLE rollbacks DISABLE ROW LEVEL SECURITY;
ALTER TABLE rollbacks UNFORCE ROW LEVEL SECURITY;

-- 21. sbom_documents
DROP POLICY IF EXISTS tenant_isolation_policy ON sbom_documents;
ALTER TABLE sbom_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE sbom_documents UNFORCE ROW LEVEL SECURITY;

-- 22. sbom_vulnerabilities
DROP POLICY IF EXISTS tenant_isolation_policy ON sbom_vulnerabilities;
ALTER TABLE sbom_vulnerabilities DISABLE ROW LEVEL SECURITY;
ALTER TABLE sbom_vulnerabilities UNFORCE ROW LEVEL SECURITY;

-- 23. policies
DROP POLICY IF EXISTS tenant_isolation_policy ON policies;
ALTER TABLE policies DISABLE ROW LEVEL SECURITY;
ALTER TABLE policies UNFORCE ROW LEVEL SECURITY;

-- 24. policy_evaluations
DROP POLICY IF EXISTS tenant_isolation_policy ON policy_evaluations;
ALTER TABLE policy_evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE policy_evaluations UNFORCE ROW LEVEL SECURITY;

-- 25. approvals
DROP POLICY IF EXISTS tenant_isolation_policy ON approvals;
ALTER TABLE approvals DISABLE ROW LEVEL SECURITY;
ALTER TABLE approvals UNFORCE ROW LEVEL SECURITY;

-- 26. skill_definitions
DROP POLICY IF EXISTS tenant_isolation_policy ON skill_definitions;
ALTER TABLE skill_definitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE skill_definitions UNFORCE ROW LEVEL SECURITY;

-- 27. skill_executions
DROP POLICY IF EXISTS tenant_isolation_policy ON skill_executions;
ALTER TABLE skill_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE skill_executions UNFORCE ROW LEVEL SECURITY;

-- 28. vector_embeddings
DROP POLICY IF EXISTS tenant_isolation_policy ON vector_embeddings;
ALTER TABLE vector_embeddings DISABLE ROW LEVEL SECURITY;
ALTER TABLE vector_embeddings UNFORCE ROW LEVEL SECURITY;

-- 29. confirmation_requests
DROP POLICY IF EXISTS tenant_isolation_policy ON confirmation_requests;
ALTER TABLE confirmation_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE confirmation_requests UNFORCE ROW LEVEL SECURITY;

-- 30. namespace_allocations
DROP POLICY IF EXISTS tenant_isolation_policy ON namespace_allocations;
ALTER TABLE namespace_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE namespace_allocations UNFORCE ROW LEVEL SECURITY;

-- 31. namespace_pools
DROP POLICY IF EXISTS tenant_isolation_policy ON namespace_pools;
ALTER TABLE namespace_pools DISABLE ROW LEVEL SECURITY;
ALTER TABLE namespace_pools UNFORCE ROW LEVEL SECURITY;

-- 32. product_lines
DROP POLICY IF EXISTS tenant_isolation_policy ON product_lines;
ALTER TABLE product_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_lines UNFORCE ROW LEVEL SECURITY;

-- 33. internal_libraries
DROP POLICY IF EXISTS tenant_isolation_policy ON internal_libraries;
ALTER TABLE internal_libraries DISABLE ROW LEVEL SECURITY;
ALTER TABLE internal_libraries UNFORCE ROW LEVEL SECURITY;

-- 34. iac_workspaces
DROP POLICY IF EXISTS tenant_isolation_policy ON iac_workspaces;
ALTER TABLE iac_workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE iac_workspaces UNFORCE ROW LEVEL SECURITY;

-- 35. iac_plans
DROP POLICY IF EXISTS tenant_isolation_policy ON iac_plans;
ALTER TABLE iac_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE iac_plans UNFORCE ROW LEVEL SECURITY;

-- 36. iac_state_versions
DROP POLICY IF EXISTS tenant_isolation_policy ON iac_state_versions;
ALTER TABLE iac_state_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE iac_state_versions UNFORCE ROW LEVEL SECURITY;

-- 37. oncall_schedules
DROP POLICY IF EXISTS tenant_isolation_policy ON oncall_schedules;
ALTER TABLE oncall_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE oncall_schedules UNFORCE ROW LEVEL SECURITY;

-- 38. oncall_assignments
DROP POLICY IF EXISTS tenant_isolation_policy ON oncall_assignments;
ALTER TABLE oncall_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE oncall_assignments UNFORCE ROW LEVEL SECURITY;

-- 39. oncall_overrides
DROP POLICY IF EXISTS tenant_isolation_policy ON oncall_overrides;
ALTER TABLE oncall_overrides DISABLE ROW LEVEL SECURITY;
ALTER TABLE oncall_overrides UNFORCE ROW LEVEL SECURITY;

-- 40. maintenance_windows
DROP POLICY IF EXISTS tenant_isolation_policy ON maintenance_windows;
ALTER TABLE maintenance_windows DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_windows UNFORCE ROW LEVEL SECURITY;

-- 41. alert_suppressions
DROP POLICY IF EXISTS tenant_isolation_policy ON alert_suppressions;
ALTER TABLE alert_suppressions DISABLE ROW LEVEL SECURITY;
ALTER TABLE alert_suppressions UNFORCE ROW LEVEL SECURITY;

-- 42. known_issues
DROP POLICY IF EXISTS tenant_isolation_policy ON known_issues;
ALTER TABLE known_issues DISABLE ROW LEVEL SECURITY;
ALTER TABLE known_issues UNFORCE ROW LEVEL SECURITY;

-- 43. healing_actions
DROP POLICY IF EXISTS tenant_isolation_policy ON healing_actions;
ALTER TABLE healing_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE healing_actions UNFORCE ROW LEVEL SECURITY;

-- 44. plugin_executions
DROP POLICY IF EXISTS tenant_isolation_policy ON plugin_executions;
ALTER TABLE plugin_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_executions UNFORCE ROW LEVEL SECURITY;

-- 45. canary_analysis_runs
DROP POLICY IF EXISTS tenant_isolation_policy ON canary_analysis_runs;
ALTER TABLE canary_analysis_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE canary_analysis_runs UNFORCE ROW LEVEL SECURITY;

-- 46. change_intelligence_records
DROP POLICY IF EXISTS tenant_isolation_policy ON change_intelligence_records;
ALTER TABLE change_intelligence_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE change_intelligence_records UNFORCE ROW LEVEL SECURITY;

-- 47. risk_assessments
DROP POLICY IF EXISTS tenant_isolation_policy ON risk_assessments;
ALTER TABLE risk_assessments DISABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments UNFORCE ROW LEVEL SECURITY;

-- 48. risk_predictions
DROP POLICY IF EXISTS tenant_isolation_policy ON risk_predictions;
ALTER TABLE risk_predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE risk_predictions UNFORCE ROW LEVEL SECURITY;

-- 49. code_ownership
DROP POLICY IF EXISTS tenant_isolation_policy ON code_ownership;
ALTER TABLE code_ownership DISABLE ROW LEVEL SECURITY;
ALTER TABLE code_ownership UNFORCE ROW LEVEL SECURITY;

-- 50. branch_policies
DROP POLICY IF EXISTS tenant_isolation_policy ON branch_policies;
ALTER TABLE branch_policies DISABLE ROW LEVEL SECURITY;
ALTER TABLE branch_policies UNFORCE ROW LEVEL SECURITY;

-- 51. build_cache_entries
DROP POLICY IF EXISTS tenant_isolation_policy ON build_cache_entries;
ALTER TABLE build_cache_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE build_cache_entries UNFORCE ROW LEVEL SECURITY;

-- 52. build_logs
DROP POLICY IF EXISTS tenant_isolation_policy ON build_logs;
ALTER TABLE build_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE build_logs UNFORCE ROW LEVEL SECURITY;

-- Note: tenant_id columns added by migration 127 are NOT dropped in this
-- rollback to preserve data integrity. If complete removal is needed,
-- manually drop the columns after verifying no data depends on them.
