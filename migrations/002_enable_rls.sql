-- Migration 002: Enable Row-Level Security (RLS) for tenant isolation
-- This migration adds RLS policies to core tables as a defense-in-depth layer.
-- Application-level tenant_id filtering is already in place via BaseRepository.
-- RLS provides an additional DB-level safety net.

-- Helper function to get current tenant_id from session variable
-- Usage: SET app.current_tenant_id = 'tenant-uuid-here';
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Core tables RLS
-- ============================================================

-- Pipelines
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pipelines ON pipelines
    USING (tenant_id = current_tenant_id());

-- Pipeline runs
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pipeline_runs ON pipeline_runs
    USING (tenant_id = current_tenant_id());

-- Deployments
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_deployments ON deployments
    USING (tenant_id = current_tenant_id());

-- Approvals
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_approvals ON approvals
    USING (tenant_id = current_tenant_id());

-- Tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tickets ON tickets
    USING (tenant_id = current_tenant_id());

-- Alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_alerts ON alerts
    USING (tenant_id = current_tenant_id());

-- Config items
ALTER TABLE config_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_config_items ON config_items
    USING (tenant_id = current_tenant_id());

-- Secrets
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_secrets ON secrets
    USING (tenant_id = current_tenant_id());

-- Artifacts
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_artifacts ON artifacts
    USING (tenant_id = current_tenant_id());

-- CI items (CMDB)
ALTER TABLE ci_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ci_items ON ci_items
    USING (tenant_id = current_tenant_id());

-- Projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_projects ON projects
    USING (tenant_id = current_tenant_id());

-- Environments
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_environments ON environments
    USING (tenant_id = current_tenant_id());

-- Users (tenant-scoped)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_tenant_id());

-- Sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sessions ON sessions
    USING (tenant_id = current_tenant_id());

-- Audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    USING (tenant_id = current_tenant_id());

-- Finops data
ALTER TABLE finops_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_finops_data ON finops_data
    USING (tenant_id = current_tenant_id());

-- Knowledge articles
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_knowledge_articles ON knowledge_articles
    USING (tenant_id = current_tenant_id());

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notifications ON notifications
    USING (tenant_id = current_tenant_id());

-- Skills
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_skills ON skills
    USING (tenant_id = current_tenant_id());

-- Events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_events ON events
    USING (tenant_id = current_tenant_id());

-- Relationships (CMDB)
ALTER TABLE ci_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ci_relations ON ci_relations
    USING (tenant_id = current_tenant_id());

-- Alert rules
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_alert_rules ON alert_rules
    USING (tenant_id = current_tenant_id());

-- Build environments
ALTER TABLE build_environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_build_environments ON build_environments
    USING (tenant_id = current_tenant_id());

-- Pipeline templates
ALTER TABLE pipeline_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pipeline_templates ON pipeline_templates
    USING (tenant_id = current_tenant_id());

-- Canary configs
ALTER TABLE canary_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_canary_configs ON canary_configs
    USING (tenant_id = current_tenant_id());

-- DR configs
ALTER TABLE dr_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dr_configs ON dr_configs
    USING (tenant_id = current_tenant_id());

-- Federation configs
ALTER TABLE federation_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_federation_configs ON federation_configs
    USING (tenant_id = current_tenant_id());

-- Governance rules
ALTER TABLE governance_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_governance_rules ON governance_rules
    USING (tenant_id = current_tenant_id());

-- Risk assessments
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_risk_assessments ON risk_assessments
    USING (tenant_id = current_tenant_id());

-- Security scans
ALTER TABLE security_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_security_scans ON security_scans
    USING (tenant_id = current_tenant_id());

-- Workflow definitions
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_workflow_definitions ON workflow_definitions
    USING (tenant_id = current_tenant_id());

-- Scheduler jobs
ALTER TABLE scheduler_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_scheduler_jobs ON scheduler_jobs
    USING (tenant_id = current_tenant_id());

-- Plugin configs
ALTER TABLE plugin_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_plugin_configs ON plugin_configs
    USING (tenant_id = current_tenant_id());

-- Feature flags
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_feature_flags ON feature_flags
    USING (tenant_id = current_tenant_id());

-- Self-healing rules
ALTER TABLE selfhealing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_selfhealing_rules ON selfhealing_rules
    USING (tenant_id = current_tenant_id());

-- Skill configs
ALTER TABLE skill_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_skill_configs ON skill_configs
    USING (tenant_id = current_tenant_id());

-- Capacity data
ALTER TABLE capacity_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_capacity_data ON capacity_data
    USING (tenant_id = current_tenant_id());

-- Digital twin configs
ALTER TABLE digital_twin_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_digital_twin_configs ON digital_twin_configs
    USING (tenant_id = current_tenant_id());

-- Middleware ops data
ALTER TABLE middleware_ops_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_middleware_ops_data ON middleware_ops_data
    USING (tenant_id = current_tenant_id());

-- Efficiency metrics
ALTER TABLE efficiency_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_efficiency_metrics ON efficiency_metrics
    USING (tenant_id = current_tenant_id());

-- Chatops messages
ALTER TABLE chatops_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_chatops_messages ON chatops_messages
    USING (tenant_id = current_tenant_id());

-- Code reviews
ALTER TABLE code_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_code_reviews ON code_reviews
    USING (tenant_id = current_tenant_id());

-- Inspection results
ALTER TABLE inspection_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_inspection_results ON inspection_results
    USING (tenant_id = current_tenant_id());

-- Intelligence insights
ALTER TABLE intelligence_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_intelligence_insights ON intelligence_insights
    USING (tenant_id = current_tenant_id());

-- LLM traces
ALTER TABLE llm_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_llm_traces ON llm_traces
    USING (tenant_id = current_tenant_id());

-- Lowcode apps
ALTER TABLE lowcode_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_lowcode_apps ON lowcode_apps
    USING (tenant_id = current_tenant_id());

-- Community posts
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_community_posts ON community_posts
    USING (tenant_id = current_tenant_id());

-- Inception experiments
ALTER TABLE inception_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_inception_experiments ON inception_experiments
    USING (tenant_id = current_tenant_id());

-- Graph nodes
ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_graph_nodes ON graph_nodes
    USING (tenant_id = current_tenant_id());

-- Runner configs
ALTER TABLE runner_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_runner_configs ON runner_configs
    USING (tenant_id = current_tenant_id());

-- Visor dashboards
ALTER TABLE visor_dashboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_visor_dashboards ON visor_dashboards
    USING (tenant_id = current_tenant_id());

-- Pandawiki docs
ALTER TABLE pandawiki_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pandawiki_docs ON pandawiki_docs
    USING (tenant_id = current_tenant_id());

-- Notify templates
ALTER TABLE notify_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notify_templates ON notify_templates
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- RBAC tables (Phase 3)
-- ============================================================

-- ABAC policies
ALTER TABLE abac_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abac_policies ON abac_policies
    USING (tenant_id = current_tenant_id());

-- Project members
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_project_members ON project_members
    USING (tenant_id = current_tenant_id());

-- Permission audit logs
ALTER TABLE permission_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_permission_audit_logs ON permission_audit_logs
    USING (tenant_id = current_tenant_id());

-- Token blacklist
ALTER TABLE token_blacklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_token_blacklist ON token_blacklist
    USING (tenant_id = current_tenant_id());

COMMENT ON FUNCTION current_tenant_id() IS 'Returns the current tenant_id from the session variable app.current_tenant_id for RLS policies';
