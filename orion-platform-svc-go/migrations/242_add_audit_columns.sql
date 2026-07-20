-- Migration: 242_add_audit_columns.sql
-- Description: Add unified audit columns (created_by, updated_by, created_at, updated_at)
-- Phase: 5.6
-- Impact:
--   created_by: 390 tables
--   updated_by: 438 tables
--   created_at: 34 tables
--   updated_at: 145 tables
-- Notes: created_by/updated_by are UUID FK references to users(id)
--         created_at/updated_at default to NOW()

BEGIN;

-- Table: a_b_a_c_policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_b_a_c_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE a_b_a_c_policies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN a_b_a_c_policies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_b_a_c_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE a_b_a_c_policies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN a_b_a_c_policies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: a_i_agents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_agents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE a_i_agents ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN a_i_agents.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: a_i_decisions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_decisions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE a_i_decisions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN a_i_decisions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: a_i_models
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_models' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE a_i_models ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN a_i_models.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: agent_audit_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE agent_audit_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN agent_audit_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE agent_audit_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN agent_audit_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: agents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE agents ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN agents.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: ai_decision_feedback
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_feedback' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ai_decision_feedback ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ai_decision_feedback.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_feedback' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ai_decision_feedback ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ai_decision_feedback.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ai_decision_traces
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ai_decision_traces ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ai_decision_traces.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ai_decision_traces ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ai_decision_traces.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE ai_decision_traces ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ai_decision_traces.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ai_decision_traces ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ai_decision_traces.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ai_decisions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decisions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ai_decisions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ai_decisions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decisions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ai_decisions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ai_decisions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ai_gateway_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_gateway_requests' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ai_gateway_requests ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ai_gateway_requests.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_gateway_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ai_gateway_requests ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ai_gateway_requests.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_gateway_requests' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ai_gateway_requests ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ai_gateway_requests.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: alert_breakers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_breakers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alert_breakers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alert_breakers.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_breakers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alert_breakers ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alert_breakers.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: alert_known_issues
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_known_issues' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alert_known_issues ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alert_known_issues.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_known_issues' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alert_known_issues ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alert_known_issues.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: alert_maintenance_windows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_maintenance_windows' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alert_maintenance_windows ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alert_maintenance_windows.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_maintenance_windows' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alert_maintenance_windows ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alert_maintenance_windows.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_maintenance_windows' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE alert_maintenance_windows ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN alert_maintenance_windows.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: alert_node_health
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_node_health' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alert_node_health ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alert_node_health.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_node_health' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alert_node_health ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alert_node_health.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_node_health' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE alert_node_health ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN alert_node_health.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_node_health' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE alert_node_health ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN alert_node_health.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: alert_topologies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_topologies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alert_topologies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alert_topologies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_topologies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alert_topologies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alert_topologies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: alerts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alerts ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alerts.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alerts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN alerts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: analysises
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysises' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE analysises ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN analysises.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysises' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE analysises ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN analysises.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: api_consumptions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_consumptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_consumptions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_consumptions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_consumptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_consumptions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_consumptions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_consumptions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_consumptions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN api_consumptions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: api_contracts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_contracts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_contracts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_contracts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: api_governance_contracts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_contracts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_governance_contracts ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_governance_contracts.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_contracts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_governance_contracts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_governance_contracts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: api_governance_rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_governance_rules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_governance_rules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_governance_rules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_governance_rules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: api_governance_verification_history
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_verification_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_governance_verification_history ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_governance_verification_history.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_verification_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_governance_verification_history ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_governance_verification_history.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_verification_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_governance_verification_history ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN api_governance_verification_history.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: api_governance_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_governance_versions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_governance_versions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_governance_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_governance_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_governance_versions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN api_governance_versions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: api_governance_violations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_violations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_governance_violations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_governance_violations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_violations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_governance_violations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_governance_violations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_violations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_governance_violations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN api_governance_violations.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: api_keys
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_keys.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_keys.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: api_market_apps
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_apps' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_market_apps ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_market_apps.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_apps' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_market_apps ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_market_apps.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_apps' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_market_apps ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN api_market_apps.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: api_market_keys
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_keys' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_market_keys ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_market_keys.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_keys' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_market_keys ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_market_keys.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_keys' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_market_keys ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN api_market_keys.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: api_market_products
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_products' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_market_products ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_market_products.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_products' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_market_products ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_market_products.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_products' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_market_products ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN api_market_products.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: api_market_subscriptions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_subscriptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_market_subscriptions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_market_subscriptions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_subscriptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_market_subscriptions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN api_market_subscriptions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_subscriptions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_market_subscriptions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN api_market_subscriptions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: apk_upload_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apk_upload_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE apk_upload_records ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN apk_upload_records.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apk_upload_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE apk_upload_records ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN apk_upload_records.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: apm_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apm_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE apm_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN apm_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apm_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE apm_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN apm_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: approval_gates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_gates' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE approval_gates ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN approval_gates.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_gates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE approval_gates ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN approval_gates.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: approval_history
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE approval_history ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN approval_history.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE approval_history ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN approval_history.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE approval_history ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN approval_history.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: approval_levels
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_levels' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE approval_levels ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN approval_levels.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_levels' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE approval_levels ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN approval_levels.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: approval_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE approval_requests ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN approval_requests.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE approval_requests ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN approval_requests.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: approval_templates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_templates' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE approval_templates ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN approval_templates.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE approval_templates ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN approval_templates.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: artifact_downloads
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_downloads' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_downloads ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_downloads.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_downloads' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_downloads ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_downloads.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_downloads' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE artifact_downloads ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN artifact_downloads.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_downloads' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE artifact_downloads ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN artifact_downloads.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: artifact_lifecycles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_lifecycles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_lifecycles ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_lifecycles.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_lifecycles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_lifecycles ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_lifecycles.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: artifact_operations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_operations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_operations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_operations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_operations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_operations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_operations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_operations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE artifact_operations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN artifact_operations.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: artifact_promotions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_promotions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_promotions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_promotions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_promotions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_promotions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_promotions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_promotions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE artifact_promotions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN artifact_promotions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: artifact_scans
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_scans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_scans ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_scans.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_scans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_scans ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_scans.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: artifact_signatures
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_signatures' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_signatures ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_signatures.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_signatures' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_signatures ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_signatures.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: artifact_tags
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_tags' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_tags ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_tags.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_tags' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_tags ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifact_tags.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_tags' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE artifact_tags ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN artifact_tags.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: artifacts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifacts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifacts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN artifacts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: audit_executions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_executions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_executions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_executions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_executions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_executions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE audit_executions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN audit_executions.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE audit_executions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN audit_executions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: audit_findings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_findings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_findings ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_findings.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_findings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_findings ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_findings.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_findings' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE audit_findings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN audit_findings.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: audit_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: audit_plans
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_plans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_plans ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_plans.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_plans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_plans ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_plans.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: audit_reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_reports ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_reports.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_reports ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_reports.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_reports' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE audit_reports ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN audit_reports.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: audit_rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_rules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_rules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_rules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN audit_rules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_rules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE audit_rules ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN audit_rules.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: auth_keies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_keies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE auth_keies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN auth_keies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_keies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE auth_keies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN auth_keies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: auth_token_blacklists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_token_blacklists' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE auth_token_blacklists ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN auth_token_blacklists.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_token_blacklists' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE auth_token_blacklists ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN auth_token_blacklists.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: backup_jobs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_jobs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE backup_jobs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN backup_jobs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_jobs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE backup_jobs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN backup_jobs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: backup_policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE backup_policies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN backup_policies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE backup_policies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN backup_policies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: backup_restores
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_restores' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE backup_restores ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN backup_restores.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_restores' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE backup_restores ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN backup_restores.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: backup_storages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_storages' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE backup_storages ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN backup_storages.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_storages' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE backup_storages ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN backup_storages.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: baselines
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'baselines' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE baselines ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN baselines.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'baselines' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE baselines ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN baselines.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: batch_runs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_runs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE batch_runs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN batch_runs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_runs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE batch_runs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN batch_runs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: bi_dashboards
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bi_dashboards' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE bi_dashboards ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN bi_dashboards.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bi_dashboards' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE bi_dashboards ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN bi_dashboards.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: billing_accounts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_accounts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE billing_accounts ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN billing_accounts.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_accounts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE billing_accounts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN billing_accounts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: billing_invoices
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_invoices' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE billing_invoices ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN billing_invoices.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_invoices' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE billing_invoices ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN billing_invoices.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: billing_line_items
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_line_items' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE billing_line_items ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN billing_line_items.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_line_items' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE billing_line_items ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN billing_line_items.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_line_items' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE billing_line_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN billing_line_items.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: billing_subscriptions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_subscriptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE billing_subscriptions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN billing_subscriptions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_subscriptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE billing_subscriptions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN billing_subscriptions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: budget_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE budget_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN budget_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE budget_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN budget_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: budget_history_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_history_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE budget_history_records ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN budget_history_records.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_history_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE budget_history_records ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN budget_history_records.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: budgets
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE budgets ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN budgets.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE budgets ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN budgets.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: build_cache_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE build_cache_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN build_cache_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE build_cache_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN build_cache_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: build_cache_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE build_cache_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN build_cache_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE build_cache_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN build_cache_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE build_cache_entries ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN build_cache_entries.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: build_environments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_environments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE build_environments ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN build_environments.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_environments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE build_environments ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN build_environments.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: build_images
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_images' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE build_images ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN build_images.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_images' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE build_images ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN build_images.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: build_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE build_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN build_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE build_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN build_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE build_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN build_logs.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: builds
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'builds' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE builds ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN builds.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: cache_cleanups
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_cleanups' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cache_cleanups ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cache_cleanups.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_cleanups' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cache_cleanups ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cache_cleanups.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: cache_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cache_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cache_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cache_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cache_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: canary_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE canary_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN canary_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE canary_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN canary_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: canary_deployments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_deployments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE canary_deployments ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN canary_deployments.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_deployments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE canary_deployments ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN canary_deployments.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: canary_traffics
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_traffics' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE canary_traffics ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN canary_traffics.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_traffics' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE canary_traffics ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN canary_traffics.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: capabilities
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capabilities' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE capabilities ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN capabilities.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capabilities' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE capabilities ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN capabilities.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: capability_audit_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE capability_audit_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN capability_audit_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE capability_audit_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN capability_audit_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_audit_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE capability_audit_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN capability_audit_logs.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: change_analysises
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_analysises' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE change_analysises ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN change_analysises.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: change_approvals
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_approvals' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE change_approvals ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN change_approvals.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_approvals' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE change_approvals ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN change_approvals.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_approvals' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE change_approvals ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN change_approvals.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: change_executions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE change_executions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN change_executions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE change_executions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN change_executions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE change_executions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN change_executions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: change_histories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_histories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE change_histories ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN change_histories.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_histories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE change_histories ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN change_histories.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: change_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE change_requests ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN change_requests.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: chaos_experiments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chaos_experiments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chaos_experiments ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chaos_experiments.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: chargeback_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chargeback_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chargeback_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chargeback_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chargeback_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chargeback_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chargeback_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: chatops_alert_states
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_alert_states' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_alert_states ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_alert_states.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_alert_states' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_alert_states ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_alert_states.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: chatops_approval_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_approval_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_approval_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_approval_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_approval_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_approval_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_approval_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_approval_configs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_approval_configs ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_approval_configs.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_approval_configs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_approval_configs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_approval_configs.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_audit_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_audit_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_audit_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_audit_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_audit_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_audit_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_audit_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_audit_logs.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_capability_mappings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_capability_mappings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_capability_mappings ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_capability_mappings.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_capability_mappings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_capability_mappings ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_capability_mappings.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_capability_mappings' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_capability_mappings ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_capability_mappings.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_capability_mappings' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_capability_mappings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_capability_mappings.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_command_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_command_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_command_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_command_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_command_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_command_configs ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_command_configs.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_command_configs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_command_configs.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_command_permissions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_permissions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_command_permissions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_command_permissions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_permissions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_command_permissions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_command_permissions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_permissions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_command_permissions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_command_permissions.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_permissions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_command_permissions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_command_permissions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_command_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_command_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_command_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_command_versions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_command_versions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_commands
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_commands' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_commands ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_commands.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_commands' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_commands ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_commands.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: chatops_dnd_settings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_dnd_settings ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_dnd_settings.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_dnd_settings ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_dnd_settings.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_dnd_settings ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_dnd_settings.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_dnd_settings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_dnd_settings.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_environment_permissions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_environment_permissions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_environment_permissions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_environment_permissions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_environment_permissions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_environment_permissions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_environment_permissions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_environment_permissions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_environment_permissions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_environment_permissions.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_environment_permissions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_environment_permissions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_environment_permissions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_executions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_executions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_executions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_executions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_executions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_executions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_executions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_messages' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_messages ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_messages.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_messages' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_messages ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_messages.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_messages' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_messages ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_messages.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_notification_preferences
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_notification_preferences' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_notification_preferences ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_notification_preferences.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_notification_preferences' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_notification_preferences ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_notification_preferences.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: chatops_permission_roles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_permission_roles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_permission_roles ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_permission_roles.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_permission_roles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_permission_roles ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_permission_roles.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_permission_roles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_permission_roles ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_permission_roles.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_permission_roles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_permission_roles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_permission_roles.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_platform_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_platform_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_platform_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_platform_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_platform_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_platform_configs ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_platform_configs.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_platform_configs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_platform_configs.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_question_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_question_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_question_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_question_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_question_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_question_configs ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_question_configs.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_question_configs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_question_configs.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_rate_limits
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_rate_limits' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_rate_limits ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_rate_limits.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_rate_limits' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_rate_limits ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_rate_limits.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_rate_limits' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_rate_limits ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_rate_limits.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: chatops_sessions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_sessions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_sessions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_sessions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_sessions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_sessions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_sessions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: chatops_webhooks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_webhooks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_webhooks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN chatops_webhooks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_webhooks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_webhooks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN chatops_webhooks.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: checkpoints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checkpoints' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE checkpoints ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN checkpoints.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checkpoints' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE checkpoints ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN checkpoints.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: ci_relations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_relations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ci_relations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ci_relations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: ci_type_attributes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_attributes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ci_type_attributes ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ci_type_attributes.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_attributes' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ci_type_attributes ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ci_type_attributes.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_attributes' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ci_type_attributes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ci_type_attributes.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ci_type_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ci_type_versions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ci_type_versions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ci_type_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ci_type_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ci_type_versions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ci_type_versions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ci_types
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_types' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ci_types ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ci_types.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_types' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ci_types ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ci_types.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: ci_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ci_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ci_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ci_versions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ci_versions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: circuit_breaker_events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE circuit_breaker_events ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN circuit_breaker_events.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE circuit_breaker_events ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN circuit_breaker_events.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE circuit_breaker_events ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN circuit_breaker_events.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE circuit_breaker_events ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN circuit_breaker_events.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: circuit_breakers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breakers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE circuit_breakers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN circuit_breakers.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breakers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE circuit_breakers ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN circuit_breakers.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: cis
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cis' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cis ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cis.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: cloud_accounts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cloud_accounts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cloud_accounts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cloud_accounts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: cloud_resources
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cloud_resources' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cloud_resources ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cloud_resources.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cloud_resources' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cloud_resources ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cloud_resources.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: code_repo_adapters
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repo_adapters' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE code_repo_adapters ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN code_repo_adapters.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repo_adapters' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE code_repo_adapters ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN code_repo_adapters.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repo_adapters' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE code_repo_adapters ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN code_repo_adapters.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: code_repos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repos' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE code_repos ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN code_repos.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repos' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE code_repos ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN code_repos.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repos' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE code_repos ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN code_repos.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: collection_schedules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collection_schedules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE collection_schedules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN collection_schedules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collection_schedules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE collection_schedules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN collection_schedules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collection_schedules' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE collection_schedules ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN collection_schedules.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collection_schedules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE collection_schedules ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN collection_schedules.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: command_log_details
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_log_details' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE command_log_details ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN command_log_details.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_log_details' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE command_log_details ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN command_log_details.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_log_details' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE command_log_details ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN command_log_details.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: command_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE command_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN command_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE command_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN command_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE command_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN command_logs.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: comments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE comments ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN comments.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE comments ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN comments.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE comments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN comments.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: communities
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE communities ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN communities.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE communities ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN communities.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: community_advanceds
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_advanceds' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE community_advanceds ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN community_advanceds.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_advanceds' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE community_advanceds ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN community_advanceds.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: compliance_evidence
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_evidence' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE compliance_evidence ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN compliance_evidence.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_evidence' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE compliance_evidence ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN compliance_evidence.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_evidence' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE compliance_evidence ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN compliance_evidence.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_evidence' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE compliance_evidence ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN compliance_evidence.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: compliance_frameworks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_frameworks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE compliance_frameworks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN compliance_frameworks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_frameworks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE compliance_frameworks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN compliance_frameworks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_frameworks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE compliance_frameworks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN compliance_frameworks.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: compliance_policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE compliance_policies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN compliance_policies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE compliance_policies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN compliance_policies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: compliance_reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE compliance_reports ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN compliance_reports.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE compliance_reports ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN compliance_reports.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: compliance_schedules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_schedules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE compliance_schedules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN compliance_schedules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_schedules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE compliance_schedules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN compliance_schedules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: config_audit_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_audit_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE config_audit_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN config_audit_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_audit_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_audit_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN config_audit_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_audit_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE config_audit_entries ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN config_audit_entries.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: config_mgmts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_mgmts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE config_mgmts ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN config_mgmts.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_mgmts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_mgmts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN config_mgmts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: config_snapshots
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_snapshots' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_snapshots ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN config_snapshots.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_snapshots' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE config_snapshots ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN config_snapshots.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: config_template_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_template_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_template_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN config_template_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_template_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE config_template_versions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN config_template_versions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: config_templates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_templates ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN config_templates.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: config_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN config_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE config_versions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN config_versions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: config_webhooks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_webhooks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE config_webhooks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN config_webhooks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_webhooks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_webhooks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN config_webhooks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: contract_endpoints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_endpoints' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE contract_endpoints ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN contract_endpoints.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_endpoints' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE contract_endpoints ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN contract_endpoints.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_endpoints' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE contract_endpoints ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN contract_endpoints.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: cost_allocation_reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cost_allocation_reports ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cost_allocation_reports.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_allocation_reports ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cost_allocation_reports.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: cost_allocation_rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cost_allocation_rules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cost_allocation_rules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_allocation_rules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cost_allocation_rules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_rules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE cost_allocation_rules ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN cost_allocation_rules.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: cost_allocation_tags
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_tags' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cost_allocation_tags ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cost_allocation_tags.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_tags' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_allocation_tags ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cost_allocation_tags.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: cost_allocations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_allocations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cost_allocations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: cost_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cost_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cost_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cost_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: cost_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cost_records ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cost_records.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_records ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cost_records.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: cron_job_executions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cron_job_executions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cron_job_executions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cron_job_executions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cron_job_executions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_executions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE cron_job_executions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN cron_job_executions.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE cron_job_executions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN cron_job_executions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: cron_job_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cron_job_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cron_job_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cron_job_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cron_job_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE cron_job_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN cron_job_logs.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: cron_jobs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_jobs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cron_jobs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cron_jobs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_jobs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cron_jobs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cron_jobs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: cross_domains
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cross_domains' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cross_domains ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cross_domains.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cross_domains' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cross_domains ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN cross_domains.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: data_lineages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_lineages' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE data_lineages ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN data_lineages.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_lineages' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE data_lineages ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN data_lineages.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: data_pipelines
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_pipelines' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE data_pipelines ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN data_pipelines.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_pipelines' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE data_pipelines ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN data_pipelines.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: data_quality_rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_quality_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE data_quality_rules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN data_quality_rules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_quality_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE data_quality_rules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN data_quality_rules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: data_sources
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_sources' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE data_sources ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN data_sources.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_sources' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE data_sources ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN data_sources.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: decision_explanations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_explanations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE decision_explanations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN decision_explanations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_explanations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE decision_explanations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN decision_explanations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: decision_feedbacks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_feedbacks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE decision_feedbacks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN decision_feedbacks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: decision_traces
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_traces' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE decision_traces ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN decision_traces.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_traces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE decision_traces ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN decision_traces.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: decisions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decisions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE decisions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN decisions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: degradation_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE degradation_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN degradation_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE degradation_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN degradation_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: degradation_histories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_histories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE degradation_histories ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN degradation_histories.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_histories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE degradation_histories ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN degradation_histories.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: degradations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE degradations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN degradations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE degradations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN degradations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: dependency_coordinations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dependency_coordinations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE dependency_coordinations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN dependency_coordinations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dependency_coordinations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE dependency_coordinations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN dependency_coordinations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: deploy_audit_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_audit_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE deploy_audit_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN deploy_audit_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_audit_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE deploy_audit_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN deploy_audit_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_audit_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE deploy_audit_entries ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN deploy_audit_entries.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: deploy_windows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_windows' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE deploy_windows ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN deploy_windows.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: deployment_triggers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployment_triggers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE deployment_triggers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN deployment_triggers.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployment_triggers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE deployment_triggers ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN deployment_triggers.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: deployments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE deployments ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN deployments.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE deployments ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN deployments.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: developer_portals
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developer_portals' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE developer_portals ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN developer_portals.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developer_portals' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE developer_portals ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN developer_portals.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: diagnostic_patterns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_patterns' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE diagnostic_patterns ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN diagnostic_patterns.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_patterns' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE diagnostic_patterns ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN diagnostic_patterns.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_patterns' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE diagnostic_patterns ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN diagnostic_patterns.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: diagnostic_reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN diagnostic_reports.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN diagnostic_reports.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_reports' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN diagnostic_reports.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: diagnostic_sessions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_sessions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE diagnostic_sessions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN diagnostic_sessions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_sessions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE diagnostic_sessions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN diagnostic_sessions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE diagnostic_sessions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN diagnostic_sessions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: diagnostic_symptoms
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_symptoms' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE diagnostic_symptoms ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN diagnostic_symptoms.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_symptoms' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE diagnostic_symptoms ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN diagnostic_symptoms.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_symptoms' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE diagnostic_symptoms ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN diagnostic_symptoms.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: digital_twins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'digital_twins' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE digital_twins ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN digital_twins.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'digital_twins' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE digital_twins ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN digital_twins.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: disaster_plans
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'disaster_plans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE disaster_plans ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN disaster_plans.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'disaster_plans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE disaster_plans ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN disaster_plans.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: do_not_disturbs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'do_not_disturbs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE do_not_disturbs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN do_not_disturbs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'do_not_disturbs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE do_not_disturbs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN do_not_disturbs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: document_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN document_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN document_versions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: domain_events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE domain_events ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN domain_events.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE domain_events ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN domain_events.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE domain_events ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN domain_events.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: domain_snapshots
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_snapshots' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE domain_snapshots ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN domain_snapshots.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_snapshots' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE domain_snapshots ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN domain_snapshots.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_snapshots' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE domain_snapshots ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN domain_snapshots.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: drift_reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drift_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE drift_reports ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN drift_reports.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drift_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE drift_reports ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN drift_reports.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: dual_engines
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dual_engines' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE dual_engines ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN dual_engines.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dual_engines' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE dual_engines ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN dual_engines.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: efficiency_metrics
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_metrics' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE efficiency_metrics ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN efficiency_metrics.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_metrics' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE efficiency_metrics ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN efficiency_metrics.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: efficiency_recommendations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_recommendations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE efficiency_recommendations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN efficiency_recommendations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_recommendations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE efficiency_recommendations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN efficiency_recommendations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: efficiency_scores
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_scores' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE efficiency_scores ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN efficiency_scores.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_scores' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE efficiency_scores ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN efficiency_scores.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_scores' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE efficiency_scores ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN efficiency_scores.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: emergency_deploys
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emergency_deploys' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE emergency_deploys ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN emergency_deploys.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emergency_deploys' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE emergency_deploys ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN emergency_deploys.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: env_lifecycles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_lifecycles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE env_lifecycles ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN env_lifecycles.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_lifecycles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE env_lifecycles ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN env_lifecycles.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: env_profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_profiles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE env_profiles ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN env_profiles.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_profiles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE env_profiles ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN env_profiles.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: ephemeral_envs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ephemeral_envs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ephemeral_envs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ephemeral_envs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ephemeral_envs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ephemeral_envs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ephemeral_envs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: error_budgets
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'error_budgets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE error_budgets ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN error_budgets.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'error_budgets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE error_budgets ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN error_budgets.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: escalation_policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escalation_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE escalation_policies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN escalation_policies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escalation_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE escalation_policies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN escalation_policies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: evaluations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evaluations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE evaluations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN evaluations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evaluations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE evaluations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN evaluations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: event_triggers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_triggers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE event_triggers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN event_triggers.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_triggers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE event_triggers ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN event_triggers.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE events ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN events.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE events ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN events.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE events ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN events.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: execution_control_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execution_control_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE execution_control_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN execution_control_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execution_control_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE execution_control_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN execution_control_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: experiment_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE experiment_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN experiment_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE experiment_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN experiment_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: experiment_results
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_results' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE experiment_results ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN experiment_results.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_results' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE experiment_results ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN experiment_results.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: experiment_runs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_runs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE experiment_runs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN experiment_runs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_runs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE experiment_runs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN experiment_runs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: experiments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE experiments ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN experiments.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: fault_injections
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fault_injections' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE fault_injections ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN fault_injections.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fault_injections' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE fault_injections ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN fault_injections.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: federated_clusters
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'federated_clusters' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE federated_clusters ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN federated_clusters.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'federated_clusters' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE federated_clusters ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN federated_clusters.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'federated_clusters' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE federated_clusters ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN federated_clusters.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: finops_anomalies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_anomalies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE finops_anomalies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN finops_anomalies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_anomalies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE finops_anomalies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN finops_anomalies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_anomalies' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE finops_anomalies ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN finops_anomalies.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: finops_budget_guards
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_budget_guards' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE finops_budget_guards ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN finops_budget_guards.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_budget_guards' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE finops_budget_guards ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN finops_budget_guards.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: finops_cost_items
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_cost_items' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE finops_cost_items ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN finops_cost_items.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_cost_items' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE finops_cost_items ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN finops_cost_items.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_cost_items' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE finops_cost_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN finops_cost_items.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: finops_reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE finops_reports ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN finops_reports.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE finops_reports ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN finops_reports.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_reports' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE finops_reports ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN finops_reports.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_reports' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE finops_reports ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN finops_reports.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: flag_toggle_history
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flag_toggle_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE flag_toggle_history ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN flag_toggle_history.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flag_toggle_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE flag_toggle_history ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN flag_toggle_history.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flag_toggle_history' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE flag_toggle_history ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN flag_toggle_history.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flag_toggle_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE flag_toggle_history ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN flag_toggle_history.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: git_changelog_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'git_changelog_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE git_changelog_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN git_changelog_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'git_changelog_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE git_changelog_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN git_changelog_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'git_changelog_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE git_changelog_entries ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN git_changelog_entries.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: gitops_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE gitops_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN gitops_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE gitops_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN gitops_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: gitops_sync_statuses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_sync_statuses' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE gitops_sync_statuses ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN gitops_sync_statuses.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_sync_statuses' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE gitops_sync_statuses ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN gitops_sync_statuses.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_sync_statuses' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE gitops_sync_statuses ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN gitops_sync_statuses.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: global_params
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_params' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE global_params ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN global_params.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_params' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE global_params ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN global_params.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: governance_policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'governance_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE governance_policies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN governance_policies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: handler_registries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE handler_registries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN handler_registries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE handler_registries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN handler_registries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: handler_registry_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registry_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE handler_registry_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN handler_registry_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registry_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE handler_registry_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN handler_registry_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: healing_incidents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'healing_incidents' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE healing_incidents ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN healing_incidents.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'healing_incidents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE healing_incidents ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN healing_incidents.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: health_checks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE health_checks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN health_checks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE health_checks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN health_checks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: hook_chains
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hook_chains' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE hook_chains ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN hook_chains.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hook_chains' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE hook_chains ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN hook_chains.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: hotfix_channels
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hotfix_channels' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE hotfix_channels ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN hotfix_channels.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hotfix_channels' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE hotfix_channels ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN hotfix_channels.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: i18n_translations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'i18n_translations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE i18n_translations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN i18n_translations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'i18n_translations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE i18n_translations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN i18n_translations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: iac_plans
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_plans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE iac_plans ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN iac_plans.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_plans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE iac_plans ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN iac_plans.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_plans' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE iac_plans ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN iac_plans.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: iac_resources
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_resources' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE iac_resources ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN iac_resources.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_resources' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE iac_resources ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN iac_resources.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: iac_state_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_state_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE iac_state_versions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN iac_state_versions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_state_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE iac_state_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN iac_state_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_state_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE iac_state_versions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN iac_state_versions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: iac_workspace_modules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspace_modules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE iac_workspace_modules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN iac_workspace_modules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspace_modules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE iac_workspace_modules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN iac_workspace_modules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: iac_workspaces
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspaces' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE iac_workspaces ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN iac_workspaces.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspaces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE iac_workspaces ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN iac_workspaces.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: inception_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inception_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE inception_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN inception_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inception_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE inception_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN inception_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: incident_escalations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_escalations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE incident_escalations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN incident_escalations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_escalations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE incident_escalations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN incident_escalations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_escalations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE incident_escalations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN incident_escalations.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: incident_postmortems
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_postmortems' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE incident_postmortems ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN incident_postmortems.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: incident_timeline_events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_timeline_events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE incident_timeline_events ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN incident_timeline_events.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_timeline_events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE incident_timeline_events ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN incident_timeline_events.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_timeline_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE incident_timeline_events ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN incident_timeline_events.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: incidents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE incidents ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN incidents.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE incidents ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN incidents.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: infrastructure_connectors
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_connectors' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE infrastructure_connectors ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN infrastructure_connectors.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_connectors' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE infrastructure_connectors ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN infrastructure_connectors.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: infrastructure_sandboxes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_sandboxes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE infrastructure_sandboxes ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN infrastructure_sandboxes.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_sandboxes' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE infrastructure_sandboxes ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN infrastructure_sandboxes.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: integrations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integrations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE integrations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN integrations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integrations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE integrations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN integrations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: internal_libraries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'internal_libraries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE internal_libraries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN internal_libraries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'internal_libraries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE internal_libraries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN internal_libraries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: knowledge_doc_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_doc_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE knowledge_doc_versions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN knowledge_doc_versions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_doc_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE knowledge_doc_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN knowledge_doc_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_doc_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE knowledge_doc_versions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN knowledge_doc_versions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: knowledge_documents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_documents' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE knowledge_documents ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN knowledge_documents.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_documents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE knowledge_documents ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN knowledge_documents.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: knowledge_spaces
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_spaces' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE knowledge_spaces ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN knowledge_spaces.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_spaces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE knowledge_spaces ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN knowledge_spaces.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: knowledge_sync_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_sync_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE knowledge_sync_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN knowledge_sync_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_sync_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE knowledge_sync_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN knowledge_sync_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_sync_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE knowledge_sync_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN knowledge_sync_logs.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: l_l_m_traces
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_l_m_traces' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE l_l_m_traces ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN l_l_m_traces.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_l_m_traces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE l_l_m_traces ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN l_l_m_traces.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: library_dependents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_dependents' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE library_dependents ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN library_dependents.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_dependents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE library_dependents ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN library_dependents.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_dependents' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE library_dependents ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN library_dependents.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: library_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE library_versions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN library_versions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE library_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN library_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE library_versions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN library_versions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: lineage_nodes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_nodes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE lineage_nodes ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN lineage_nodes.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_nodes' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lineage_nodes ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN lineage_nodes.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_nodes' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE lineage_nodes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN lineage_nodes.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: lineage_relationships
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_relationships' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE lineage_relationships ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN lineage_relationships.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_relationships' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lineage_relationships ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN lineage_relationships.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_relationships' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE lineage_relationships ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN lineage_relationships.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: locales
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locales' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE locales ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN locales.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locales' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE locales ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN locales.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: lowcode_flows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_flows' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lowcode_flows ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN lowcode_flows.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: lowcode_instances
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_instances' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE lowcode_instances ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN lowcode_instances.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_instances' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lowcode_instances ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN lowcode_instances.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: lowcode_workflow_definition
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_definition' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lowcode_workflow_definition ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN lowcode_workflow_definition.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: lowcode_workflow_instance
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_instance' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE lowcode_workflow_instance ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN lowcode_workflow_instance.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_instance' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lowcode_workflow_instance ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN lowcode_workflow_instance.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_instance' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE lowcode_workflow_instance ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN lowcode_workflow_instance.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: m_c_p_servers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_c_p_servers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE m_c_p_servers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN m_c_p_servers.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_c_p_servers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE m_c_p_servers ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN m_c_p_servers.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: m_f_a_devices
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_f_a_devices' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE m_f_a_devices ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN m_f_a_devices.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_f_a_devices' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE m_f_a_devices ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN m_f_a_devices.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: maintenance_windows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_windows' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE maintenance_windows ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN maintenance_windows.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_windows' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE maintenance_windows ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN maintenance_windows.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: message_queues
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_queues' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE message_queues ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN message_queues.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_queues' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE message_queues ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN message_queues.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: metricses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'metricses' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE metricses ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN metricses.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'metricses' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE metricses ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN metricses.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: migration_plans
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'migration_plans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE migration_plans ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN migration_plans.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'migration_plans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE migration_plans ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN migration_plans.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: mock_rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE mock_rules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN mock_rules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE mock_rules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN mock_rules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: model_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'model_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE model_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN model_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: monitoring_alert_rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alert_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE monitoring_alert_rules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN monitoring_alert_rules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alert_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE monitoring_alert_rules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN monitoring_alert_rules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: monitoring_alerts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alerts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE monitoring_alerts ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN monitoring_alerts.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alerts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE monitoring_alerts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN monitoring_alerts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: monitoring_anomalies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_anomalies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE monitoring_anomalies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN monitoring_anomalies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_anomalies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE monitoring_anomalies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN monitoring_anomalies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_anomalies' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE monitoring_anomalies ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN monitoring_anomalies.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_anomalies' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE monitoring_anomalies ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN monitoring_anomalies.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: monitoring_metrics
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_metrics' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE monitoring_metrics ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN monitoring_metrics.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_metrics' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE monitoring_metrics ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN monitoring_metrics.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: multi_modal_triggers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'multi_modal_triggers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE multi_modal_triggers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN multi_modal_triggers.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'multi_modal_triggers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE multi_modal_triggers ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN multi_modal_triggers.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: namespace_allocations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'namespace_allocations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE namespace_allocations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN namespace_allocations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'namespace_allocations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE namespace_allocations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN namespace_allocations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'namespace_allocations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE namespace_allocations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN namespace_allocations.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: notification_channels
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_channels' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE notification_channels ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN notification_channels.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_channels' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE notification_channels ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN notification_channels.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: notification_managements
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_managements' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE notification_managements ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN notification_managements.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_managements' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE notification_managements ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN notification_managements.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: notification_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE notification_records ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN notification_records.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE notification_records ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN notification_records.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_records' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE notification_records ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN notification_records.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: notification_templates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_templates' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE notification_templates ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN notification_templates.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE notification_templates ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN notification_templates.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: oci_registries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oci_registries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE oci_registries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN oci_registries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oci_registries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE oci_registries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN oci_registries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: oncall_assignments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_assignments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE oncall_assignments ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN oncall_assignments.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_assignments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE oncall_assignments ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN oncall_assignments.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_assignments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE oncall_assignments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN oncall_assignments.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: oncall_overrides
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_overrides' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE oncall_overrides ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN oncall_overrides.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_overrides' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE oncall_overrides ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN oncall_overrides.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_overrides' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE oncall_overrides ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN oncall_overrides.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: oncall_schedules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_schedules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE oncall_schedules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN oncall_schedules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_schedules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE oncall_schedules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN oncall_schedules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: otel_collector_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otel_collector_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE otel_collector_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN otel_collector_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otel_collector_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE otel_collector_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN otel_collector_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: p_r_test_results
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p_r_test_results' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE p_r_test_results ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN p_r_test_results.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p_r_test_results' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE p_r_test_results ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN p_r_test_results.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: page_registries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE page_registries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN page_registries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE page_registries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN page_registries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: page_registry_histories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registry_histories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE page_registry_histories ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN page_registry_histories.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registry_histories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE page_registry_histories ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN page_registry_histories.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registry_histories' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE page_registry_histories ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN page_registry_histories.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: permission_audit_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE permission_audit_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN permission_audit_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE permission_audit_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN permission_audit_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: permission_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_requests' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE permission_requests ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN permission_requests.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE permission_requests ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN permission_requests.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: permissions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permissions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE permissions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN permissions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permissions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE permissions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN permissions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: phase_groups
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phase_groups' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE phase_groups ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN phase_groups.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: pipeline_checkpoints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_checkpoints' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE pipeline_checkpoints ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pipeline_checkpoints.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_checkpoints' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_checkpoints ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pipeline_checkpoints.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_checkpoints' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE pipeline_checkpoints ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN pipeline_checkpoints.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: pipeline_runs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_runs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE pipeline_runs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pipeline_runs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_runs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_runs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pipeline_runs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: pipeline_stages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_stages' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE pipeline_stages ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pipeline_stages.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_stages' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_stages ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pipeline_stages.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: pipeline_tasks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_tasks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE pipeline_tasks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pipeline_tasks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_tasks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_tasks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pipeline_tasks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: pipeline_templates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_templates ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pipeline_templates.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: pipeline_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pipeline_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: playground_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playground_requests' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE playground_requests ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN playground_requests.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playground_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE playground_requests ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN playground_requests.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: plugin_audit_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_audit_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_audit_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_audit_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_audit_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_audit_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_audit_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_audit_entries' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE plugin_audit_entries ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN plugin_audit_entries.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_audit_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE plugin_audit_entries ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN plugin_audit_entries.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: plugin_executions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_executions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_executions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_executions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_executions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_executions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE plugin_executions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN plugin_executions.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE plugin_executions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN plugin_executions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: plugin_hotreloads
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_hotreloads' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_hotreloads ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_hotreloads.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_hotreloads' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_hotreloads ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_hotreloads.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: plugin_resource_quotas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_resource_quotas' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_resource_quotas ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_resource_quotas.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_resource_quotas' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_resource_quotas ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_resource_quotas.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: plugin_security_events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_security_events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_security_events ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_security_events.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_security_events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_security_events ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_security_events.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_security_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE plugin_security_events ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN plugin_security_events.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: plugin_tenant_quotas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_tenant_quotas' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_tenant_quotas ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_tenant_quotas.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_tenant_quotas' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_tenant_quotas ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugin_tenant_quotas.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: plugins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugins' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugins ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugins.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugins' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugins ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN plugins.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: policy_bundles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_bundles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_bundles ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_bundles.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_bundles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_bundles ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_bundles.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_bundles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE policy_bundles ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN policy_bundles.created_at IS 'Record creation timestamp';
  END IF;
