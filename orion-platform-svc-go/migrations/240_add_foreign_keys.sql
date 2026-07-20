-- Migration: 240_add_foreign_keys.sql
-- Description: Add foreign key constraints for tenant_id and user_id across all tables
-- Phase: 5.4
-- Impact: 404 tenant_id FKs + 40 user_id FKs = 444 total constraints
-- Notes: Uses NOT VALID + VALIDATE pattern to avoid table locks during migration
--         Requires migration 239 (tenant_id UUID unification) to have been applied first

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_b_a_c_policies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_b_a_c_policies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY a_b_a_c_policies
      ADD CONSTRAINT fk_a_b_a_c_policies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_b_a_c_policies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE a_b_a_c_policies VALIDATE CONSTRAINT fk_a_b_a_c_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_i_agents_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_agents' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY a_i_agents
      ADD CONSTRAINT fk_a_i_agents_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_i_agents_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE a_i_agents VALIDATE CONSTRAINT fk_a_i_agents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_i_decisions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_decisions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY a_i_decisions
      ADD CONSTRAINT fk_a_i_decisions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_i_decisions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE a_i_decisions VALIDATE CONSTRAINT fk_a_i_decisions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_i_models_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_models' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY a_i_models
      ADD CONSTRAINT fk_a_i_models_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_i_models_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE a_i_models VALIDATE CONSTRAINT fk_a_i_models_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_agent_audit_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_audit_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY agent_audit_logs
      ADD CONSTRAINT fk_agent_audit_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_agent_audit_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE agent_audit_logs VALIDATE CONSTRAINT fk_agent_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_agents_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY agents
      ADD CONSTRAINT fk_agents_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_agents_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE agents VALIDATE CONSTRAINT fk_agents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_decision_feedback_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_feedback' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ai_decision_feedback
      ADD CONSTRAINT fk_ai_decision_feedback_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_decision_feedback_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ai_decision_feedback VALIDATE CONSTRAINT fk_ai_decision_feedback_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_decision_traces_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ai_decision_traces
      ADD CONSTRAINT fk_ai_decision_traces_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_decision_traces_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ai_decision_traces VALIDATE CONSTRAINT fk_ai_decision_traces_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_decisions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decisions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ai_decisions
      ADD CONSTRAINT fk_ai_decisions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_decisions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ai_decisions VALIDATE CONSTRAINT fk_ai_decisions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_gateway_requests_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_gateway_requests' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ai_gateway_requests
      ADD CONSTRAINT fk_ai_gateway_requests_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_gateway_requests_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ai_gateway_requests VALIDATE CONSTRAINT fk_ai_gateway_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_breakers_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_breakers' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY alert_breakers
      ADD CONSTRAINT fk_alert_breakers_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_breakers_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE alert_breakers VALIDATE CONSTRAINT fk_alert_breakers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_known_issues_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_known_issues' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY alert_known_issues
      ADD CONSTRAINT fk_alert_known_issues_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_known_issues_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE alert_known_issues VALIDATE CONSTRAINT fk_alert_known_issues_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_maintenance_windows_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_maintenance_windows' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY alert_maintenance_windows
      ADD CONSTRAINT fk_alert_maintenance_windows_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_maintenance_windows_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE alert_maintenance_windows VALIDATE CONSTRAINT fk_alert_maintenance_windows_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_node_health_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_node_health' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY alert_node_health
      ADD CONSTRAINT fk_alert_node_health_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_node_health_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE alert_node_health VALIDATE CONSTRAINT fk_alert_node_health_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_topologies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_topologies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY alert_topologies
      ADD CONSTRAINT fk_alert_topologies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_topologies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE alert_topologies VALIDATE CONSTRAINT fk_alert_topologies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alerts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY alerts
      ADD CONSTRAINT fk_alerts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alerts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE alerts VALIDATE CONSTRAINT fk_alerts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_analysises_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysises' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY analysises
      ADD CONSTRAINT fk_analysises_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_analysises_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE analysises VALIDATE CONSTRAINT fk_analysises_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_consumptions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_consumptions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY api_consumptions
      ADD CONSTRAINT fk_api_consumptions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_consumptions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE api_consumptions VALIDATE CONSTRAINT fk_api_consumptions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_contracts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_contracts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY api_contracts
      ADD CONSTRAINT fk_api_contracts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_contracts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE api_contracts VALIDATE CONSTRAINT fk_api_contracts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_governance_contracts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_contracts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY api_governance_contracts
      ADD CONSTRAINT fk_api_governance_contracts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_governance_contracts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE api_governance_contracts VALIDATE CONSTRAINT fk_api_governance_contracts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_governance_rules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_rules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY api_governance_rules
      ADD CONSTRAINT fk_api_governance_rules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_governance_rules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE api_governance_rules VALIDATE CONSTRAINT fk_api_governance_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_governance_versions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_versions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY api_governance_versions
      ADD CONSTRAINT fk_api_governance_versions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_governance_versions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE api_governance_versions VALIDATE CONSTRAINT fk_api_governance_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_market_apps_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_apps' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY api_market_apps
      ADD CONSTRAINT fk_api_market_apps_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_market_apps_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE api_market_apps VALIDATE CONSTRAINT fk_api_market_apps_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_market_keys_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_keys' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY api_market_keys
      ADD CONSTRAINT fk_api_market_keys_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_market_keys_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE api_market_keys VALIDATE CONSTRAINT fk_api_market_keys_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_market_products_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_products' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY api_market_products
      ADD CONSTRAINT fk_api_market_products_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_market_products_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE api_market_products VALIDATE CONSTRAINT fk_api_market_products_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_apk_upload_records_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apk_upload_records' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY apk_upload_records
      ADD CONSTRAINT fk_apk_upload_records_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_apk_upload_records_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE apk_upload_records VALIDATE CONSTRAINT fk_apk_upload_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_apm_entries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apm_entries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY apm_entries
      ADD CONSTRAINT fk_apm_entries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_apm_entries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE apm_entries VALIDATE CONSTRAINT fk_apm_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_gates_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_gates' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY approval_gates
      ADD CONSTRAINT fk_approval_gates_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_gates_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE approval_gates VALIDATE CONSTRAINT fk_approval_gates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_history_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_history' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY approval_history
      ADD CONSTRAINT fk_approval_history_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_history_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE approval_history VALIDATE CONSTRAINT fk_approval_history_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_levels_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_levels' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY approval_levels
      ADD CONSTRAINT fk_approval_levels_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_levels_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE approval_levels VALIDATE CONSTRAINT fk_approval_levels_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_requests_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY approval_requests
      ADD CONSTRAINT fk_approval_requests_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_requests_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE approval_requests VALIDATE CONSTRAINT fk_approval_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_templates_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_templates' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY approval_templates
      ADD CONSTRAINT fk_approval_templates_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_templates_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE approval_templates VALIDATE CONSTRAINT fk_approval_templates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_downloads_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_downloads' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY artifact_downloads
      ADD CONSTRAINT fk_artifact_downloads_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_downloads_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE artifact_downloads VALIDATE CONSTRAINT fk_artifact_downloads_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_lifecycles_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_lifecycles' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY artifact_lifecycles
      ADD CONSTRAINT fk_artifact_lifecycles_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_lifecycles_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE artifact_lifecycles VALIDATE CONSTRAINT fk_artifact_lifecycles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_operations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_operations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY artifact_operations
      ADD CONSTRAINT fk_artifact_operations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_operations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE artifact_operations VALIDATE CONSTRAINT fk_artifact_operations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_promotions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_promotions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY artifact_promotions
      ADD CONSTRAINT fk_artifact_promotions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_promotions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE artifact_promotions VALIDATE CONSTRAINT fk_artifact_promotions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_scans_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_scans' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY artifact_scans
      ADD CONSTRAINT fk_artifact_scans_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_scans_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE artifact_scans VALIDATE CONSTRAINT fk_artifact_scans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_signatures_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_signatures' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY artifact_signatures
      ADD CONSTRAINT fk_artifact_signatures_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_signatures_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE artifact_signatures VALIDATE CONSTRAINT fk_artifact_signatures_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_tags_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_tags' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY artifact_tags
      ADD CONSTRAINT fk_artifact_tags_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_tags_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE artifact_tags VALIDATE CONSTRAINT fk_artifact_tags_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifacts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifacts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY artifacts
      ADD CONSTRAINT fk_artifacts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifacts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE artifacts VALIDATE CONSTRAINT fk_artifacts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_executions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_executions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY audit_executions
      ADD CONSTRAINT fk_audit_executions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_executions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE audit_executions VALIDATE CONSTRAINT fk_audit_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_findings_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_findings' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY audit_findings
      ADD CONSTRAINT fk_audit_findings_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_findings_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE audit_findings VALIDATE CONSTRAINT fk_audit_findings_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY audit_logs
      ADD CONSTRAINT fk_audit_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE audit_logs VALIDATE CONSTRAINT fk_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_plans_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_plans' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY audit_plans
      ADD CONSTRAINT fk_audit_plans_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_plans_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE audit_plans VALIDATE CONSTRAINT fk_audit_plans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_reports_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_reports' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY audit_reports
      ADD CONSTRAINT fk_audit_reports_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_reports_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE audit_reports VALIDATE CONSTRAINT fk_audit_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_rules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_rules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY audit_rules
      ADD CONSTRAINT fk_audit_rules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_rules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE audit_rules VALIDATE CONSTRAINT fk_audit_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_keies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_keies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY auth_keies
      ADD CONSTRAINT fk_auth_keies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_keies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE auth_keies VALIDATE CONSTRAINT fk_auth_keies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_token_blacklists_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_token_blacklists' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY auth_token_blacklists
      ADD CONSTRAINT fk_auth_token_blacklists_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_token_blacklists_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE auth_token_blacklists VALIDATE CONSTRAINT fk_auth_token_blacklists_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_jobs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_jobs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY backup_jobs
      ADD CONSTRAINT fk_backup_jobs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_jobs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE backup_jobs VALIDATE CONSTRAINT fk_backup_jobs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_policies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_policies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY backup_policies
      ADD CONSTRAINT fk_backup_policies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_policies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE backup_policies VALIDATE CONSTRAINT fk_backup_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_restores_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_restores' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY backup_restores
      ADD CONSTRAINT fk_backup_restores_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_restores_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE backup_restores VALIDATE CONSTRAINT fk_backup_restores_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_storages_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_storages' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY backup_storages
      ADD CONSTRAINT fk_backup_storages_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_storages_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE backup_storages VALIDATE CONSTRAINT fk_backup_storages_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_baselines_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'baselines' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY baselines
      ADD CONSTRAINT fk_baselines_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_baselines_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE baselines VALIDATE CONSTRAINT fk_baselines_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_batch_runs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_runs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY batch_runs
      ADD CONSTRAINT fk_batch_runs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_batch_runs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE batch_runs VALIDATE CONSTRAINT fk_batch_runs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_bi_dashboards_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bi_dashboards' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY bi_dashboards
      ADD CONSTRAINT fk_bi_dashboards_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_bi_dashboards_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE bi_dashboards VALIDATE CONSTRAINT fk_bi_dashboards_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_billing_accounts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_accounts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY billing_accounts
      ADD CONSTRAINT fk_billing_accounts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_billing_accounts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE billing_accounts VALIDATE CONSTRAINT fk_billing_accounts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_billing_invoices_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_invoices' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY billing_invoices
      ADD CONSTRAINT fk_billing_invoices_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_billing_invoices_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE billing_invoices VALIDATE CONSTRAINT fk_billing_invoices_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_billing_subscriptions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_subscriptions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY billing_subscriptions
      ADD CONSTRAINT fk_billing_subscriptions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_billing_subscriptions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE billing_subscriptions VALIDATE CONSTRAINT fk_billing_subscriptions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_budget_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY budget_configs
      ADD CONSTRAINT fk_budget_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_budget_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE budget_configs VALIDATE CONSTRAINT fk_budget_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_budget_history_records_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_history_records' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY budget_history_records
      ADD CONSTRAINT fk_budget_history_records_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_budget_history_records_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE budget_history_records VALIDATE CONSTRAINT fk_budget_history_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_budgets_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY budgets
      ADD CONSTRAINT fk_budgets_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_budgets_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE budgets VALIDATE CONSTRAINT fk_budgets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_cache_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY build_cache_configs
      ADD CONSTRAINT fk_build_cache_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_cache_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE build_cache_configs VALIDATE CONSTRAINT fk_build_cache_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_environments_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_environments' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY build_environments
      ADD CONSTRAINT fk_build_environments_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_environments_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE build_environments VALIDATE CONSTRAINT fk_build_environments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_images_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_images' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY build_images
      ADD CONSTRAINT fk_build_images_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_images_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE build_images VALIDATE CONSTRAINT fk_build_images_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY build_logs
      ADD CONSTRAINT fk_build_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE build_logs VALIDATE CONSTRAINT fk_build_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_builds_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'builds' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY builds
      ADD CONSTRAINT fk_builds_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_builds_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE builds VALIDATE CONSTRAINT fk_builds_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cache_cleanups_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_cleanups' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cache_cleanups
      ADD CONSTRAINT fk_cache_cleanups_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cache_cleanups_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cache_cleanups VALIDATE CONSTRAINT fk_cache_cleanups_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cache_entries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_entries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cache_entries
      ADD CONSTRAINT fk_cache_entries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cache_entries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cache_entries VALIDATE CONSTRAINT fk_cache_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_canary_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY canary_configs
      ADD CONSTRAINT fk_canary_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_canary_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE canary_configs VALIDATE CONSTRAINT fk_canary_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_canary_deployments_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_deployments' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY canary_deployments
      ADD CONSTRAINT fk_canary_deployments_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_canary_deployments_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE canary_deployments VALIDATE CONSTRAINT fk_canary_deployments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_canary_traffics_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_traffics' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY canary_traffics
      ADD CONSTRAINT fk_canary_traffics_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_canary_traffics_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE canary_traffics VALIDATE CONSTRAINT fk_canary_traffics_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_capabilities_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capabilities' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY capabilities
      ADD CONSTRAINT fk_capabilities_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_capabilities_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE capabilities VALIDATE CONSTRAINT fk_capabilities_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_capability_audit_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_audit_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY capability_audit_logs
      ADD CONSTRAINT fk_capability_audit_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_capability_audit_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE capability_audit_logs VALIDATE CONSTRAINT fk_capability_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_change_analysises_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_analysises' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY change_analysises
      ADD CONSTRAINT fk_change_analysises_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_change_analysises_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE change_analysises VALIDATE CONSTRAINT fk_change_analysises_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_change_histories_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_histories' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY change_histories
      ADD CONSTRAINT fk_change_histories_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_change_histories_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE change_histories VALIDATE CONSTRAINT fk_change_histories_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_change_requests_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_requests' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY change_requests
      ADD CONSTRAINT fk_change_requests_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_change_requests_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE change_requests VALIDATE CONSTRAINT fk_change_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chaos_experiments_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chaos_experiments' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chaos_experiments
      ADD CONSTRAINT fk_chaos_experiments_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chaos_experiments_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chaos_experiments VALIDATE CONSTRAINT fk_chaos_experiments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chargeback_entries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chargeback_entries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chargeback_entries
      ADD CONSTRAINT fk_chargeback_entries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chargeback_entries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chargeback_entries VALIDATE CONSTRAINT fk_chargeback_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_alert_states_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_alert_states' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_alert_states
      ADD CONSTRAINT fk_chatops_alert_states_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_alert_states_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_alert_states VALIDATE CONSTRAINT fk_chatops_alert_states_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_approval_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_approval_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_approval_configs
      ADD CONSTRAINT fk_chatops_approval_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_approval_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_approval_configs VALIDATE CONSTRAINT fk_chatops_approval_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_audit_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_audit_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_audit_logs
      ADD CONSTRAINT fk_chatops_audit_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_audit_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_audit_logs VALIDATE CONSTRAINT fk_chatops_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_capability_mappings_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_capability_mappings' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_capability_mappings
      ADD CONSTRAINT fk_chatops_capability_mappings_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_capability_mappings_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_capability_mappings VALIDATE CONSTRAINT fk_chatops_capability_mappings_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_command_configs
      ADD CONSTRAINT fk_chatops_command_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_command_configs VALIDATE CONSTRAINT fk_chatops_command_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_permissions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_permissions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_command_permissions
      ADD CONSTRAINT fk_chatops_command_permissions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_permissions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_command_permissions VALIDATE CONSTRAINT fk_chatops_command_permissions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_versions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_versions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_command_versions
      ADD CONSTRAINT fk_chatops_command_versions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_versions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_command_versions VALIDATE CONSTRAINT fk_chatops_command_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_commands_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_commands' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_commands
      ADD CONSTRAINT fk_chatops_commands_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_commands_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_commands VALIDATE CONSTRAINT fk_chatops_commands_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_dnd_settings_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_dnd_settings
      ADD CONSTRAINT fk_chatops_dnd_settings_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_dnd_settings_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_dnd_settings VALIDATE CONSTRAINT fk_chatops_dnd_settings_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_environment_permissions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_environment_permissions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_environment_permissions
      ADD CONSTRAINT fk_chatops_environment_permissions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_environment_permissions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_environment_permissions VALIDATE CONSTRAINT fk_chatops_environment_permissions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_executions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_executions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_executions
      ADD CONSTRAINT fk_chatops_executions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_executions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_executions VALIDATE CONSTRAINT fk_chatops_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_messages_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_messages' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_messages
      ADD CONSTRAINT fk_chatops_messages_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_messages_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_messages VALIDATE CONSTRAINT fk_chatops_messages_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_notification_preferences_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_notification_preferences' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_notification_preferences
      ADD CONSTRAINT fk_chatops_notification_preferences_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_notification_preferences_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_notification_preferences VALIDATE CONSTRAINT fk_chatops_notification_preferences_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_permission_roles_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_permission_roles' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_permission_roles
      ADD CONSTRAINT fk_chatops_permission_roles_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_permission_roles_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_permission_roles VALIDATE CONSTRAINT fk_chatops_permission_roles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_platform_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_platform_configs
      ADD CONSTRAINT fk_chatops_platform_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_platform_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_platform_configs VALIDATE CONSTRAINT fk_chatops_platform_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_question_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_question_configs
      ADD CONSTRAINT fk_chatops_question_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_question_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_question_configs VALIDATE CONSTRAINT fk_chatops_question_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_rate_limits_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_rate_limits' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_rate_limits
      ADD CONSTRAINT fk_chatops_rate_limits_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_rate_limits_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_rate_limits VALIDATE CONSTRAINT fk_chatops_rate_limits_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_sessions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_sessions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_sessions
      ADD CONSTRAINT fk_chatops_sessions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_sessions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_sessions VALIDATE CONSTRAINT fk_chatops_sessions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_webhooks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_webhooks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_webhooks
      ADD CONSTRAINT fk_chatops_webhooks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_webhooks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_webhooks VALIDATE CONSTRAINT fk_chatops_webhooks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_checkpoints_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checkpoints' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY checkpoints
      ADD CONSTRAINT fk_checkpoints_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_checkpoints_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE checkpoints VALIDATE CONSTRAINT fk_checkpoints_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ci_relations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_relations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ci_relations
      ADD CONSTRAINT fk_ci_relations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ci_relations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ci_relations VALIDATE CONSTRAINT fk_ci_relations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ci_types_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_types' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ci_types
      ADD CONSTRAINT fk_ci_types_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ci_types_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ci_types VALIDATE CONSTRAINT fk_ci_types_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ci_versions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_versions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ci_versions
      ADD CONSTRAINT fk_ci_versions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ci_versions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ci_versions VALIDATE CONSTRAINT fk_ci_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_circuit_breaker_events_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY circuit_breaker_events
      ADD CONSTRAINT fk_circuit_breaker_events_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_circuit_breaker_events_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE circuit_breaker_events VALIDATE CONSTRAINT fk_circuit_breaker_events_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_circuit_breakers_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breakers' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY circuit_breakers
      ADD CONSTRAINT fk_circuit_breakers_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_circuit_breakers_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE circuit_breakers VALIDATE CONSTRAINT fk_circuit_breakers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cis_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cis' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cis
      ADD CONSTRAINT fk_cis_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cis_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cis VALIDATE CONSTRAINT fk_cis_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cloud_accounts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cloud_accounts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cloud_accounts
      ADD CONSTRAINT fk_cloud_accounts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cloud_accounts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cloud_accounts VALIDATE CONSTRAINT fk_cloud_accounts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cloud_resources_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cloud_resources' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cloud_resources
      ADD CONSTRAINT fk_cloud_resources_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cloud_resources_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cloud_resources VALIDATE CONSTRAINT fk_cloud_resources_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_code_repo_adapters_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repo_adapters' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY code_repo_adapters
      ADD CONSTRAINT fk_code_repo_adapters_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_code_repo_adapters_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE code_repo_adapters VALIDATE CONSTRAINT fk_code_repo_adapters_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_code_repos_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repos' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY code_repos
      ADD CONSTRAINT fk_code_repos_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_code_repos_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE code_repos VALIDATE CONSTRAINT fk_code_repos_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_command_log_details_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_log_details' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY command_log_details
      ADD CONSTRAINT fk_command_log_details_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_command_log_details_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE command_log_details VALIDATE CONSTRAINT fk_command_log_details_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_command_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY command_logs
      ADD CONSTRAINT fk_command_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_command_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE command_logs VALIDATE CONSTRAINT fk_command_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_comments_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY comments
      ADD CONSTRAINT fk_comments_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_comments_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE comments VALIDATE CONSTRAINT fk_comments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_communities_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY communities
      ADD CONSTRAINT fk_communities_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_communities_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE communities VALIDATE CONSTRAINT fk_communities_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_community_advanceds_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_advanceds' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY community_advanceds
      ADD CONSTRAINT fk_community_advanceds_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_community_advanceds_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE community_advanceds VALIDATE CONSTRAINT fk_community_advanceds_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_evidence_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_evidence' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY compliance_evidence
      ADD CONSTRAINT fk_compliance_evidence_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_evidence_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE compliance_evidence VALIDATE CONSTRAINT fk_compliance_evidence_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_frameworks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_frameworks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY compliance_frameworks
      ADD CONSTRAINT fk_compliance_frameworks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_frameworks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE compliance_frameworks VALIDATE CONSTRAINT fk_compliance_frameworks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_policies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_policies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY compliance_policies
      ADD CONSTRAINT fk_compliance_policies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_policies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE compliance_policies VALIDATE CONSTRAINT fk_compliance_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_reports_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_reports' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY compliance_reports
      ADD CONSTRAINT fk_compliance_reports_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_reports_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE compliance_reports VALIDATE CONSTRAINT fk_compliance_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_schedules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_schedules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY compliance_schedules
      ADD CONSTRAINT fk_compliance_schedules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_schedules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE compliance_schedules VALIDATE CONSTRAINT fk_compliance_schedules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_audit_entries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_audit_entries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY config_audit_entries
      ADD CONSTRAINT fk_config_audit_entries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_audit_entries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE config_audit_entries VALIDATE CONSTRAINT fk_config_audit_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_mgmts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_mgmts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY config_mgmts
      ADD CONSTRAINT fk_config_mgmts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_mgmts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE config_mgmts VALIDATE CONSTRAINT fk_config_mgmts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_snapshots_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_snapshots' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY config_snapshots
      ADD CONSTRAINT fk_config_snapshots_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_snapshots_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE config_snapshots VALIDATE CONSTRAINT fk_config_snapshots_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_template_versions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_template_versions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY config_template_versions
      ADD CONSTRAINT fk_config_template_versions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_template_versions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE config_template_versions VALIDATE CONSTRAINT fk_config_template_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_templates_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_templates' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY config_templates
      ADD CONSTRAINT fk_config_templates_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_templates_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE config_templates VALIDATE CONSTRAINT fk_config_templates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_versions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_versions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY config_versions
      ADD CONSTRAINT fk_config_versions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_versions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE config_versions VALIDATE CONSTRAINT fk_config_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_webhooks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_webhooks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY config_webhooks
      ADD CONSTRAINT fk_config_webhooks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_webhooks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE config_webhooks VALIDATE CONSTRAINT fk_config_webhooks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY configs
      ADD CONSTRAINT fk_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE configs VALIDATE CONSTRAINT fk_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_allocation_reports_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_reports' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cost_allocation_reports
      ADD CONSTRAINT fk_cost_allocation_reports_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_allocation_reports_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cost_allocation_reports VALIDATE CONSTRAINT fk_cost_allocation_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_allocation_tags_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_tags' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cost_allocation_tags
      ADD CONSTRAINT fk_cost_allocation_tags_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_allocation_tags_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cost_allocation_tags VALIDATE CONSTRAINT fk_cost_allocation_tags_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_allocations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cost_allocations
      ADD CONSTRAINT fk_cost_allocations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_allocations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cost_allocations VALIDATE CONSTRAINT fk_cost_allocations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_entries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_entries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cost_entries
      ADD CONSTRAINT fk_cost_entries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_entries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cost_entries VALIDATE CONSTRAINT fk_cost_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_records_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_records' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cost_records
      ADD CONSTRAINT fk_cost_records_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_records_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cost_records VALIDATE CONSTRAINT fk_cost_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cron_job_executions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_executions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cron_job_executions
      ADD CONSTRAINT fk_cron_job_executions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cron_job_executions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cron_job_executions VALIDATE CONSTRAINT fk_cron_job_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cron_job_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cron_job_logs
      ADD CONSTRAINT fk_cron_job_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cron_job_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cron_job_logs VALIDATE CONSTRAINT fk_cron_job_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cron_jobs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_jobs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cron_jobs
      ADD CONSTRAINT fk_cron_jobs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cron_jobs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cron_jobs VALIDATE CONSTRAINT fk_cron_jobs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cross_domains_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cross_domains' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY cross_domains
      ADD CONSTRAINT fk_cross_domains_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cross_domains_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE cross_domains VALIDATE CONSTRAINT fk_cross_domains_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_lineages_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_lineages' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY data_lineages
      ADD CONSTRAINT fk_data_lineages_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_lineages_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE data_lineages VALIDATE CONSTRAINT fk_data_lineages_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_pipelines_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_pipelines' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY data_pipelines
      ADD CONSTRAINT fk_data_pipelines_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_pipelines_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE data_pipelines VALIDATE CONSTRAINT fk_data_pipelines_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_quality_rules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_quality_rules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY data_quality_rules
      ADD CONSTRAINT fk_data_quality_rules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_quality_rules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE data_quality_rules VALIDATE CONSTRAINT fk_data_quality_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_sources_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_sources' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY data_sources
      ADD CONSTRAINT fk_data_sources_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_sources_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE data_sources VALIDATE CONSTRAINT fk_data_sources_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decision_explanations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_explanations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY decision_explanations
      ADD CONSTRAINT fk_decision_explanations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decision_explanations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE decision_explanations VALIDATE CONSTRAINT fk_decision_explanations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decision_feedbacks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_feedbacks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY decision_feedbacks
      ADD CONSTRAINT fk_decision_feedbacks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decision_feedbacks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE decision_feedbacks VALIDATE CONSTRAINT fk_decision_feedbacks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decision_traces_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_traces' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY decision_traces
      ADD CONSTRAINT fk_decision_traces_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decision_traces_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE decision_traces VALIDATE CONSTRAINT fk_decision_traces_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decisions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decisions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY decisions
      ADD CONSTRAINT fk_decisions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decisions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE decisions VALIDATE CONSTRAINT fk_decisions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_degradation_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY degradation_configs
      ADD CONSTRAINT fk_degradation_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_degradation_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE degradation_configs VALIDATE CONSTRAINT fk_degradation_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_degradation_histories_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_histories' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY degradation_histories
      ADD CONSTRAINT fk_degradation_histories_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_degradation_histories_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE degradation_histories VALIDATE CONSTRAINT fk_degradation_histories_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_degradations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY degradations
      ADD CONSTRAINT fk_degradations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_degradations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE degradations VALIDATE CONSTRAINT fk_degradations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_dependency_coordinations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dependency_coordinations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY dependency_coordinations
      ADD CONSTRAINT fk_dependency_coordinations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_dependency_coordinations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE dependency_coordinations VALIDATE CONSTRAINT fk_dependency_coordinations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deploy_audit_entries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_audit_entries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY deploy_audit_entries
      ADD CONSTRAINT fk_deploy_audit_entries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deploy_audit_entries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE deploy_audit_entries VALIDATE CONSTRAINT fk_deploy_audit_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deploy_windows_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_windows' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY deploy_windows
      ADD CONSTRAINT fk_deploy_windows_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deploy_windows_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE deploy_windows VALIDATE CONSTRAINT fk_deploy_windows_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deployment_triggers_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployment_triggers' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY deployment_triggers
      ADD CONSTRAINT fk_deployment_triggers_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deployment_triggers_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE deployment_triggers VALIDATE CONSTRAINT fk_deployment_triggers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deployments_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployments' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY deployments
      ADD CONSTRAINT fk_deployments_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deployments_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE deployments VALIDATE CONSTRAINT fk_deployments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_developer_portals_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developer_portals' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY developer_portals
      ADD CONSTRAINT fk_developer_portals_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_developer_portals_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE developer_portals VALIDATE CONSTRAINT fk_developer_portals_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_diagnostic_patterns_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_patterns' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY diagnostic_patterns
      ADD CONSTRAINT fk_diagnostic_patterns_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_diagnostic_patterns_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE diagnostic_patterns VALIDATE CONSTRAINT fk_diagnostic_patterns_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_diagnostic_sessions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_sessions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY diagnostic_sessions
      ADD CONSTRAINT fk_diagnostic_sessions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_diagnostic_sessions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE diagnostic_sessions VALIDATE CONSTRAINT fk_diagnostic_sessions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_digital_twins_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'digital_twins' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY digital_twins
      ADD CONSTRAINT fk_digital_twins_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_digital_twins_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE digital_twins VALIDATE CONSTRAINT fk_digital_twins_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_disaster_plans_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'disaster_plans' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY disaster_plans
      ADD CONSTRAINT fk_disaster_plans_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_disaster_plans_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE disaster_plans VALIDATE CONSTRAINT fk_disaster_plans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_do_not_disturbs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'do_not_disturbs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY do_not_disturbs
      ADD CONSTRAINT fk_do_not_disturbs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_do_not_disturbs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE do_not_disturbs VALIDATE CONSTRAINT fk_do_not_disturbs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_versions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_versions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY document_versions
      ADD CONSTRAINT fk_document_versions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_versions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE document_versions VALIDATE CONSTRAINT fk_document_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_domain_events_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_events' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY domain_events
      ADD CONSTRAINT fk_domain_events_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_domain_events_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE domain_events VALIDATE CONSTRAINT fk_domain_events_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_domain_snapshots_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_snapshots' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY domain_snapshots
      ADD CONSTRAINT fk_domain_snapshots_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_domain_snapshots_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE domain_snapshots VALIDATE CONSTRAINT fk_domain_snapshots_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_drift_reports_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drift_reports' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY drift_reports
      ADD CONSTRAINT fk_drift_reports_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_drift_reports_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE drift_reports VALIDATE CONSTRAINT fk_drift_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_dual_engines_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dual_engines' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY dual_engines
      ADD CONSTRAINT fk_dual_engines_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_dual_engines_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE dual_engines VALIDATE CONSTRAINT fk_dual_engines_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_efficiency_metrics_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_metrics' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY efficiency_metrics
      ADD CONSTRAINT fk_efficiency_metrics_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_efficiency_metrics_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE efficiency_metrics VALIDATE CONSTRAINT fk_efficiency_metrics_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_efficiency_recommendations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_recommendations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY efficiency_recommendations
      ADD CONSTRAINT fk_efficiency_recommendations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_efficiency_recommendations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE efficiency_recommendations VALIDATE CONSTRAINT fk_efficiency_recommendations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_efficiency_scores_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_scores' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY efficiency_scores
      ADD CONSTRAINT fk_efficiency_scores_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_efficiency_scores_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE efficiency_scores VALIDATE CONSTRAINT fk_efficiency_scores_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_emergency_deploys_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emergency_deploys' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY emergency_deploys
      ADD CONSTRAINT fk_emergency_deploys_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_emergency_deploys_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE emergency_deploys VALIDATE CONSTRAINT fk_emergency_deploys_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_env_lifecycles_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_lifecycles' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY env_lifecycles
      ADD CONSTRAINT fk_env_lifecycles_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_env_lifecycles_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE env_lifecycles VALIDATE CONSTRAINT fk_env_lifecycles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_env_profiles_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_profiles' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY env_profiles
      ADD CONSTRAINT fk_env_profiles_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_env_profiles_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE env_profiles VALIDATE CONSTRAINT fk_env_profiles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_environments_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'environments' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY environments
      ADD CONSTRAINT fk_environments_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_environments_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE environments VALIDATE CONSTRAINT fk_environments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ephemeral_envs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ephemeral_envs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ephemeral_envs
      ADD CONSTRAINT fk_ephemeral_envs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ephemeral_envs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ephemeral_envs VALIDATE CONSTRAINT fk_ephemeral_envs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_error_budgets_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'error_budgets' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY error_budgets
      ADD CONSTRAINT fk_error_budgets_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_error_budgets_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE error_budgets VALIDATE CONSTRAINT fk_error_budgets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_escalation_policies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escalation_policies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY escalation_policies
      ADD CONSTRAINT fk_escalation_policies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_escalation_policies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE escalation_policies VALIDATE CONSTRAINT fk_escalation_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_evaluations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evaluations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY evaluations
      ADD CONSTRAINT fk_evaluations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_evaluations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE evaluations VALIDATE CONSTRAINT fk_evaluations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_execution_control_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execution_control_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY execution_control_logs
      ADD CONSTRAINT fk_execution_control_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_execution_control_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE execution_control_logs VALIDATE CONSTRAINT fk_execution_control_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiment_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY experiment_logs
      ADD CONSTRAINT fk_experiment_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiment_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE experiment_logs VALIDATE CONSTRAINT fk_experiment_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiment_results_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_results' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY experiment_results
      ADD CONSTRAINT fk_experiment_results_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiment_results_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE experiment_results VALIDATE CONSTRAINT fk_experiment_results_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiment_runs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_runs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY experiment_runs
      ADD CONSTRAINT fk_experiment_runs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiment_runs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE experiment_runs VALIDATE CONSTRAINT fk_experiment_runs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiments_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiments' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY experiments
      ADD CONSTRAINT fk_experiments_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiments_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE experiments VALIDATE CONSTRAINT fk_experiments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_fault_injections_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fault_injections' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY fault_injections
      ADD CONSTRAINT fk_fault_injections_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_fault_injections_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE fault_injections VALIDATE CONSTRAINT fk_fault_injections_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_feature_flags_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_flags' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY feature_flags
      ADD CONSTRAINT fk_feature_flags_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_feature_flags_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE feature_flags VALIDATE CONSTRAINT fk_feature_flags_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_federated_clusters_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'federated_clusters' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY federated_clusters
      ADD CONSTRAINT fk_federated_clusters_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_federated_clusters_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE federated_clusters VALIDATE CONSTRAINT fk_federated_clusters_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_anomalies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_anomalies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY finops_anomalies
      ADD CONSTRAINT fk_finops_anomalies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_anomalies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE finops_anomalies VALIDATE CONSTRAINT fk_finops_anomalies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_budget_guards_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_budget_guards' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY finops_budget_guards
      ADD CONSTRAINT fk_finops_budget_guards_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_budget_guards_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE finops_budget_guards VALIDATE CONSTRAINT fk_finops_budget_guards_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_cost_items_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_cost_items' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY finops_cost_items
      ADD CONSTRAINT fk_finops_cost_items_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_cost_items_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE finops_cost_items VALIDATE CONSTRAINT fk_finops_cost_items_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_reports_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_reports' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY finops_reports
      ADD CONSTRAINT fk_finops_reports_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_reports_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE finops_reports VALIDATE CONSTRAINT fk_finops_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gateway_routes_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gateway_routes' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY gateway_routes
      ADD CONSTRAINT fk_gateway_routes_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gateway_routes_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE gateway_routes VALIDATE CONSTRAINT fk_gateway_routes_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_git_changelog_entries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'git_changelog_entries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY git_changelog_entries
      ADD CONSTRAINT fk_git_changelog_entries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_git_changelog_entries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE git_changelog_entries VALIDATE CONSTRAINT fk_git_changelog_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gitops_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY gitops_configs
      ADD CONSTRAINT fk_gitops_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gitops_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE gitops_configs VALIDATE CONSTRAINT fk_gitops_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gitops_sync_statuses_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_sync_statuses' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY gitops_sync_statuses
      ADD CONSTRAINT fk_gitops_sync_statuses_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gitops_sync_statuses_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE gitops_sync_statuses VALIDATE CONSTRAINT fk_gitops_sync_statuses_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_global_params_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_params' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY global_params
      ADD CONSTRAINT fk_global_params_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_global_params_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE global_params VALIDATE CONSTRAINT fk_global_params_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_governance_policies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'governance_policies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY governance_policies
      ADD CONSTRAINT fk_governance_policies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_governance_policies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE governance_policies VALIDATE CONSTRAINT fk_governance_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_handler_registries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY handler_registries
      ADD CONSTRAINT fk_handler_registries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_handler_registries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE handler_registries VALIDATE CONSTRAINT fk_handler_registries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_handler_registry_entries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registry_entries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY handler_registry_entries
      ADD CONSTRAINT fk_handler_registry_entries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_handler_registry_entries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE handler_registry_entries VALIDATE CONSTRAINT fk_handler_registry_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_healing_incidents_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'healing_incidents' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY healing_incidents
      ADD CONSTRAINT fk_healing_incidents_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_healing_incidents_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE healing_incidents VALIDATE CONSTRAINT fk_healing_incidents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_health_checks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY health_checks
      ADD CONSTRAINT fk_health_checks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_health_checks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE health_checks VALIDATE CONSTRAINT fk_health_checks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_hotfix_channels_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hotfix_channels' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY hotfix_channels
      ADD CONSTRAINT fk_hotfix_channels_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_hotfix_channels_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE hotfix_channels VALIDATE CONSTRAINT fk_hotfix_channels_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_i18n_translations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'i18n_translations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY i18n_translations
      ADD CONSTRAINT fk_i18n_translations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_i18n_translations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE i18n_translations VALIDATE CONSTRAINT fk_i18n_translations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_plans_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_plans' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY iac_plans
      ADD CONSTRAINT fk_iac_plans_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_plans_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE iac_plans VALIDATE CONSTRAINT fk_iac_plans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_resources_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_resources' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY iac_resources
      ADD CONSTRAINT fk_iac_resources_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_resources_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE iac_resources VALIDATE CONSTRAINT fk_iac_resources_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_state_versions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_state_versions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY iac_state_versions
      ADD CONSTRAINT fk_iac_state_versions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_state_versions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE iac_state_versions VALIDATE CONSTRAINT fk_iac_state_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_workspace_modules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspace_modules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY iac_workspace_modules
      ADD CONSTRAINT fk_iac_workspace_modules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_workspace_modules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE iac_workspace_modules VALIDATE CONSTRAINT fk_iac_workspace_modules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_workspaces_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspaces' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY iac_workspaces
      ADD CONSTRAINT fk_iac_workspaces_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_workspaces_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE iac_workspaces VALIDATE CONSTRAINT fk_iac_workspaces_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_inception_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inception_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY inception_configs
      ADD CONSTRAINT fk_inception_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_inception_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE inception_configs VALIDATE CONSTRAINT fk_inception_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incident_escalations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_escalations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY incident_escalations
      ADD CONSTRAINT fk_incident_escalations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incident_escalations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE incident_escalations VALIDATE CONSTRAINT fk_incident_escalations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incident_postmortems_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_postmortems' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY incident_postmortems
      ADD CONSTRAINT fk_incident_postmortems_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incident_postmortems_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE incident_postmortems VALIDATE CONSTRAINT fk_incident_postmortems_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incident_timeline_events_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_timeline_events' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY incident_timeline_events
      ADD CONSTRAINT fk_incident_timeline_events_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incident_timeline_events_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE incident_timeline_events VALIDATE CONSTRAINT fk_incident_timeline_events_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incidents_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY incidents
      ADD CONSTRAINT fk_incidents_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incidents_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE incidents VALIDATE CONSTRAINT fk_incidents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_infrastructure_connectors_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_connectors' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY infrastructure_connectors
      ADD CONSTRAINT fk_infrastructure_connectors_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_infrastructure_connectors_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE infrastructure_connectors VALIDATE CONSTRAINT fk_infrastructure_connectors_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_infrastructure_sandboxes_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_sandboxes' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY infrastructure_sandboxes
      ADD CONSTRAINT fk_infrastructure_sandboxes_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_infrastructure_sandboxes_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE infrastructure_sandboxes VALIDATE CONSTRAINT fk_infrastructure_sandboxes_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_integrations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integrations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY integrations
      ADD CONSTRAINT fk_integrations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_integrations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE integrations VALIDATE CONSTRAINT fk_integrations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_internal_libraries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'internal_libraries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY internal_libraries
      ADD CONSTRAINT fk_internal_libraries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_internal_libraries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE internal_libraries VALIDATE CONSTRAINT fk_internal_libraries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_knowledge_documents_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_documents' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY knowledge_documents
      ADD CONSTRAINT fk_knowledge_documents_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_knowledge_documents_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE knowledge_documents VALIDATE CONSTRAINT fk_knowledge_documents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_knowledge_spaces_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_spaces' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY knowledge_spaces
      ADD CONSTRAINT fk_knowledge_spaces_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_knowledge_spaces_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE knowledge_spaces VALIDATE CONSTRAINT fk_knowledge_spaces_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_knowledge_sync_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_sync_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY knowledge_sync_logs
      ADD CONSTRAINT fk_knowledge_sync_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_knowledge_sync_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE knowledge_sync_logs VALIDATE CONSTRAINT fk_knowledge_sync_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns
      ADD CONSTRAINT fk_l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns VALIDATE CONSTRAINT fk_l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_l_m_traces_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_l_m_traces' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY l_l_m_traces
      ADD CONSTRAINT fk_l_l_m_traces_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_l_m_traces_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE l_l_m_traces VALIDATE CONSTRAINT fk_l_l_m_traces_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns
      ADD CONSTRAINT fk_l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns VALIDATE CONSTRAINT fk_l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_locales_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locales' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY locales
      ADD CONSTRAINT fk_locales_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_locales_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE locales VALIDATE CONSTRAINT fk_locales_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_lowcode_flows_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_flows' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY lowcode_flows
      ADD CONSTRAINT fk_lowcode_flows_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_lowcode_flows_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE lowcode_flows VALIDATE CONSTRAINT fk_lowcode_flows_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_lowcode_instances_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_instances' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY lowcode_instances
      ADD CONSTRAINT fk_lowcode_instances_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_lowcode_instances_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE lowcode_instances VALIDATE CONSTRAINT fk_lowcode_instances_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_lowcode_workflow_definition_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_definition' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY lowcode_workflow_definition
      ADD CONSTRAINT fk_lowcode_workflow_definition_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_lowcode_workflow_definition_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE lowcode_workflow_definition VALIDATE CONSTRAINT fk_lowcode_workflow_definition_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_m_c_p_servers_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_c_p_servers' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY m_c_p_servers
      ADD CONSTRAINT fk_m_c_p_servers_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_m_c_p_servers_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE m_c_p_servers VALIDATE CONSTRAINT fk_m_c_p_servers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_m_f_a_devices_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_f_a_devices' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY m_f_a_devices
      ADD CONSTRAINT fk_m_f_a_devices_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_m_f_a_devices_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE m_f_a_devices VALIDATE CONSTRAINT fk_m_f_a_devices_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_maintenance_windows_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_windows' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY maintenance_windows
      ADD CONSTRAINT fk_maintenance_windows_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_maintenance_windows_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE maintenance_windows VALIDATE CONSTRAINT fk_maintenance_windows_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_message_queues_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_queues' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY message_queues
      ADD CONSTRAINT fk_message_queues_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_message_queues_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE message_queues VALIDATE CONSTRAINT fk_message_queues_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_metricses_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'metricses' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY metricses
      ADD CONSTRAINT fk_metricses_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_metricses_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE metricses VALIDATE CONSTRAINT fk_metricses_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_migration_plans_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'migration_plans' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY migration_plans
      ADD CONSTRAINT fk_migration_plans_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_migration_plans_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE migration_plans VALIDATE CONSTRAINT fk_migration_plans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_mock_rules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_rules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY mock_rules
      ADD CONSTRAINT fk_mock_rules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_mock_rules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE mock_rules VALIDATE CONSTRAINT fk_mock_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_model_versions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'model_versions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY model_versions
      ADD CONSTRAINT fk_model_versions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_model_versions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE model_versions VALIDATE CONSTRAINT fk_model_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_alert_rules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alert_rules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY monitoring_alert_rules
      ADD CONSTRAINT fk_monitoring_alert_rules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_alert_rules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE monitoring_alert_rules VALIDATE CONSTRAINT fk_monitoring_alert_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_alerts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alerts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY monitoring_alerts
      ADD CONSTRAINT fk_monitoring_alerts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_alerts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE monitoring_alerts VALIDATE CONSTRAINT fk_monitoring_alerts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_anomalies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_anomalies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY monitoring_anomalies
      ADD CONSTRAINT fk_monitoring_anomalies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_anomalies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE monitoring_anomalies VALIDATE CONSTRAINT fk_monitoring_anomalies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_metrics_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_metrics' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY monitoring_metrics
      ADD CONSTRAINT fk_monitoring_metrics_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_metrics_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE monitoring_metrics VALIDATE CONSTRAINT fk_monitoring_metrics_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_multi_modal_triggers_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'multi_modal_triggers' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY multi_modal_triggers
      ADD CONSTRAINT fk_multi_modal_triggers_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_multi_modal_triggers_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE multi_modal_triggers VALIDATE CONSTRAINT fk_multi_modal_triggers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_namespace_allocations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'namespace_allocations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY namespace_allocations
      ADD CONSTRAINT fk_namespace_allocations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_namespace_allocations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE namespace_allocations VALIDATE CONSTRAINT fk_namespace_allocations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_channels_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_channels' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY notification_channels
      ADD CONSTRAINT fk_notification_channels_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_channels_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE notification_channels VALIDATE CONSTRAINT fk_notification_channels_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_managements_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_managements' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY notification_managements
      ADD CONSTRAINT fk_notification_managements_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_managements_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE notification_managements VALIDATE CONSTRAINT fk_notification_managements_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_records_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_records' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY notification_records
      ADD CONSTRAINT fk_notification_records_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_records_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE notification_records VALIDATE CONSTRAINT fk_notification_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_templates_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_templates' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY notification_templates
      ADD CONSTRAINT fk_notification_templates_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_templates_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE notification_templates VALIDATE CONSTRAINT fk_notification_templates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_oci_registries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oci_registries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY oci_registries
      ADD CONSTRAINT fk_oci_registries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_oci_registries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE oci_registries VALIDATE CONSTRAINT fk_oci_registries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_oncall_schedules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_schedules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY oncall_schedules
      ADD CONSTRAINT fk_oncall_schedules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_oncall_schedules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE oncall_schedules VALIDATE CONSTRAINT fk_oncall_schedules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_otel_collector_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otel_collector_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY otel_collector_configs
      ADD CONSTRAINT fk_otel_collector_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_otel_collector_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE otel_collector_configs VALIDATE CONSTRAINT fk_otel_collector_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_p_r_test_results_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p_r_test_results' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY p_r_test_results
      ADD CONSTRAINT fk_p_r_test_results_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_p_r_test_results_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE p_r_test_results VALIDATE CONSTRAINT fk_p_r_test_results_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_page_registries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY page_registries
      ADD CONSTRAINT fk_page_registries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_page_registries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE page_registries VALIDATE CONSTRAINT fk_page_registries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_page_registry_histories_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registry_histories' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY page_registry_histories
      ADD CONSTRAINT fk_page_registry_histories_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_page_registry_histories_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE page_registry_histories VALIDATE CONSTRAINT fk_page_registry_histories_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_audit_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_audit_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY permission_audit_logs
      ADD CONSTRAINT fk_permission_audit_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_audit_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE permission_audit_logs VALIDATE CONSTRAINT fk_permission_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_requests_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_requests' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY permission_requests
      ADD CONSTRAINT fk_permission_requests_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_requests_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE permission_requests VALIDATE CONSTRAINT fk_permission_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_phase_groups_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phase_groups' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY phase_groups
      ADD CONSTRAINT fk_phase_groups_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_phase_groups_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE phase_groups VALIDATE CONSTRAINT fk_phase_groups_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_runs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_runs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY pipeline_runs
      ADD CONSTRAINT fk_pipeline_runs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_runs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE pipeline_runs VALIDATE CONSTRAINT fk_pipeline_runs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_stages_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_stages' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY pipeline_stages
      ADD CONSTRAINT fk_pipeline_stages_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_stages_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE pipeline_stages VALIDATE CONSTRAINT fk_pipeline_stages_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_tasks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_tasks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY pipeline_tasks
      ADD CONSTRAINT fk_pipeline_tasks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_tasks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE pipeline_tasks VALIDATE CONSTRAINT fk_pipeline_tasks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_templates_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_templates' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY pipeline_templates
      ADD CONSTRAINT fk_pipeline_templates_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_templates_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE pipeline_templates VALIDATE CONSTRAINT fk_pipeline_templates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_versions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_versions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY pipeline_versions
      ADD CONSTRAINT fk_pipeline_versions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_versions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE pipeline_versions VALIDATE CONSTRAINT fk_pipeline_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_playground_requests_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playground_requests' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY playground_requests
      ADD CONSTRAINT fk_playground_requests_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_playground_requests_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE playground_requests VALIDATE CONSTRAINT fk_playground_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_audit_entries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_audit_entries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY plugin_audit_entries
      ADD CONSTRAINT fk_plugin_audit_entries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_audit_entries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE plugin_audit_entries VALIDATE CONSTRAINT fk_plugin_audit_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_executions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_executions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY plugin_executions
      ADD CONSTRAINT fk_plugin_executions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_executions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE plugin_executions VALIDATE CONSTRAINT fk_plugin_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_hotreloads_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_hotreloads' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY plugin_hotreloads
      ADD CONSTRAINT fk_plugin_hotreloads_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_hotreloads_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE plugin_hotreloads VALIDATE CONSTRAINT fk_plugin_hotreloads_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_resource_quotas_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_resource_quotas' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY plugin_resource_quotas
      ADD CONSTRAINT fk_plugin_resource_quotas_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_resource_quotas_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE plugin_resource_quotas VALIDATE CONSTRAINT fk_plugin_resource_quotas_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_security_events_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_security_events' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY plugin_security_events
      ADD CONSTRAINT fk_plugin_security_events_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_security_events_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE plugin_security_events VALIDATE CONSTRAINT fk_plugin_security_events_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_tenant_quotas_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_tenant_quotas' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY plugin_tenant_quotas
      ADD CONSTRAINT fk_plugin_tenant_quotas_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_tenant_quotas_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE plugin_tenant_quotas VALIDATE CONSTRAINT fk_plugin_tenant_quotas_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugins_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugins' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY plugins
      ADD CONSTRAINT fk_plugins_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugins_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE plugins VALIDATE CONSTRAINT fk_plugins_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY policies
      ADD CONSTRAINT fk_policies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE policies VALIDATE CONSTRAINT fk_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_bundles_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_bundles' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY policy_bundles
      ADD CONSTRAINT fk_policy_bundles_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_bundles_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE policy_bundles VALIDATE CONSTRAINT fk_policy_bundles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_evaluations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_evaluations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY policy_evaluations
      ADD CONSTRAINT fk_policy_evaluations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_evaluations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE policy_evaluations VALIDATE CONSTRAINT fk_policy_evaluations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_exemptions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_exemptions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY policy_exemptions
      ADD CONSTRAINT fk_policy_exemptions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_exemptions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE policy_exemptions VALIDATE CONSTRAINT fk_policy_exemptions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_overrides_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_overrides' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY policy_overrides
      ADD CONSTRAINT fk_policy_overrides_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_overrides_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE policy_overrides VALIDATE CONSTRAINT fk_policy_overrides_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_violations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_violations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY policy_violations
      ADD CONSTRAINT fk_policy_violations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_violations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE policy_violations VALIDATE CONSTRAINT fk_policy_violations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_workflows_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_workflows' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY policy_workflows
      ADD CONSTRAINT fk_policy_workflows_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_workflows_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE policy_workflows VALIDATE CONSTRAINT fk_policy_workflows_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_portal_documents_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_documents' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY portal_documents
      ADD CONSTRAINT fk_portal_documents_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_portal_documents_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE portal_documents VALIDATE CONSTRAINT fk_portal_documents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_privacy_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'privacy_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY privacy_configs
      ADD CONSTRAINT fk_privacy_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_privacy_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE privacy_configs VALIDATE CONSTRAINT fk_privacy_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_problem_problems_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_problems' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY problem_problems
      ADD CONSTRAINT fk_problem_problems_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_problem_problems_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE problem_problems VALIDATE CONSTRAINT fk_problem_problems_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_process_steps_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'process_steps' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY process_steps
      ADD CONSTRAINT fk_process_steps_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_process_steps_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE process_steps VALIDATE CONSTRAINT fk_process_steps_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_lines_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lines' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY product_lines
      ADD CONSTRAINT fk_product_lines_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_lines_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE product_lines VALIDATE CONSTRAINT fk_product_lines_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY profiles
      ADD CONSTRAINT fk_profiles_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE profiles VALIDATE CONSTRAINT fk_profiles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_progressive_deploys_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressive_deploys' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY progressive_deploys
      ADD CONSTRAINT fk_progressive_deploys_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_progressive_deploys_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE progressive_deploys VALIDATE CONSTRAINT fk_progressive_deploys_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_progressives_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressives' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY progressives
      ADD CONSTRAINT fk_progressives_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_progressives_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE progressives VALIDATE CONSTRAINT fk_progressives_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_members_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_members' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY project_members
      ADD CONSTRAINT fk_project_members_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_members_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE project_members VALIDATE CONSTRAINT fk_project_members_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY projects
      ADD CONSTRAINT fk_projects_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE projects VALIDATE CONSTRAINT fk_projects_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pull_requests_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pull_requests' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY pull_requests
      ADD CONSTRAINT fk_pull_requests_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pull_requests_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE pull_requests VALIDATE CONSTRAINT fk_pull_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_quality_alerts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_alerts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY quality_alerts
      ADD CONSTRAINT fk_quality_alerts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_quality_alerts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE quality_alerts VALIDATE CONSTRAINT fk_quality_alerts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_quality_scan_results_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_scan_results' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY quality_scan_results
      ADD CONSTRAINT fk_quality_scan_results_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_quality_scan_results_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE quality_scan_results VALIDATE CONSTRAINT fk_quality_scan_results_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_query_execution_records_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_execution_records' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY query_execution_records
      ADD CONSTRAINT fk_query_execution_records_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_query_execution_records_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE query_execution_records VALIDATE CONSTRAINT fk_query_execution_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_queues_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queues' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY queues
      ADD CONSTRAINT fk_queues_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_queues_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE queues VALIDATE CONSTRAINT fk_queues_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_r_o_i_entries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'r_o_i_entries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY r_o_i_entries
      ADD CONSTRAINT fk_r_o_i_entries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_r_o_i_entries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE r_o_i_entries VALIDATE CONSTRAINT fk_r_o_i_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_recommendations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY recommendations
      ADD CONSTRAINT fk_recommendations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_recommendations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE recommendations VALIDATE CONSTRAINT fk_recommendations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_recording_sessions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recording_sessions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY recording_sessions
      ADD CONSTRAINT fk_recording_sessions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_recording_sessions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE recording_sessions VALIDATE CONSTRAINT fk_recording_sessions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_records_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'records' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY records
      ADD CONSTRAINT fk_records_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_records_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE records VALIDATE CONSTRAINT fk_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_release_notes_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_notes' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY release_notes
      ADD CONSTRAINT fk_release_notes_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_release_notes_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE release_notes VALIDATE CONSTRAINT fk_release_notes_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_release_trains_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_trains' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY release_trains
      ADD CONSTRAINT fk_release_trains_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_release_trains_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE release_trains VALIDATE CONSTRAINT fk_release_trains_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_replay_sessions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'replay_sessions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY replay_sessions
      ADD CONSTRAINT fk_replay_sessions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_replay_sessions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE replay_sessions VALIDATE CONSTRAINT fk_replay_sessions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_datasources_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_datasources' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY report_datasources
      ADD CONSTRAINT fk_report_datasources_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_datasources_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE report_datasources VALIDATE CONSTRAINT fk_report_datasources_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_definitions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_definitions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY report_definitions
      ADD CONSTRAINT fk_report_definitions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_definitions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE report_definitions VALIDATE CONSTRAINT fk_report_definitions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_executions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_executions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY report_executions
      ADD CONSTRAINT fk_report_executions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_executions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE report_executions VALIDATE CONSTRAINT fk_report_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_schedules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_schedules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY report_schedules
      ADD CONSTRAINT fk_report_schedules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_schedules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE report_schedules VALIDATE CONSTRAINT fk_report_schedules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reports_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY reports
      ADD CONSTRAINT fk_reports_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reports_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE reports VALIDATE CONSTRAINT fk_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resilience_benchmarks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_benchmarks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY resilience_benchmarks
      ADD CONSTRAINT fk_resilience_benchmarks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resilience_benchmarks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE resilience_benchmarks VALIDATE CONSTRAINT fk_resilience_benchmarks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resilience_histories_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_histories' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY resilience_histories
      ADD CONSTRAINT fk_resilience_histories_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resilience_histories_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE resilience_histories VALIDATE CONSTRAINT fk_resilience_histories_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resilience_recommendations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_recommendations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY resilience_recommendations
      ADD CONSTRAINT fk_resilience_recommendations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resilience_recommendations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE resilience_recommendations VALIDATE CONSTRAINT fk_resilience_recommendations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_response_history_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'response_history' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY response_history
      ADD CONSTRAINT fk_response_history_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_response_history_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE response_history VALIDATE CONSTRAINT fk_response_history_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_retention_policies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retention_policies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY retention_policies
      ADD CONSTRAINT fk_retention_policies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_retention_policies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE retention_policies VALIDATE CONSTRAINT fk_retention_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_review_requests_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_requests' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY review_requests
      ADD CONSTRAINT fk_review_requests_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_review_requests_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE review_requests VALIDATE CONSTRAINT fk_review_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reviews_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY reviews
      ADD CONSTRAINT fk_reviews_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reviews_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE reviews VALIDATE CONSTRAINT fk_reviews_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_risks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY risks
      ADD CONSTRAINT fk_risks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_risks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE risks VALIDATE CONSTRAINT fk_risks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_roi_entries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roi_entries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY roi_entries
      ADD CONSTRAINT fk_roi_entries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_roi_entries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE roi_entries VALIDATE CONSTRAINT fk_roi_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rollbacks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rollbacks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY rollbacks
      ADD CONSTRAINT fk_rollbacks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rollbacks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE rollbacks VALIDATE CONSTRAINT fk_rollbacks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_runbooks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runbooks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY runbooks
      ADD CONSTRAINT fk_runbooks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_runbooks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE runbooks VALIDATE CONSTRAINT fk_runbooks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_runs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY runs
      ADD CONSTRAINT fk_runs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_runs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE runs VALIDATE CONSTRAINT fk_runs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_b_o_m_documents_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_m_documents' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY s_b_o_m_documents
      ADD CONSTRAINT fk_s_b_o_m_documents_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_b_o_m_documents_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE s_b_o_m_documents VALIDATE CONSTRAINT fk_s_b_o_m_documents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_b_o_ms_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_ms' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY s_b_o_ms
      ADD CONSTRAINT fk_s_b_o_ms_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_b_o_ms_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE s_b_o_ms VALIDATE CONSTRAINT fk_s_b_o_ms_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_l_i_measurements_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_i_measurements' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY s_l_i_measurements
      ADD CONSTRAINT fk_s_l_i_measurements_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_l_i_measurements_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE s_l_i_measurements VALIDATE CONSTRAINT fk_s_l_i_measurements_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_l_o_definitions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_o_definitions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY s_l_o_definitions
      ADD CONSTRAINT fk_s_l_o_definitions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_l_o_definitions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE s_l_o_definitions VALIDATE CONSTRAINT fk_s_l_o_definitions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_e_log_event_records_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_log_event_records' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY s_s_e_log_event_records
      ADD CONSTRAINT fk_s_s_e_log_event_records_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_e_log_event_records_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE s_s_e_log_event_records VALIDATE CONSTRAINT fk_s_s_e_log_event_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_e_status_event_records_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_status_event_records' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY s_s_e_status_event_records
      ADD CONSTRAINT fk_s_s_e_status_event_records_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_e_status_event_records_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE s_s_e_status_event_records VALIDATE CONSTRAINT fk_s_s_e_status_event_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_o_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY s_s_o_configs
      ADD CONSTRAINT fk_s_s_o_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_o_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE s_s_o_configs VALIDATE CONSTRAINT fk_s_s_o_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_o_providers_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_providers' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY s_s_o_providers
      ADD CONSTRAINT fk_s_s_o_providers_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_o_providers_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE s_s_o_providers VALIDATE CONSTRAINT fk_s_s_o_providers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_saga_instances_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_instances' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY saga_instances
      ADD CONSTRAINT fk_saga_instances_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_saga_instances_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE saga_instances VALIDATE CONSTRAINT fk_saga_instances_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_saga_steps_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_steps' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY saga_steps
      ADD CONSTRAINT fk_saga_steps_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_saga_steps_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE saga_steps VALIDATE CONSTRAINT fk_saga_steps_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_saga_transactions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_transactions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY saga_transactions
      ADD CONSTRAINT fk_saga_transactions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_saga_transactions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE saga_transactions VALIDATE CONSTRAINT fk_saga_transactions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scan_reports_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_reports' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY scan_reports
      ADD CONSTRAINT fk_scan_reports_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scan_reports_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE scan_reports VALIDATE CONSTRAINT fk_scan_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scheduled_notifications_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_notifications' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY scheduled_notifications
      ADD CONSTRAINT fk_scheduled_notifications_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scheduled_notifications_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE scheduled_notifications VALIDATE CONSTRAINT fk_scheduled_notifications_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scheduling_policies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduling_policies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY scheduling_policies
      ADD CONSTRAINT fk_scheduling_policies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scheduling_policies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE scheduling_policies VALIDATE CONSTRAINT fk_scheduling_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_script_libraries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_libraries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY script_libraries
      ADD CONSTRAINT fk_script_libraries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_script_libraries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE script_libraries VALIDATE CONSTRAINT fk_script_libraries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_script_templates_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_templates' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY script_templates
      ADD CONSTRAINT fk_script_templates_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_script_templates_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE script_templates VALIDATE CONSTRAINT fk_script_templates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_script_versions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_versions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY script_versions
      ADD CONSTRAINT fk_script_versions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_script_versions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE script_versions VALIDATE CONSTRAINT fk_script_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scripts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY scripts
      ADD CONSTRAINT fk_scripts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scripts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE scripts VALIDATE CONSTRAINT fk_scripts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sdk_tasks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sdk_tasks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY sdk_tasks
      ADD CONSTRAINT fk_sdk_tasks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sdk_tasks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE sdk_tasks VALIDATE CONSTRAINT fk_sdk_tasks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_secrets_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'secrets' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY secrets
      ADD CONSTRAINT fk_secrets_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_secrets_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE secrets VALIDATE CONSTRAINT fk_secrets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_self_services_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'self_services' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY self_services
      ADD CONSTRAINT fk_self_services_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_self_services_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE self_services VALIDATE CONSTRAINT fk_self_services_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_deployments_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_deployments' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY serverless_deployments
      ADD CONSTRAINT fk_serverless_deployments_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_deployments_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE serverless_deployments VALIDATE CONSTRAINT fk_serverless_deployments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_function_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_function_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY serverless_function_logs
      ADD CONSTRAINT fk_serverless_function_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_function_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE serverless_function_logs VALIDATE CONSTRAINT fk_serverless_function_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_functions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_functions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY serverless_functions
      ADD CONSTRAINT fk_serverless_functions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_functions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE serverless_functions VALIDATE CONSTRAINT fk_serverless_functions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_triggers_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_triggers' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY serverless_triggers
      ADD CONSTRAINT fk_serverless_triggers_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_triggers_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE serverless_triggers VALIDATE CONSTRAINT fk_serverless_triggers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_catalogs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_catalogs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY service_catalogs
      ADD CONSTRAINT fk_service_catalogs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_catalogs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE service_catalogs VALIDATE CONSTRAINT fk_service_catalogs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_healths_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_healths' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY service_healths
      ADD CONSTRAINT fk_service_healths_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_healths_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE service_healths VALIDATE CONSTRAINT fk_service_healths_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_registries_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_registries' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY service_registries
      ADD CONSTRAINT fk_service_registries_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_registries_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE service_registries VALIDATE CONSTRAINT fk_service_registries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_topologies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_topologies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY service_topologies
      ADD CONSTRAINT fk_service_topologies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_topologies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE service_topologies VALIDATE CONSTRAINT fk_service_topologies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_simulations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY simulations
      ADD CONSTRAINT fk_simulations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_simulations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE simulations VALIDATE CONSTRAINT fk_simulations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_audit_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_audit_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY skill_audit_logs
      ADD CONSTRAINT fk_skill_audit_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_audit_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE skill_audit_logs VALIDATE CONSTRAINT fk_skill_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_executions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_executions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY skill_executions
      ADD CONSTRAINT fk_skill_executions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_executions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE skill_executions VALIDATE CONSTRAINT fk_skill_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_instances_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_instances' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY skill_instances
      ADD CONSTRAINT fk_skill_instances_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_instances_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE skill_instances VALIDATE CONSTRAINT fk_skill_instances_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_reviews_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_reviews' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY skill_reviews
      ADD CONSTRAINT fk_skill_reviews_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_reviews_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE skill_reviews VALIDATE CONSTRAINT fk_skill_reviews_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skills_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skills' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY skills
      ADD CONSTRAINT fk_skills_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skills_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE skills VALIDATE CONSTRAINT fk_skills_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sla_breach_events_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_breach_events' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY sla_breach_events
      ADD CONSTRAINT fk_sla_breach_events_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sla_breach_events_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE sla_breach_events VALIDATE CONSTRAINT fk_sla_breach_events_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sla_definitions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_definitions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY sla_definitions
      ADD CONSTRAINT fk_sla_definitions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sla_definitions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE sla_definitions VALIDATE CONSTRAINT fk_sla_definitions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sla_trackings_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_trackings' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY sla_trackings
      ADD CONSTRAINT fk_sla_trackings_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sla_trackings_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE sla_trackings VALIDATE CONSTRAINT fk_sla_trackings_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_smart_deploy_audit_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_audit' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY smart_deploy_audit
      ADD CONSTRAINT fk_smart_deploy_audit_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_smart_deploy_audit_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE smart_deploy_audit VALIDATE CONSTRAINT fk_smart_deploy_audit_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_smart_deploy_deployments_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_deployments' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY smart_deploy_deployments
      ADD CONSTRAINT fk_smart_deploy_deployments_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_smart_deploy_deployments_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE smart_deploy_deployments VALIDATE CONSTRAINT fk_smart_deploy_deployments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_smart_deploy_rollbacks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_rollbacks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY smart_deploy_rollbacks
      ADD CONSTRAINT fk_smart_deploy_rollbacks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_smart_deploy_rollbacks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE smart_deploy_rollbacks VALIDATE CONSTRAINT fk_smart_deploy_rollbacks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_snapshots_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY snapshots
      ADD CONSTRAINT fk_snapshots_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_snapshots_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE snapshots VALIDATE CONSTRAINT fk_snapshots_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sprint_tickets_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprint_tickets' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY sprint_tickets
      ADD CONSTRAINT fk_sprint_tickets_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sprint_tickets_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE sprint_tickets VALIDATE CONSTRAINT fk_sprint_tickets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sprints_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprints' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY sprints
      ADD CONSTRAINT fk_sprints_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sprints_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE sprints VALIDATE CONSTRAINT fk_sprints_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_audit_history_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_audit_history' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY sql_audit_history
      ADD CONSTRAINT fk_sql_audit_history_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_audit_history_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE sql_audit_history VALIDATE CONSTRAINT fk_sql_audit_history_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_blacklist_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_blacklist' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY sql_blacklist
      ADD CONSTRAINT fk_sql_blacklist_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_blacklist_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE sql_blacklist VALIDATE CONSTRAINT fk_sql_blacklist_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_orders_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_orders' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY sql_orders
      ADD CONSTRAINT fk_sql_orders_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_orders_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE sql_orders VALIDATE CONSTRAINT fk_sql_orders_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_stages_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stages' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY stages
      ADD CONSTRAINT fk_stages_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_stages_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE stages VALIDATE CONSTRAINT fk_stages_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subapp_config_histories_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_config_histories' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY subapp_config_histories
      ADD CONSTRAINT fk_subapp_config_histories_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subapp_config_histories_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE subapp_config_histories VALIDATE CONSTRAINT fk_subapp_config_histories_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subapp_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY subapp_configs
      ADD CONSTRAINT fk_subapp_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subapp_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE subapp_configs VALIDATE CONSTRAINT fk_subapp_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY subscriptions
      ADD CONSTRAINT fk_subscriptions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE subscriptions VALIDATE CONSTRAINT fk_subscriptions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY tasks
      ADD CONSTRAINT fk_tasks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE tasks VALIDATE CONSTRAINT fk_tasks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_members_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY team_members
      ADD CONSTRAINT fk_team_members_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_members_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE team_members VALIDATE CONSTRAINT fk_team_members_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_roles_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_roles' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY team_roles
      ADD CONSTRAINT fk_team_roles_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_roles_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE team_roles VALIDATE CONSTRAINT fk_team_roles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_teams_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY teams
      ADD CONSTRAINT fk_teams_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_teams_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE teams VALIDATE CONSTRAINT fk_teams_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_temporary_permissions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY temporary_permissions
      ADD CONSTRAINT fk_temporary_permissions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_temporary_permissions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE temporary_permissions VALIDATE CONSTRAINT fk_temporary_permissions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_invites_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_invites' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY tenant_invites
      ADD CONSTRAINT fk_tenant_invites_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_invites_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE tenant_invites VALIDATE CONSTRAINT fk_tenant_invites_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_quota_alerts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quota_alerts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY tenant_quota_alerts
      ADD CONSTRAINT fk_tenant_quota_alerts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_quota_alerts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE tenant_quota_alerts VALIDATE CONSTRAINT fk_tenant_quota_alerts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_quotas_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quotas' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY tenant_quotas
      ADD CONSTRAINT fk_tenant_quotas_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_quotas_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE tenant_quotas VALIDATE CONSTRAINT fk_tenant_quotas_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_users_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_users' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY tenant_users
      ADD CONSTRAINT fk_tenant_users_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_users_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE tenant_users VALIDATE CONSTRAINT fk_tenant_users_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_cases_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_cases' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY test_cases
      ADD CONSTRAINT fk_test_cases_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_cases_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE test_cases VALIDATE CONSTRAINT fk_test_cases_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_code_mappings_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_code_mappings' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY test_code_mappings
      ADD CONSTRAINT fk_test_code_mappings_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_code_mappings_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE test_code_mappings VALIDATE CONSTRAINT fk_test_code_mappings_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_execution_records_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_execution_records' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY test_execution_records
      ADD CONSTRAINT fk_test_execution_records_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_execution_records_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE test_execution_records VALIDATE CONSTRAINT fk_test_execution_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_suites_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_suites' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY test_suites
      ADD CONSTRAINT fk_test_suites_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_suites_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE test_suites VALIDATE CONSTRAINT fk_test_suites_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_assignment_rules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignment_rules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_assignment_rules
      ADD CONSTRAINT fk_ticket_assignment_rules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_assignment_rules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_assignment_rules VALIDATE CONSTRAINT fk_ticket_assignment_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_assignments_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignments' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_assignments
      ADD CONSTRAINT fk_ticket_assignments_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_assignments_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_assignments VALIDATE CONSTRAINT fk_ticket_assignments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_automation_rules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_automation_rules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_automation_rules
      ADD CONSTRAINT fk_ticket_automation_rules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_automation_rules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_automation_rules VALIDATE CONSTRAINT fk_ticket_automation_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_dispatch_engineers_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_engineers' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_dispatch_engineers
      ADD CONSTRAINT fk_ticket_dispatch_engineers_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_dispatch_engineers_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_dispatch_engineers VALIDATE CONSTRAINT fk_ticket_dispatch_engineers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_dispatch_rules_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_rules' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_dispatch_rules
      ADD CONSTRAINT fk_ticket_dispatch_rules_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_dispatch_rules_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_dispatch_rules VALIDATE CONSTRAINT fk_ticket_dispatch_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_knowledges_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_knowledges' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_knowledges
      ADD CONSTRAINT fk_ticket_knowledges_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_knowledges_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_knowledges VALIDATE CONSTRAINT fk_ticket_knowledges_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_relations_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_relations' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_relations
      ADD CONSTRAINT fk_ticket_relations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_relations_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_relations VALIDATE CONSTRAINT fk_ticket_relations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_sla_policies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_policies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_sla_policies
      ADD CONSTRAINT fk_ticket_sla_policies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_sla_policies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_sla_policies VALIDATE CONSTRAINT fk_ticket_sla_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_sla_targets_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_targets' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_sla_targets
      ADD CONSTRAINT fk_ticket_sla_targets_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_sla_targets_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_sla_targets VALIDATE CONSTRAINT fk_ticket_sla_targets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_suspends_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_suspends' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_suspends
      ADD CONSTRAINT fk_ticket_suspends_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_suspends_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_suspends VALIDATE CONSTRAINT fk_ticket_suspends_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticketing_dispatch_weights_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_dispatch_weights' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticketing_dispatch_weights
      ADD CONSTRAINT fk_ticketing_dispatch_weights_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticketing_dispatch_weights_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticketing_dispatch_weights VALIDATE CONSTRAINT fk_ticketing_dispatch_weights_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticketing_service_state_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_service_state' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticketing_service_state
      ADD CONSTRAINT fk_ticketing_service_state_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticketing_service_state_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE ticketing_service_state VALIDATE CONSTRAINT fk_ticketing_service_state_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY tickets
      ADD CONSTRAINT fk_tickets_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE tickets VALIDATE CONSTRAINT fk_tickets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_topologies_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topologies' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY topologies
      ADD CONSTRAINT fk_topologies_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_topologies_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE topologies VALIDATE CONSTRAINT fk_topologies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_trace_sampling_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_sampling_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY trace_sampling_configs
      ADD CONSTRAINT fk_trace_sampling_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_trace_sampling_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE trace_sampling_configs VALIDATE CONSTRAINT fk_trace_sampling_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_trace_spans_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_spans' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY trace_spans
      ADD CONSTRAINT fk_trace_spans_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_trace_spans_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE trace_spans VALIDATE CONSTRAINT fk_trace_spans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_traffic_records_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traffic_records' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY traffic_records
      ADD CONSTRAINT fk_traffic_records_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_traffic_records_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE traffic_records VALIDATE CONSTRAINT fk_traffic_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_trigger_logs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trigger_logs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY trigger_logs
      ADD CONSTRAINT fk_trigger_logs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_trigger_logs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE trigger_logs VALIDATE CONSTRAINT fk_trigger_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_alerts_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_alerts' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY u_e_b_a_alerts
      ADD CONSTRAINT fk_u_e_b_a_alerts_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_alerts_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE u_e_b_a_alerts VALIDATE CONSTRAINT fk_u_e_b_a_alerts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_profiles_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_profiles' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY u_e_b_a_profiles
      ADD CONSTRAINT fk_u_e_b_a_profiles_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_profiles_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE u_e_b_a_profiles VALIDATE CONSTRAINT fk_u_e_b_a_profiles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_unified_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY unified_configs
      ADD CONSTRAINT fk_unified_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_unified_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE unified_configs VALIDATE CONSTRAINT fk_unified_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_upload_tasks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'upload_tasks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY upload_tasks
      ADD CONSTRAINT fk_upload_tasks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_upload_tasks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE upload_tasks VALIDATE CONSTRAINT fk_upload_tasks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_usage_limits_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_limits' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY usage_limits
      ADD CONSTRAINT fk_usage_limits_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_usage_limits_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE usage_limits VALIDATE CONSTRAINT fk_usage_limits_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_usage_records_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_records' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY usage_records
      ADD CONSTRAINT fk_usage_records_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_usage_records_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE usage_records VALIDATE CONSTRAINT fk_usage_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_vector_stores_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vector_stores' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY vector_stores
      ADD CONSTRAINT fk_vector_stores_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_vector_stores_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE vector_stores VALIDATE CONSTRAINT fk_vector_stores_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_vectorize_ruleses_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vectorize_ruleses' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY vectorize_ruleses
      ADD CONSTRAINT fk_vectorize_ruleses_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_vectorize_ruleses_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE vectorize_ruleses VALIDATE CONSTRAINT fk_vectorize_ruleses_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_version_archives_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'version_archives' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY version_archives
      ADD CONSTRAINT fk_version_archives_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_version_archives_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE version_archives VALIDATE CONSTRAINT fk_version_archives_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_versions_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'versions' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY versions
      ADD CONSTRAINT fk_versions_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_versions_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE versions VALIDATE CONSTRAINT fk_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_webhooks_secrets_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhooks_secrets' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY webhooks_secrets
      ADD CONSTRAINT fk_webhooks_secrets_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_webhooks_secrets_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE webhooks_secrets VALIDATE CONSTRAINT fk_webhooks_secrets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_widget_configs_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'widget_configs' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY widget_configs
      ADD CONSTRAINT fk_widget_configs_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_widget_configs_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE widget_configs VALIDATE CONSTRAINT fk_widget_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_workbenches_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbenches' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY workbenches
      ADD CONSTRAINT fk_workbenches_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_workbenches_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE workbenches VALIDATE CONSTRAINT fk_workbenches_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_workflow_tasks_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_tasks' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY workflow_tasks
      ADD CONSTRAINT fk_workflow_tasks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_workflow_tasks_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE workflow_tasks VALIDATE CONSTRAINT fk_workflow_tasks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_workflow_triggers_tenant'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_triggers' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY workflow_triggers
      ADD CONSTRAINT fk_workflow_triggers_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_workflow_triggers_tenant' AND convalidated = false
  ) THEN
    ALTER TABLE workflow_triggers VALIDATE CONSTRAINT fk_workflow_triggers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY audit_logs
      ADD CONSTRAINT fk_audit_logs_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_user' AND convalidated = false
  ) THEN
    ALTER TABLE audit_logs VALIDATE CONSTRAINT fk_audit_logs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_capability_audit_logs_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_audit_logs' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY capability_audit_logs
      ADD CONSTRAINT fk_capability_audit_logs_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_capability_audit_logs_user' AND convalidated = false
  ) THEN
    ALTER TABLE capability_audit_logs VALIDATE CONSTRAINT fk_capability_audit_logs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_alert_states_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_alert_states' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_alert_states
      ADD CONSTRAINT fk_chatops_alert_states_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_alert_states_user' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_alert_states VALIDATE CONSTRAINT fk_chatops_alert_states_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_audit_logs_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_audit_logs' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_audit_logs
      ADD CONSTRAINT fk_chatops_audit_logs_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_audit_logs_user' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_audit_logs VALIDATE CONSTRAINT fk_chatops_audit_logs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_configs_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_command_configs
      ADD CONSTRAINT fk_chatops_command_configs_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_configs_user' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_command_configs VALIDATE CONSTRAINT fk_chatops_command_configs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_dnd_settings_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_dnd_settings
      ADD CONSTRAINT fk_chatops_dnd_settings_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_dnd_settings_user' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_dnd_settings VALIDATE CONSTRAINT fk_chatops_dnd_settings_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_executions_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_executions' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_executions
      ADD CONSTRAINT fk_chatops_executions_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_executions_user' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_executions VALIDATE CONSTRAINT fk_chatops_executions_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_messages_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_messages' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_messages
      ADD CONSTRAINT fk_chatops_messages_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_messages_user' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_messages VALIDATE CONSTRAINT fk_chatops_messages_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_notification_preferences_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_notification_preferences' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_notification_preferences
      ADD CONSTRAINT fk_chatops_notification_preferences_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_notification_preferences_user' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_notification_preferences VALIDATE CONSTRAINT fk_chatops_notification_preferences_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_platform_configs_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_platform_configs
      ADD CONSTRAINT fk_chatops_platform_configs_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_platform_configs_user' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_platform_configs VALIDATE CONSTRAINT fk_chatops_platform_configs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_question_configs_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_question_configs
      ADD CONSTRAINT fk_chatops_question_configs_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_question_configs_user' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_question_configs VALIDATE CONSTRAINT fk_chatops_question_configs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_sessions_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_sessions' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY chatops_sessions
      ADD CONSTRAINT fk_chatops_sessions_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_sessions_user' AND convalidated = false
  ) THEN
    ALTER TABLE chatops_sessions VALIDATE CONSTRAINT fk_chatops_sessions_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_comments_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY comments
      ADD CONSTRAINT fk_comments_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_comments_user' AND convalidated = false
  ) THEN
    ALTER TABLE comments VALIDATE CONSTRAINT fk_comments_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_audit_entries_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_audit_entries' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY config_audit_entries
      ADD CONSTRAINT fk_config_audit_entries_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_audit_entries_user' AND convalidated = false
  ) THEN
    ALTER TABLE config_audit_entries VALIDATE CONSTRAINT fk_config_audit_entries_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deploy_audit_entries_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_audit_entries' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY deploy_audit_entries
      ADD CONSTRAINT fk_deploy_audit_entries_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deploy_audit_entries_user' AND convalidated = false
  ) THEN
    ALTER TABLE deploy_audit_entries VALIDATE CONSTRAINT fk_deploy_audit_entries_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_do_not_disturbs_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'do_not_disturbs' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY do_not_disturbs
      ADD CONSTRAINT fk_do_not_disturbs_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_do_not_disturbs_user' AND convalidated = false
  ) THEN
    ALTER TABLE do_not_disturbs VALIDATE CONSTRAINT fk_do_not_disturbs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_l_m_traces_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_l_m_traces' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY l_l_m_traces
      ADD CONSTRAINT fk_l_l_m_traces_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_l_m_traces_user' AND convalidated = false
  ) THEN
    ALTER TABLE l_l_m_traces VALIDATE CONSTRAINT fk_l_l_m_traces_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_m_f_a_devices_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_f_a_devices' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY m_f_a_devices
      ADD CONSTRAINT fk_m_f_a_devices_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_m_f_a_devices_user' AND convalidated = false
  ) THEN
    ALTER TABLE m_f_a_devices VALIDATE CONSTRAINT fk_m_f_a_devices_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_templates_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_templates' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY notification_templates
      ADD CONSTRAINT fk_notification_templates_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_templates_user' AND convalidated = false
  ) THEN
    ALTER TABLE notification_templates VALIDATE CONSTRAINT fk_notification_templates_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_audit_logs_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_audit_logs' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY permission_audit_logs
      ADD CONSTRAINT fk_permission_audit_logs_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_audit_logs_user' AND convalidated = false
  ) THEN
    ALTER TABLE permission_audit_logs VALIDATE CONSTRAINT fk_permission_audit_logs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_requests_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_requests' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY permission_requests
      ADD CONSTRAINT fk_permission_requests_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_requests_user' AND convalidated = false
  ) THEN
    ALTER TABLE permission_requests VALIDATE CONSTRAINT fk_permission_requests_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_playground_requests_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playground_requests' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY playground_requests
      ADD CONSTRAINT fk_playground_requests_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_playground_requests_user' AND convalidated = false
  ) THEN
    ALTER TABLE playground_requests VALIDATE CONSTRAINT fk_playground_requests_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policies_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policies' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY policies
      ADD CONSTRAINT fk_policies_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policies_user' AND convalidated = false
  ) THEN
    ALTER TABLE policies VALIDATE CONSTRAINT fk_policies_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_workflows_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_workflows' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY policy_workflows
      ADD CONSTRAINT fk_policy_workflows_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_workflows_user' AND convalidated = false
  ) THEN
    ALTER TABLE policy_workflows VALIDATE CONSTRAINT fk_policy_workflows_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_members_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_members' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY project_members
      ADD CONSTRAINT fk_project_members_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_members_user' AND convalidated = false
  ) THEN
    ALTER TABLE project_members VALIDATE CONSTRAINT fk_project_members_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_query_execution_records_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_execution_records' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY query_execution_records
      ADD CONSTRAINT fk_query_execution_records_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_query_execution_records_user' AND convalidated = false
  ) THEN
    ALTER TABLE query_execution_records VALIDATE CONSTRAINT fk_query_execution_records_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reviews_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY reviews
      ADD CONSTRAINT fk_reviews_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reviews_user' AND convalidated = false
  ) THEN
    ALTER TABLE reviews VALIDATE CONSTRAINT fk_reviews_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scheduled_notifications_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_notifications' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY scheduled_notifications
      ADD CONSTRAINT fk_scheduled_notifications_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scheduled_notifications_user' AND convalidated = false
  ) THEN
    ALTER TABLE scheduled_notifications VALIDATE CONSTRAINT fk_scheduled_notifications_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_audit_logs_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_audit_logs' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY skill_audit_logs
      ADD CONSTRAINT fk_skill_audit_logs_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_audit_logs_user' AND convalidated = false
  ) THEN
    ALTER TABLE skill_audit_logs VALIDATE CONSTRAINT fk_skill_audit_logs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_executions_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_executions' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY skill_executions
      ADD CONSTRAINT fk_skill_executions_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_executions_user' AND convalidated = false
  ) THEN
    ALTER TABLE skill_executions VALIDATE CONSTRAINT fk_skill_executions_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_orders_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_orders' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY sql_orders
      ADD CONSTRAINT fk_sql_orders_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_orders_user' AND convalidated = false
  ) THEN
    ALTER TABLE sql_orders VALIDATE CONSTRAINT fk_sql_orders_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY subscriptions
      ADD CONSTRAINT fk_subscriptions_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_user' AND convalidated = false
  ) THEN
    ALTER TABLE subscriptions VALIDATE CONSTRAINT fk_subscriptions_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_members_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY team_members
      ADD CONSTRAINT fk_team_members_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_members_user' AND convalidated = false
  ) THEN
    ALTER TABLE team_members VALIDATE CONSTRAINT fk_team_members_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_temporary_permissions_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY temporary_permissions
      ADD CONSTRAINT fk_temporary_permissions_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_temporary_permissions_user' AND convalidated = false
  ) THEN
    ALTER TABLE temporary_permissions VALIDATE CONSTRAINT fk_temporary_permissions_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_users_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_users' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY tenant_users
      ADD CONSTRAINT fk_tenant_users_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_users_user' AND convalidated = false
  ) THEN
    ALTER TABLE tenant_users VALIDATE CONSTRAINT fk_tenant_users_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_dispatch_engineers_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_engineers' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_dispatch_engineers
      ADD CONSTRAINT fk_ticket_dispatch_engineers_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_dispatch_engineers_user' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_dispatch_engineers VALIDATE CONSTRAINT fk_ticket_dispatch_engineers_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_transfers_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_transfers' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_transfers
      ADD CONSTRAINT fk_ticket_transfers_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_transfers_user' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_transfers VALIDATE CONSTRAINT fk_ticket_transfers_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_workflow_history_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_workflow_history' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY ticket_workflow_history
      ADD CONSTRAINT fk_ticket_workflow_history_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_workflow_history_user' AND convalidated = false
  ) THEN
    ALTER TABLE ticket_workflow_history VALIDATE CONSTRAINT fk_ticket_workflow_history_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_alerts_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_alerts' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY u_e_b_a_alerts
      ADD CONSTRAINT fk_u_e_b_a_alerts_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_alerts_user' AND convalidated = false
  ) THEN
    ALTER TABLE u_e_b_a_alerts VALIDATE CONSTRAINT fk_u_e_b_a_alerts_user;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_profiles_user'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_profiles' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE ONLY u_e_b_a_profiles
      ADD CONSTRAINT fk_u_e_b_a_profiles_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_profiles_user' AND convalidated = false
  ) THEN
    ALTER TABLE u_e_b_a_profiles VALIDATE CONSTRAINT fk_u_e_b_a_profiles_user;
  END IF;
END $$;

-- Migration complete
SELECT 'Added 444 foreign key constraints' AS migration_result;

COMMIT;