END $$;

-- Table: policy_evaluations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_evaluations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_evaluations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_evaluations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_evaluations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_evaluations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_evaluations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_evaluations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE policy_evaluations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN policy_evaluations.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: policy_exemptions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_exemptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_exemptions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_exemptions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_exemptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_exemptions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_exemptions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: policy_overrides
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_overrides' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_overrides ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_overrides.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_overrides' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_overrides ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_overrides.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_overrides' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE policy_overrides ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN policy_overrides.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: policy_violations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_violations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_violations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_violations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_violations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_violations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_violations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: policy_workflows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_workflows' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_workflows ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_workflows.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_workflows' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_workflows ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN policy_workflows.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: portal_documents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_documents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE portal_documents ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN portal_documents.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: privacy_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'privacy_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE privacy_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN privacy_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'privacy_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE privacy_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN privacy_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: problem_change_links
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_change_links' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE problem_change_links ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN problem_change_links.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_change_links' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE problem_change_links ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN problem_change_links.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_change_links' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE problem_change_links ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN problem_change_links.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: problem_incident_links
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_incident_links' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE problem_incident_links ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN problem_incident_links.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_incident_links' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE problem_incident_links ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN problem_incident_links.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_incident_links' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE problem_incident_links ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN problem_incident_links.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: problem_known_errors
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_known_errors' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE problem_known_errors ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN problem_known_errors.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_known_errors' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE problem_known_errors ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN problem_known_errors.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_known_errors' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE problem_known_errors ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN problem_known_errors.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: problem_problems
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_problems' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE problem_problems ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN problem_problems.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: process_steps
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'process_steps' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE process_steps ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN process_steps.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'process_steps' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE process_steps ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN process_steps.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: product_lines
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lines' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE product_lines ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN product_lines.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lines' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE product_lines ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN product_lines.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN profiles.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN profiles.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: progressive_deploys
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressive_deploys' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE progressive_deploys ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN progressive_deploys.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressive_deploys' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE progressive_deploys ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN progressive_deploys.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: progressives
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressives' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE progressives ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN progressives.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressives' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE progressives ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN progressives.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: project_members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_members' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE project_members ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN project_members.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_members' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE project_members ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN project_members.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: pull_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pull_requests' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE pull_requests ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pull_requests.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pull_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pull_requests ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN pull_requests.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: quality_alerts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_alerts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE quality_alerts ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN quality_alerts.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_alerts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE quality_alerts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN quality_alerts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: quality_scan_results
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_scan_results' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE quality_scan_results ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN quality_scan_results.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_scan_results' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE quality_scan_results ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN quality_scan_results.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_scan_results' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE quality_scan_results ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN quality_scan_results.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: query_execution_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_execution_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE query_execution_records ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN query_execution_records.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_execution_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE query_execution_records ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN query_execution_records.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_execution_records' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE query_execution_records ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN query_execution_records.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: queues
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queues' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE queues ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN queues.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queues' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE queues ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN queues.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: r_o_i_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'r_o_i_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE r_o_i_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN r_o_i_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'r_o_i_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE r_o_i_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN r_o_i_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: recommendations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE recommendations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN recommendations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE recommendations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN recommendations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: recording_sessions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recording_sessions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE recording_sessions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN recording_sessions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recording_sessions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE recording_sessions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN recording_sessions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recording_sessions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE recording_sessions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN recording_sessions.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recording_sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE recording_sessions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN recording_sessions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE records ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN records.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE records ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN records.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: release_notes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_notes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE release_notes ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN release_notes.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_notes' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE release_notes ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN release_notes.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: release_trains
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_trains' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE release_trains ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN release_trains.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_trains' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE release_trains ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN release_trains.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: replay_sessions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'replay_sessions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE replay_sessions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN replay_sessions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'replay_sessions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE replay_sessions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN replay_sessions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'replay_sessions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE replay_sessions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN replay_sessions.created_at IS 'Record creation timestamp';
  END IF;
END $$;

-- Table: report_datasources
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_datasources' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE report_datasources ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN report_datasources.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_datasources' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE report_datasources ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN report_datasources.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: report_definitions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_definitions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE report_definitions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN report_definitions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: report_executions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE report_executions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN report_executions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE report_executions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN report_executions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: report_schedules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_schedules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE report_schedules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN report_schedules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_schedules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE report_schedules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN report_schedules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_schedules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE report_schedules ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN report_schedules.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE reports ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN reports.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE reports ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN reports.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: resilience_benchmarks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_benchmarks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE resilience_benchmarks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN resilience_benchmarks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_benchmarks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE resilience_benchmarks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN resilience_benchmarks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: resilience_histories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_histories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE resilience_histories ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN resilience_histories.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_histories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE resilience_histories ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN resilience_histories.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: resilience_recommendations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_recommendations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE resilience_recommendations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN resilience_recommendations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_recommendations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE resilience_recommendations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN resilience_recommendations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: response_history
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'response_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE response_history ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN response_history.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'response_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE response_history ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN response_history.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'response_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE response_history ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN response_history.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: retention_policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retention_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE retention_policies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN retention_policies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retention_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE retention_policies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN retention_policies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: review_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE review_requests ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN review_requests.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: reviews
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE reviews ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN reviews.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE reviews ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN reviews.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE reviews ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN reviews.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: risks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE risks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN risks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE risks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN risks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: roi_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roi_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE roi_entries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN roi_entries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roi_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE roi_entries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN roi_entries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roi_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE roi_entries ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN roi_entries.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: roles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE roles ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN roles.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE roles ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN roles.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: rollbacks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rollbacks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE rollbacks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN rollbacks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rollbacks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE rollbacks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN rollbacks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rollbacks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE rollbacks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN rollbacks.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: runbooks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runbooks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE runbooks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN runbooks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runbooks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE runbooks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN runbooks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: runs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE runs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN runs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE runs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN runs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: s_b_o_m_documents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_m_documents' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_b_o_m_documents ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_b_o_m_documents.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_m_documents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_b_o_m_documents ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_b_o_m_documents.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: s_b_o_ms
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_ms' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_b_o_ms ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_b_o_ms.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_ms' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_b_o_ms ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_b_o_ms.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: s_l_i_measurements
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_i_measurements' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_l_i_measurements ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_l_i_measurements.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_i_measurements' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_l_i_measurements ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_l_i_measurements.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: s_l_o_definitions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_o_definitions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_l_o_definitions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_l_o_definitions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_o_definitions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_l_o_definitions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_l_o_definitions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: s_s_e_log_event_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_log_event_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_s_e_log_event_records ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_s_e_log_event_records.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_log_event_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_s_e_log_event_records ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_s_e_log_event_records.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: s_s_e_status_event_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_status_event_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_s_e_status_event_records ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_s_e_status_event_records.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_status_event_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_s_e_status_event_records ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_s_e_status_event_records.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: s_s_o_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_s_o_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_s_o_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_s_o_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_s_o_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: s_s_o_providers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_providers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_s_o_providers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_s_o_providers.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_providers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_s_o_providers ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN s_s_o_providers.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: saga_instances
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_instances' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE saga_instances ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN saga_instances.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_instances' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE saga_instances ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN saga_instances.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: saga_steps
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_steps' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE saga_steps ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN saga_steps.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_steps' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE saga_steps ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN saga_steps.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: saga_transactions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_transactions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE saga_transactions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN saga_transactions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_transactions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE saga_transactions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN saga_transactions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: sandbox_network_policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sandbox_network_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sandbox_network_policies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sandbox_network_policies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sandbox_network_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sandbox_network_policies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sandbox_network_policies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: scan_reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE scan_reports ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN scan_reports.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE scan_reports ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN scan_reports.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_reports' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE scan_reports ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN scan_reports.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: scheduled_notifications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_notifications' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE scheduled_notifications ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN scheduled_notifications.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_notifications' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE scheduled_notifications ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN scheduled_notifications.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: scheduling_policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduling_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE scheduling_policies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN scheduling_policies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduling_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE scheduling_policies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN scheduling_policies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: script_libraries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_libraries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE script_libraries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN script_libraries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_libraries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE script_libraries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN script_libraries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: script_templates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_templates' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE script_templates ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN script_templates.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE script_templates ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN script_templates.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: script_versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE script_versions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN script_versions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE script_versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN script_versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: scripts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE scripts ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN scripts.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE scripts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN scripts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: sdk_tasks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sdk_tasks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sdk_tasks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sdk_tasks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sdk_tasks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sdk_tasks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sdk_tasks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: secrets
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'secrets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE secrets ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN secrets.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: self_services
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'self_services' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE self_services ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN self_services.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'self_services' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE self_services ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN self_services.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: serverless_deployments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_deployments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE serverless_deployments ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN serverless_deployments.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_deployments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE serverless_deployments ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN serverless_deployments.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: serverless_function_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_function_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE serverless_function_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN serverless_function_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_function_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE serverless_function_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN serverless_function_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_function_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE serverless_function_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN serverless_function_logs.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: serverless_functions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_functions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE serverless_functions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN serverless_functions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_functions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE serverless_functions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN serverless_functions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: serverless_triggers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_triggers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE serverless_triggers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN serverless_triggers.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_triggers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE serverless_triggers ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN serverless_triggers.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: service_catalogs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_catalogs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE service_catalogs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN service_catalogs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_catalogs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE service_catalogs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN service_catalogs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: service_healths
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_healths' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE service_healths ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN service_healths.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_healths' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE service_healths ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN service_healths.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: service_registries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_registries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE service_registries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN service_registries.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_registries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE service_registries ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN service_registries.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_registries' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE service_registries ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN service_registries.created_at IS 'Record creation timestamp';
  END IF;
END $$;

-- Table: service_topologies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_topologies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE service_topologies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN service_topologies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_topologies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE service_topologies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN service_topologies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: sessions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sessions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sessions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sessions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sessions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE sessions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN sessions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: simulations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE simulations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN simulations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE simulations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN simulations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: skill_audit_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE skill_audit_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN skill_audit_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE skill_audit_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN skill_audit_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: skill_executions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE skill_executions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN skill_executions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE skill_executions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN skill_executions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: skill_instances
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_instances' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE skill_instances ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN skill_instances.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_instances' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE skill_instances ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN skill_instances.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: skill_reviews
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_reviews' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE skill_reviews ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN skill_reviews.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_reviews' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE skill_reviews ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN skill_reviews.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: skills
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skills' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE skills ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN skills.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skills' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE skills ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN skills.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: sla_breach_events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_breach_events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sla_breach_events ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sla_breach_events.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_breach_events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sla_breach_events ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sla_breach_events.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_breach_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE sla_breach_events ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN sla_breach_events.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: sla_definitions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_definitions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sla_definitions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sla_definitions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: sla_trackings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_trackings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sla_trackings ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sla_trackings.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_trackings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sla_trackings ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sla_trackings.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: smart_deploy_audit
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_audit' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE smart_deploy_audit ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN smart_deploy_audit.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_audit' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE smart_deploy_audit ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN smart_deploy_audit.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_audit' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE smart_deploy_audit ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN smart_deploy_audit.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_audit' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE smart_deploy_audit ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN smart_deploy_audit.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: smart_deploy_deployments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_deployments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE smart_deploy_deployments ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN smart_deploy_deployments.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_deployments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE smart_deploy_deployments ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN smart_deploy_deployments.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: smart_deploy_rollbacks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_rollbacks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE smart_deploy_rollbacks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN smart_deploy_rollbacks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_rollbacks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE smart_deploy_rollbacks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN smart_deploy_rollbacks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_rollbacks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE smart_deploy_rollbacks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN smart_deploy_rollbacks.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: snapshots
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE snapshots ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN snapshots.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE snapshots ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN snapshots.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE snapshots ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN snapshots.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: sprint_tickets
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprint_tickets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sprint_tickets ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sprint_tickets.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprint_tickets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sprint_tickets ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sprint_tickets.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprint_tickets' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE sprint_tickets ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN sprint_tickets.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: sprints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprints' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sprints ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sprints.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprints' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sprints ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sprints.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: sql_audit_history
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_audit_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sql_audit_history ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sql_audit_history.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_audit_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sql_audit_history ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sql_audit_history.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_audit_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE sql_audit_history ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN sql_audit_history.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: sql_blacklist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_blacklist' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sql_blacklist ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sql_blacklist.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: sql_orders
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_orders' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sql_orders ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sql_orders.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_orders' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sql_orders ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN sql_orders.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_orders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE sql_orders ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN sql_orders.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: stages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stages' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE stages ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN stages.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stages' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE stages ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN stages.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: subapp_config_histories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_config_histories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE subapp_config_histories ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN subapp_config_histories.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_config_histories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE subapp_config_histories ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN subapp_config_histories.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_config_histories' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE subapp_config_histories ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN subapp_config_histories.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: subscriptions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN subscriptions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN subscriptions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: tasks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tasks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tasks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tasks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tasks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: team_members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE team_members ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN team_members.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE team_members ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN team_members.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE team_members ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN team_members.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE team_members ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN team_members.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: team_roles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_roles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE team_roles ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN team_roles.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_roles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE team_roles ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN team_roles.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_roles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE team_roles ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN team_roles.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_roles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE team_roles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN team_roles.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: teams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE teams ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN teams.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: temporary_permissions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE temporary_permissions ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN temporary_permissions.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE temporary_permissions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN temporary_permissions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE temporary_permissions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN temporary_permissions.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE temporary_permissions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN temporary_permissions.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: tenant_invites
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_invites' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tenant_invites ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tenant_invites.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_invites' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tenant_invites ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tenant_invites.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_invites' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE tenant_invites ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN tenant_invites.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: tenant_quota_alerts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quota_alerts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tenant_quota_alerts ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tenant_quota_alerts.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quota_alerts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tenant_quota_alerts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tenant_quota_alerts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quota_alerts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE tenant_quota_alerts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN tenant_quota_alerts.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: tenant_quotas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quotas' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tenant_quotas ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tenant_quotas.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quotas' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tenant_quotas ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tenant_quotas.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: tenant_users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_users' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tenant_users ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tenant_users.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_users' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tenant_users ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tenant_users.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: test_cases
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_cases' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE test_cases ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN test_cases.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_cases' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE test_cases ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN test_cases.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: test_code_mappings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_code_mappings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE test_code_mappings ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN test_code_mappings.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_code_mappings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE test_code_mappings ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN test_code_mappings.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: test_execution_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_execution_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE test_execution_records ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN test_execution_records.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_execution_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE test_execution_records ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN test_execution_records.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: test_suites
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_suites' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE test_suites ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN test_suites.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_suites' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE test_suites ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN test_suites.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: ticket_assignment_rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignment_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_assignment_rules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_assignment_rules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignment_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_assignment_rules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_assignment_rules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignment_rules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_assignment_rules ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticket_assignment_rules.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ticket_assignments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_assignments ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_assignments.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_assignments ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_assignments.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_assignments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticket_assignments.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ticket_automation_rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_automation_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_automation_rules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_automation_rules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_automation_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_automation_rules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_automation_rules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: ticket_dispatch_engineers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_engineers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_dispatch_engineers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_dispatch_engineers.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_engineers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_dispatch_engineers ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_dispatch_engineers.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: ticket_dispatch_rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_dispatch_rules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_dispatch_rules.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_dispatch_rules ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_dispatch_rules.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_rules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_dispatch_rules ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticket_dispatch_rules.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ticket_knowledges
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_knowledges' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_knowledges ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_knowledges.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_knowledges' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_knowledges ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_knowledges.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: ticket_relations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_relations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_relations ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_relations.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_relations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_relations ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_relations.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_relations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_relations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticket_relations.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ticket_sla_breaches
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_breaches' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_sla_breaches ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_sla_breaches.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_breaches' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_sla_breaches ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_sla_breaches.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_breaches' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE ticket_sla_breaches ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticket_sla_breaches.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_breaches' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_sla_breaches ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticket_sla_breaches.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ticket_sla_policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_sla_policies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_sla_policies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_sla_policies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_sla_policies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: ticket_sla_targets
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_targets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_sla_targets ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_sla_targets.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_targets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_sla_targets ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_sla_targets.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_targets' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_sla_targets ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticket_sla_targets.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ticket_sla_tracking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_tracking' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_sla_tracking ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_sla_tracking.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_tracking' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_sla_tracking ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_sla_tracking.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: ticket_suspends
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_suspends' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_suspends ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_suspends.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_suspends' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_suspends ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_suspends.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_suspends' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_suspends ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticket_suspends.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ticket_transfers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_transfers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_transfers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_transfers.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_transfers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_transfers ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_transfers.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_transfers' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_transfers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticket_transfers.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ticket_workflow_history
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_workflow_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_workflow_history ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_workflow_history.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_workflow_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_workflow_history ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticket_workflow_history.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_workflow_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_workflow_history ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticket_workflow_history.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: ticketing_dispatch_weights
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_dispatch_weights' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticketing_dispatch_weights ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticketing_dispatch_weights.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_dispatch_weights' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticketing_dispatch_weights ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticketing_dispatch_weights.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_dispatch_weights' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE ticketing_dispatch_weights ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticketing_dispatch_weights.created_at IS 'Record creation timestamp';
  END IF;
END $$;

-- Table: ticketing_service_state
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_service_state' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticketing_service_state ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticketing_service_state.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_service_state' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticketing_service_state ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN ticketing_service_state.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_service_state' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE ticketing_service_state ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN ticketing_service_state.created_at IS 'Record creation timestamp';
  END IF;
END $$;

-- Table: tickets
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tickets ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tickets.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tickets ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN tickets.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: topologies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topologies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE topologies ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN topologies.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topologies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE topologies ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN topologies.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: trace_sampling_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_sampling_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE trace_sampling_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN trace_sampling_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_sampling_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE trace_sampling_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN trace_sampling_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: trace_spans
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_spans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE trace_spans ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN trace_spans.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_spans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE trace_spans ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN trace_spans.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: traffic_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traffic_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE traffic_records ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN traffic_records.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traffic_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE traffic_records ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN traffic_records.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traffic_records' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE traffic_records ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN traffic_records.created_at IS 'Record creation timestamp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traffic_records' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE traffic_records ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN traffic_records.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: trigger_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trigger_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE trigger_logs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN trigger_logs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trigger_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE trigger_logs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN trigger_logs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: u_e_b_a_alerts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_alerts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE u_e_b_a_alerts ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN u_e_b_a_alerts.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_alerts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE u_e_b_a_alerts ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN u_e_b_a_alerts.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: u_e_b_a_profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_profiles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE u_e_b_a_profiles ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN u_e_b_a_profiles.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_profiles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE u_e_b_a_profiles ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN u_e_b_a_profiles.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: unified_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE unified_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN unified_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE unified_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN unified_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: upload_tasks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'upload_tasks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE upload_tasks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN upload_tasks.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'upload_tasks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE upload_tasks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN upload_tasks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'upload_tasks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE upload_tasks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN upload_tasks.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: usage_limits
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_limits' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE usage_limits ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN usage_limits.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_limits' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE usage_limits ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN usage_limits.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_limits' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE usage_limits ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN usage_limits.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: usage_records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE usage_records ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN usage_records.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE usage_records ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN usage_records.updated_by IS 'User who last updated this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_records' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE usage_records ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    COMMENT ON COLUMN usage_records.updated_at IS 'Record last update timestamp';
  END IF;
END $$;

-- Table: vector_stores
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vector_stores' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE vector_stores ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN vector_stores.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vector_stores' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE vector_stores ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN vector_stores.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: vectorize_ruleses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vectorize_ruleses' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE vectorize_ruleses ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN vectorize_ruleses.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vectorize_ruleses' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE vectorize_ruleses ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN vectorize_ruleses.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: version_archives
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'version_archives' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE version_archives ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN version_archives.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'version_archives' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE version_archives ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN version_archives.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: versions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE versions ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN versions.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: webhooks_secrets
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhooks_secrets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE webhooks_secrets ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN webhooks_secrets.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhooks_secrets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE webhooks_secrets ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN webhooks_secrets.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: widget_configs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'widget_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE widget_configs ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN widget_configs.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'widget_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE widget_configs ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN widget_configs.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: workbenches
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbenches' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE workbenches ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN workbenches.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbenches' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE workbenches ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN workbenches.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: workflow_tasks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_tasks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE workflow_tasks ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN workflow_tasks.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Table: workflow_triggers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_triggers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE workflow_triggers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN workflow_triggers.created_by IS 'User who created this record';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_triggers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE workflow_triggers ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN workflow_triggers.updated_by IS 'User who last updated this record';
  END IF;
END $$;

-- Migration complete
SELECT 'Added audit columns to 438 tables (created_by:390, updated_by:438, created_at:34, updated_at:145)' AS migration_result;

COMMIT;
