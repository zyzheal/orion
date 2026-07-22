-- Migration: 241_add_soft_delete.sql
-- Description: Add deleted_at column for soft delete support across all tables
-- Phase: 5.5
-- Impact: 282 tables will receive deleted_at TIMESTAMPTZ column + partial index
-- Notes: deleted_at DEFAULT NULL means records are active by default
--         Partial index (WHERE deleted_at IS NULL) optimizes active-record queries

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_feedback' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ai_decision_feedback ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ai_decision_feedback.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ai_decision_feedback' AND indexname = 'idx_ai_decision_feedback_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ai_decision_feedback_deleted_at ON ai_decision_feedback USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ai_decision_traces ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ai_decision_traces.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ai_decision_traces' AND indexname = 'idx_ai_decision_traces_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ai_decision_traces_deleted_at ON ai_decision_traces USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decisions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ai_decisions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ai_decisions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ai_decisions' AND indexname = 'idx_ai_decisions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ai_decisions_deleted_at ON ai_decisions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_gateway_requests' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ai_gateway_requests ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ai_gateway_requests.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ai_gateway_requests' AND indexname = 'idx_ai_gateway_requests_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ai_gateway_requests_deleted_at ON ai_gateway_requests USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_known_issues' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alert_known_issues ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN alert_known_issues.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'alert_known_issues' AND indexname = 'idx_alert_known_issues_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_alert_known_issues_deleted_at ON alert_known_issues USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_maintenance_windows' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alert_maintenance_windows ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN alert_maintenance_windows.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'alert_maintenance_windows' AND indexname = 'idx_alert_maintenance_windows_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_alert_maintenance_windows_deleted_at ON alert_maintenance_windows USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_node_health' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alert_node_health ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN alert_node_health.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'alert_node_health' AND indexname = 'idx_alert_node_health_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_alert_node_health_deleted_at ON alert_node_health USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_topologies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alert_topologies ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN alert_topologies.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'alert_topologies' AND indexname = 'idx_alert_topologies_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_alert_topologies_deleted_at ON alert_topologies USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alerts ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN alerts.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'alerts' AND indexname = 'idx_alerts_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_alerts_deleted_at ON alerts USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_consumptions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_consumptions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_consumptions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_consumptions' AND indexname = 'idx_api_consumptions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_consumptions_deleted_at ON api_consumptions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_contracts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_contracts ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_contracts.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_contracts' AND indexname = 'idx_api_contracts_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_contracts_deleted_at ON api_contracts USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_contracts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_governance_contracts ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_governance_contracts.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_governance_contracts' AND indexname = 'idx_api_governance_contracts_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_governance_contracts_deleted_at ON api_governance_contracts USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_governance_rules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_governance_rules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_governance_rules' AND indexname = 'idx_api_governance_rules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_governance_rules_deleted_at ON api_governance_rules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_verification_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_governance_verification_history ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_governance_verification_history.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_governance_verification_history' AND indexname = 'idx_api_governance_verification_history_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_governance_verification_history_deleted_at ON api_governance_verification_history USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_governance_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_governance_versions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_governance_versions' AND indexname = 'idx_api_governance_versions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_governance_versions_deleted_at ON api_governance_versions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_violations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_governance_violations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_governance_violations.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_governance_violations' AND indexname = 'idx_api_governance_violations_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_governance_violations_deleted_at ON api_governance_violations USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_keys.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_keys' AND indexname = 'idx_api_keys_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_keys_deleted_at ON api_keys USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_apps' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_market_apps ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_market_apps.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_market_apps' AND indexname = 'idx_api_market_apps_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_market_apps_deleted_at ON api_market_apps USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_keys' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_market_keys ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_market_keys.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_market_keys' AND indexname = 'idx_api_market_keys_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_market_keys_deleted_at ON api_market_keys USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_products' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_market_products ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_market_products.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_market_products' AND indexname = 'idx_api_market_products_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_market_products_deleted_at ON api_market_products USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_subscriptions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_market_subscriptions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN api_market_subscriptions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_market_subscriptions' AND indexname = 'idx_api_market_subscriptions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_api_market_subscriptions_deleted_at ON api_market_subscriptions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_gates' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE approval_gates ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN approval_gates.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'approval_gates' AND indexname = 'idx_approval_gates_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_approval_gates_deleted_at ON approval_gates USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE approval_history ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN approval_history.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'approval_history' AND indexname = 'idx_approval_history_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_approval_history_deleted_at ON approval_history USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_levels' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE approval_levels ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN approval_levels.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'approval_levels' AND indexname = 'idx_approval_levels_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_approval_levels_deleted_at ON approval_levels USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE approval_requests ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN approval_requests.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'approval_requests' AND indexname = 'idx_approval_requests_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_approval_requests_deleted_at ON approval_requests USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_templates' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE approval_templates ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN approval_templates.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'approval_templates' AND indexname = 'idx_approval_templates_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_approval_templates_deleted_at ON approval_templates USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_downloads' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE artifact_downloads ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN artifact_downloads.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'artifact_downloads' AND indexname = 'idx_artifact_downloads_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_artifact_downloads_deleted_at ON artifact_downloads USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_operations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE artifact_operations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN artifact_operations.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'artifact_operations' AND indexname = 'idx_artifact_operations_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_artifact_operations_deleted_at ON artifact_operations USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_promotions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE artifact_promotions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN artifact_promotions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'artifact_promotions' AND indexname = 'idx_artifact_promotions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_artifact_promotions_deleted_at ON artifact_promotions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_scans' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE artifact_scans ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN artifact_scans.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'artifact_scans' AND indexname = 'idx_artifact_scans_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_artifact_scans_deleted_at ON artifact_scans USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_tags' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE artifact_tags ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN artifact_tags.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'artifact_tags' AND indexname = 'idx_artifact_tags_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_artifact_tags_deleted_at ON artifact_tags USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE audit_executions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN audit_executions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_executions' AND indexname = 'idx_audit_executions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_audit_executions_deleted_at ON audit_executions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_findings' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE audit_findings ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN audit_findings.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_findings' AND indexname = 'idx_audit_findings_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_audit_findings_deleted_at ON audit_findings USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_plans' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE audit_plans ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN audit_plans.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_plans' AND indexname = 'idx_audit_plans_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_audit_plans_deleted_at ON audit_plans USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_reports' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE audit_reports ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN audit_reports.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_reports' AND indexname = 'idx_audit_reports_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_audit_reports_deleted_at ON audit_reports USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE audit_rules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN audit_rules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_rules' AND indexname = 'idx_audit_rules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_audit_rules_deleted_at ON audit_rules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_jobs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE backup_jobs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN backup_jobs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'backup_jobs' AND indexname = 'idx_backup_jobs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_backup_jobs_deleted_at ON backup_jobs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE backup_policies ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN backup_policies.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'backup_policies' AND indexname = 'idx_backup_policies_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_backup_policies_deleted_at ON backup_policies USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_restores' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE backup_restores ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN backup_restores.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'backup_restores' AND indexname = 'idx_backup_restores_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_backup_restores_deleted_at ON backup_restores USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_storages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE backup_storages ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN backup_storages.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'backup_storages' AND indexname = 'idx_backup_storages_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_backup_storages_deleted_at ON backup_storages USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_accounts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE billing_accounts ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN billing_accounts.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'billing_accounts' AND indexname = 'idx_billing_accounts_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_billing_accounts_deleted_at ON billing_accounts USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_invoices' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE billing_invoices ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN billing_invoices.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'billing_invoices' AND indexname = 'idx_billing_invoices_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_billing_invoices_deleted_at ON billing_invoices USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_line_items' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE billing_line_items ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN billing_line_items.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'billing_line_items' AND indexname = 'idx_billing_line_items_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_billing_line_items_deleted_at ON billing_line_items USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_subscriptions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE billing_subscriptions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN billing_subscriptions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'billing_subscriptions' AND indexname = 'idx_billing_subscriptions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_deleted_at ON billing_subscriptions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE build_cache_configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN build_cache_configs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'build_cache_configs' AND indexname = 'idx_build_cache_configs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_build_cache_configs_deleted_at ON build_cache_configs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE build_cache_entries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN build_cache_entries.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'build_cache_entries' AND indexname = 'idx_build_cache_entries_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_build_cache_entries_deleted_at ON build_cache_entries USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_images' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE build_images ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN build_images.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'build_images' AND indexname = 'idx_build_images_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_build_images_deleted_at ON build_images USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE build_logs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN build_logs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'build_logs' AND indexname = 'idx_build_logs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_build_logs_deleted_at ON build_logs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_deployments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE canary_deployments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN canary_deployments.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'canary_deployments' AND indexname = 'idx_canary_deployments_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_canary_deployments_deleted_at ON canary_deployments USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capabilities' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE capabilities ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN capabilities.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'capabilities' AND indexname = 'idx_capabilities_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_capabilities_deleted_at ON capabilities USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_audit_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE capability_audit_logs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN capability_audit_logs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'capability_audit_logs' AND indexname = 'idx_capability_audit_logs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_capability_audit_logs_deleted_at ON capability_audit_logs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_approvals' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE change_approvals ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN change_approvals.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'change_approvals' AND indexname = 'idx_change_approvals_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_change_approvals_deleted_at ON change_approvals USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE change_executions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN change_executions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'change_executions' AND indexname = 'idx_change_executions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_change_executions_deleted_at ON change_executions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_alert_states' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_alert_states ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_alert_states.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_alert_states' AND indexname = 'idx_chatops_alert_states_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_alert_states_deleted_at ON chatops_alert_states USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_approval_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_approval_configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_approval_configs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_approval_configs' AND indexname = 'idx_chatops_approval_configs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_approval_configs_deleted_at ON chatops_approval_configs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_audit_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_audit_logs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_audit_logs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_audit_logs' AND indexname = 'idx_chatops_audit_logs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_audit_logs_deleted_at ON chatops_audit_logs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_capability_mappings' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_capability_mappings ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_capability_mappings.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_capability_mappings' AND indexname = 'idx_chatops_capability_mappings_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_capability_mappings_deleted_at ON chatops_capability_mappings USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_command_configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_command_configs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_command_configs' AND indexname = 'idx_chatops_command_configs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_command_configs_deleted_at ON chatops_command_configs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_permissions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_command_permissions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_command_permissions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_command_permissions' AND indexname = 'idx_chatops_command_permissions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_command_permissions_deleted_at ON chatops_command_permissions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_command_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_command_versions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_command_versions' AND indexname = 'idx_chatops_command_versions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_command_versions_deleted_at ON chatops_command_versions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_commands' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_commands ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_commands.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_commands' AND indexname = 'idx_chatops_commands_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_commands_deleted_at ON chatops_commands USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_dnd_settings ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_dnd_settings.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_dnd_settings' AND indexname = 'idx_chatops_dnd_settings_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_dnd_settings_deleted_at ON chatops_dnd_settings USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_environment_permissions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_environment_permissions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_environment_permissions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_environment_permissions' AND indexname = 'idx_chatops_environment_permissions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_environment_permissions_deleted_at ON chatops_environment_permissions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_executions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_executions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_executions' AND indexname = 'idx_chatops_executions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_executions_deleted_at ON chatops_executions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_messages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_messages ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_messages.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_messages' AND indexname = 'idx_chatops_messages_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_messages_deleted_at ON chatops_messages USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_notification_preferences' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_notification_preferences ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_notification_preferences.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_notification_preferences' AND indexname = 'idx_chatops_notification_preferences_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_notification_preferences_deleted_at ON chatops_notification_preferences USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_permission_roles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_permission_roles ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_permission_roles.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_permission_roles' AND indexname = 'idx_chatops_permission_roles_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_permission_roles_deleted_at ON chatops_permission_roles USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_platform_configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_platform_configs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_platform_configs' AND indexname = 'idx_chatops_platform_configs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_platform_configs_deleted_at ON chatops_platform_configs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_question_configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_question_configs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_question_configs' AND indexname = 'idx_chatops_question_configs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_question_configs_deleted_at ON chatops_question_configs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_rate_limits' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_rate_limits ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_rate_limits.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_rate_limits' AND indexname = 'idx_chatops_rate_limits_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_rate_limits_deleted_at ON chatops_rate_limits USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_sessions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_sessions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_sessions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_sessions' AND indexname = 'idx_chatops_sessions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_sessions_deleted_at ON chatops_sessions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_webhooks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_webhooks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN chatops_webhooks.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_webhooks' AND indexname = 'idx_chatops_webhooks_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_chatops_webhooks_deleted_at ON chatops_webhooks USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_relations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ci_relations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ci_relations.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ci_relations' AND indexname = 'idx_ci_relations_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ci_relations_deleted_at ON ci_relations USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_attributes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ci_type_attributes ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ci_type_attributes.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ci_type_attributes' AND indexname = 'idx_ci_type_attributes_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ci_type_attributes_deleted_at ON ci_type_attributes USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ci_type_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ci_type_versions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ci_type_versions' AND indexname = 'idx_ci_type_versions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ci_type_versions_deleted_at ON ci_type_versions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_types' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ci_types ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ci_types.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ci_types' AND indexname = 'idx_ci_types_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ci_types_deleted_at ON ci_types USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ci_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ci_versions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ci_versions' AND indexname = 'idx_ci_versions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ci_versions_deleted_at ON ci_versions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE circuit_breaker_events ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN circuit_breaker_events.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'circuit_breaker_events' AND indexname = 'idx_circuit_breaker_events_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_deleted_at ON circuit_breaker_events USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cis' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cis ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN cis.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cis' AND indexname = 'idx_cis_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_cis_deleted_at ON cis USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repo_adapters' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE code_repo_adapters ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN code_repo_adapters.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'code_repo_adapters' AND indexname = 'idx_code_repo_adapters_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_code_repo_adapters_deleted_at ON code_repo_adapters USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repos' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE code_repos ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN code_repos.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'code_repos' AND indexname = 'idx_code_repos_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_code_repos_deleted_at ON code_repos USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collection_schedules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE collection_schedules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN collection_schedules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'collection_schedules' AND indexname = 'idx_collection_schedules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_collection_schedules_deleted_at ON collection_schedules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_log_details' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE command_log_details ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN command_log_details.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'command_log_details' AND indexname = 'idx_command_log_details_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_command_log_details_deleted_at ON command_log_details USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE command_logs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN command_logs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'command_logs' AND indexname = 'idx_command_logs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_command_logs_deleted_at ON command_logs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE comments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN comments.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'comments' AND indexname = 'idx_comments_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON comments USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_evidence' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE compliance_evidence ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN compliance_evidence.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'compliance_evidence' AND indexname = 'idx_compliance_evidence_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_compliance_evidence_deleted_at ON compliance_evidence USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_frameworks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE compliance_frameworks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN compliance_frameworks.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'compliance_frameworks' AND indexname = 'idx_compliance_frameworks_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_deleted_at ON compliance_frameworks USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE compliance_policies ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN compliance_policies.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'compliance_policies' AND indexname = 'idx_compliance_policies_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_compliance_policies_deleted_at ON compliance_policies USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_audit_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_audit_entries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN config_audit_entries.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_audit_entries' AND indexname = 'idx_config_audit_entries_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_config_audit_entries_deleted_at ON config_audit_entries USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_snapshots' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_snapshots ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN config_snapshots.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_snapshots' AND indexname = 'idx_config_snapshots_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_config_snapshots_deleted_at ON config_snapshots USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_template_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_template_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN config_template_versions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_template_versions' AND indexname = 'idx_config_template_versions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_config_template_versions_deleted_at ON config_template_versions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_templates' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_templates ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN config_templates.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_templates' AND indexname = 'idx_config_templates_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_config_templates_deleted_at ON config_templates USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN config_versions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_versions' AND indexname = 'idx_config_versions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_config_versions_deleted_at ON config_versions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_webhooks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_webhooks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN config_webhooks.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_webhooks' AND indexname = 'idx_config_webhooks_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_config_webhooks_deleted_at ON config_webhooks USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN configs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'configs' AND indexname = 'idx_configs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_configs_deleted_at ON configs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_endpoints' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE contract_endpoints ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN contract_endpoints.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'contract_endpoints' AND indexname = 'idx_contract_endpoints_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_contract_endpoints_deleted_at ON contract_endpoints USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_reports' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cost_allocation_reports ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN cost_allocation_reports.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cost_allocation_reports' AND indexname = 'idx_cost_allocation_reports_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_cost_allocation_reports_deleted_at ON cost_allocation_reports USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cost_allocation_rules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN cost_allocation_rules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cost_allocation_rules' AND indexname = 'idx_cost_allocation_rules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_cost_allocation_rules_deleted_at ON cost_allocation_rules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_tags' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cost_allocation_tags ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN cost_allocation_tags.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cost_allocation_tags' AND indexname = 'idx_cost_allocation_tags_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_cost_allocation_tags_deleted_at ON cost_allocation_tags USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cost_allocations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN cost_allocations.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cost_allocations' AND indexname = 'idx_cost_allocations_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_cost_allocations_deleted_at ON cost_allocations USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cron_job_executions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN cron_job_executions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cron_job_executions' AND indexname = 'idx_cron_job_executions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_cron_job_executions_deleted_at ON cron_job_executions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cron_job_logs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN cron_job_logs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cron_job_logs' AND indexname = 'idx_cron_job_logs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_cron_job_logs_deleted_at ON cron_job_logs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_jobs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cron_jobs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN cron_jobs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cron_jobs' AND indexname = 'idx_cron_jobs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_cron_jobs_deleted_at ON cron_jobs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_lineages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE data_lineages ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN data_lineages.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'data_lineages' AND indexname = 'idx_data_lineages_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_data_lineages_deleted_at ON data_lineages USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_pipelines' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE data_pipelines ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN data_pipelines.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'data_pipelines' AND indexname = 'idx_data_pipelines_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_data_pipelines_deleted_at ON data_pipelines USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_quality_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE data_quality_rules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN data_quality_rules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'data_quality_rules' AND indexname = 'idx_data_quality_rules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_data_quality_rules_deleted_at ON data_quality_rules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_sources' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE data_sources ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN data_sources.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'data_sources' AND indexname = 'idx_data_sources_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_data_sources_deleted_at ON data_sources USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_audit_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE deploy_audit_entries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN deploy_audit_entries.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'deploy_audit_entries' AND indexname = 'idx_deploy_audit_entries_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_deploy_audit_entries_deleted_at ON deploy_audit_entries USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_windows' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE deploy_windows ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN deploy_windows.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'deploy_windows' AND indexname = 'idx_deploy_windows_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_deploy_windows_deleted_at ON deploy_windows USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE deployments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN deployments.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'deployments' AND indexname = 'idx_deployments_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_deployments_deleted_at ON deployments USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developer_portals' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE developer_portals ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN developer_portals.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'developer_portals' AND indexname = 'idx_developer_portals_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_developer_portals_deleted_at ON developer_portals USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_patterns' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE diagnostic_patterns ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN diagnostic_patterns.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'diagnostic_patterns' AND indexname = 'idx_diagnostic_patterns_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_diagnostic_patterns_deleted_at ON diagnostic_patterns USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_reports' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN diagnostic_reports.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'diagnostic_reports' AND indexname = 'idx_diagnostic_reports_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_deleted_at ON diagnostic_reports USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_sessions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE diagnostic_sessions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN diagnostic_sessions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'diagnostic_sessions' AND indexname = 'idx_diagnostic_sessions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_deleted_at ON diagnostic_sessions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_symptoms' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE diagnostic_symptoms ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN diagnostic_symptoms.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'diagnostic_symptoms' AND indexname = 'idx_diagnostic_symptoms_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_diagnostic_symptoms_deleted_at ON diagnostic_symptoms USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN document_versions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'document_versions' AND indexname = 'idx_document_versions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_document_versions_deleted_at ON document_versions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE domain_events ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN domain_events.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'domain_events' AND indexname = 'idx_domain_events_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_domain_events_deleted_at ON domain_events USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_snapshots' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE domain_snapshots ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN domain_snapshots.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'domain_snapshots' AND indexname = 'idx_domain_snapshots_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_domain_snapshots_deleted_at ON domain_snapshots USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_metrics' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE efficiency_metrics ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN efficiency_metrics.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'efficiency_metrics' AND indexname = 'idx_efficiency_metrics_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_efficiency_metrics_deleted_at ON efficiency_metrics USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_recommendations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE efficiency_recommendations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN efficiency_recommendations.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'efficiency_recommendations' AND indexname = 'idx_efficiency_recommendations_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_efficiency_recommendations_deleted_at ON efficiency_recommendations USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_scores' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE efficiency_scores ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN efficiency_scores.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'efficiency_scores' AND indexname = 'idx_efficiency_scores_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_efficiency_scores_deleted_at ON efficiency_scores USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emergency_deploys' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE emergency_deploys ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN emergency_deploys.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'emergency_deploys' AND indexname = 'idx_emergency_deploys_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_emergency_deploys_deleted_at ON emergency_deploys USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escalation_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE escalation_policies ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN escalation_policies.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'escalation_policies' AND indexname = 'idx_escalation_policies_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_escalation_policies_deleted_at ON escalation_policies USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_triggers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE event_triggers ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN event_triggers.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'event_triggers' AND indexname = 'idx_event_triggers_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_event_triggers_deleted_at ON event_triggers USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE events ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN events.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'events' AND indexname = 'idx_events_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON events USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_runs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE experiment_runs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN experiment_runs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'experiment_runs' AND indexname = 'idx_experiment_runs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_experiment_runs_deleted_at ON experiment_runs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_flags' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE feature_flags ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN feature_flags.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'feature_flags' AND indexname = 'idx_feature_flags_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_feature_flags_deleted_at ON feature_flags USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'federated_clusters' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE federated_clusters ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN federated_clusters.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'federated_clusters' AND indexname = 'idx_federated_clusters_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_federated_clusters_deleted_at ON federated_clusters USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_anomalies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE finops_anomalies ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN finops_anomalies.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'finops_anomalies' AND indexname = 'idx_finops_anomalies_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_finops_anomalies_deleted_at ON finops_anomalies USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_budget_guards' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE finops_budget_guards ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN finops_budget_guards.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'finops_budget_guards' AND indexname = 'idx_finops_budget_guards_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_finops_budget_guards_deleted_at ON finops_budget_guards USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_cost_items' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE finops_cost_items ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN finops_cost_items.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'finops_cost_items' AND indexname = 'idx_finops_cost_items_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_finops_cost_items_deleted_at ON finops_cost_items USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_reports' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE finops_reports ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN finops_reports.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'finops_reports' AND indexname = 'idx_finops_reports_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_finops_reports_deleted_at ON finops_reports USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flag_toggle_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE flag_toggle_history ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN flag_toggle_history.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'flag_toggle_history' AND indexname = 'idx_flag_toggle_history_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_flag_toggle_history_deleted_at ON flag_toggle_history USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gateway_routes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE gateway_routes ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN gateway_routes.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'gateway_routes' AND indexname = 'idx_gateway_routes_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_gateway_routes_deleted_at ON gateway_routes USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'git_changelog_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE git_changelog_entries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN git_changelog_entries.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'git_changelog_entries' AND indexname = 'idx_git_changelog_entries_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_git_changelog_entries_deleted_at ON git_changelog_entries USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE gitops_configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN gitops_configs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'gitops_configs' AND indexname = 'idx_gitops_configs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_gitops_configs_deleted_at ON gitops_configs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_sync_statuses' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE gitops_sync_statuses ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN gitops_sync_statuses.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'gitops_sync_statuses' AND indexname = 'idx_gitops_sync_statuses_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_gitops_sync_statuses_deleted_at ON gitops_sync_statuses USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE handler_registries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN handler_registries.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'handler_registries' AND indexname = 'idx_handler_registries_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_handler_registries_deleted_at ON handler_registries USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registry_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE handler_registry_entries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN handler_registry_entries.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'handler_registry_entries' AND indexname = 'idx_handler_registry_entries_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_handler_registry_entries_deleted_at ON handler_registry_entries USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hook_chains' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE hook_chains ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN hook_chains.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'hook_chains' AND indexname = 'idx_hook_chains_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_hook_chains_deleted_at ON hook_chains USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hotfix_channels' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE hotfix_channels ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN hotfix_channels.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'hotfix_channels' AND indexname = 'idx_hotfix_channels_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_hotfix_channels_deleted_at ON hotfix_channels USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'i18n_translations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE i18n_translations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN i18n_translations.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'i18n_translations' AND indexname = 'idx_i18n_translations_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_i18n_translations_deleted_at ON i18n_translations USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_plans' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE iac_plans ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN iac_plans.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'iac_plans' AND indexname = 'idx_iac_plans_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_iac_plans_deleted_at ON iac_plans USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_resources' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE iac_resources ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN iac_resources.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'iac_resources' AND indexname = 'idx_iac_resources_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_iac_resources_deleted_at ON iac_resources USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_state_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE iac_state_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN iac_state_versions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'iac_state_versions' AND indexname = 'idx_iac_state_versions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_iac_state_versions_deleted_at ON iac_state_versions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspace_modules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE iac_workspace_modules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN iac_workspace_modules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'iac_workspace_modules' AND indexname = 'idx_iac_workspace_modules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_iac_workspace_modules_deleted_at ON iac_workspace_modules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspaces' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE iac_workspaces ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN iac_workspaces.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'iac_workspaces' AND indexname = 'idx_iac_workspaces_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_iac_workspaces_deleted_at ON iac_workspaces USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inception_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE inception_configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN inception_configs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'inception_configs' AND indexname = 'idx_inception_configs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_inception_configs_deleted_at ON inception_configs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_escalations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE incident_escalations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN incident_escalations.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'incident_escalations' AND indexname = 'idx_incident_escalations_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_incident_escalations_deleted_at ON incident_escalations USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_postmortems' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE incident_postmortems ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN incident_postmortems.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'incident_postmortems' AND indexname = 'idx_incident_postmortems_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_incident_postmortems_deleted_at ON incident_postmortems USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_timeline_events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE incident_timeline_events ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN incident_timeline_events.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'incident_timeline_events' AND indexname = 'idx_incident_timeline_events_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_incident_timeline_events_deleted_at ON incident_timeline_events USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE incidents ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN incidents.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'incidents' AND indexname = 'idx_incidents_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_incidents_deleted_at ON incidents USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_connectors' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE infrastructure_connectors ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN infrastructure_connectors.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'infrastructure_connectors' AND indexname = 'idx_infrastructure_connectors_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_infrastructure_connectors_deleted_at ON infrastructure_connectors USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_sandboxes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE infrastructure_sandboxes ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN infrastructure_sandboxes.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'infrastructure_sandboxes' AND indexname = 'idx_infrastructure_sandboxes_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_infrastructure_sandboxes_deleted_at ON infrastructure_sandboxes USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'internal_libraries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE internal_libraries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN internal_libraries.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'internal_libraries' AND indexname = 'idx_internal_libraries_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_internal_libraries_deleted_at ON internal_libraries USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_doc_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE knowledge_doc_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN knowledge_doc_versions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'knowledge_doc_versions' AND indexname = 'idx_knowledge_doc_versions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_knowledge_doc_versions_deleted_at ON knowledge_doc_versions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_documents' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE knowledge_documents ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN knowledge_documents.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'knowledge_documents' AND indexname = 'idx_knowledge_documents_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_knowledge_documents_deleted_at ON knowledge_documents USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_spaces' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE knowledge_spaces ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN knowledge_spaces.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'knowledge_spaces' AND indexname = 'idx_knowledge_spaces_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_knowledge_spaces_deleted_at ON knowledge_spaces USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_sync_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE knowledge_sync_logs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN knowledge_sync_logs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'knowledge_sync_logs' AND indexname = 'idx_knowledge_sync_logs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_knowledge_sync_logs_deleted_at ON knowledge_sync_logs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_dependents' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE library_dependents ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN library_dependents.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'library_dependents' AND indexname = 'idx_library_dependents_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_library_dependents_deleted_at ON library_dependents USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE library_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN library_versions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'library_versions' AND indexname = 'idx_library_versions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_library_versions_deleted_at ON library_versions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_nodes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE lineage_nodes ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN lineage_nodes.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lineage_nodes' AND indexname = 'idx_lineage_nodes_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_lineage_nodes_deleted_at ON lineage_nodes USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_relationships' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE lineage_relationships ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN lineage_relationships.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lineage_relationships' AND indexname = 'idx_lineage_relationships_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_lineage_relationships_deleted_at ON lineage_relationships USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locales' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE locales ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN locales.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'locales' AND indexname = 'idx_locales_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_locales_deleted_at ON locales USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_definition' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE lowcode_workflow_definition ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN lowcode_workflow_definition.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lowcode_workflow_definition' AND indexname = 'idx_lowcode_workflow_definition_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_lowcode_workflow_definition_deleted_at ON lowcode_workflow_definition USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_instance' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE lowcode_workflow_instance ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN lowcode_workflow_instance.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lowcode_workflow_instance' AND indexname = 'idx_lowcode_workflow_instance_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_lowcode_workflow_instance_deleted_at ON lowcode_workflow_instance USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE mock_rules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN mock_rules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'mock_rules' AND indexname = 'idx_mock_rules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_mock_rules_deleted_at ON mock_rules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alert_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE monitoring_alert_rules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN monitoring_alert_rules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'monitoring_alert_rules' AND indexname = 'idx_monitoring_alert_rules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_monitoring_alert_rules_deleted_at ON monitoring_alert_rules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alerts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE monitoring_alerts ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN monitoring_alerts.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'monitoring_alerts' AND indexname = 'idx_monitoring_alerts_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_deleted_at ON monitoring_alerts USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_anomalies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE monitoring_anomalies ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN monitoring_anomalies.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'monitoring_anomalies' AND indexname = 'idx_monitoring_anomalies_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_monitoring_anomalies_deleted_at ON monitoring_anomalies USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_metrics' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE monitoring_metrics ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN monitoring_metrics.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'monitoring_metrics' AND indexname = 'idx_monitoring_metrics_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_deleted_at ON monitoring_metrics USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'namespace_allocations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE namespace_allocations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN namespace_allocations.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'namespace_allocations' AND indexname = 'idx_namespace_allocations_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_namespace_allocations_deleted_at ON namespace_allocations USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_records' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE notification_records ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN notification_records.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'notification_records' AND indexname = 'idx_notification_records_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_notification_records_deleted_at ON notification_records USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_templates' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE notification_templates ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN notification_templates.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'notification_templates' AND indexname = 'idx_notification_templates_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_notification_templates_deleted_at ON notification_templates USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_assignments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE oncall_assignments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN oncall_assignments.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'oncall_assignments' AND indexname = 'idx_oncall_assignments_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_oncall_assignments_deleted_at ON oncall_assignments USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_overrides' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE oncall_overrides ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN oncall_overrides.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'oncall_overrides' AND indexname = 'idx_oncall_overrides_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_oncall_overrides_deleted_at ON oncall_overrides USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_schedules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE oncall_schedules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN oncall_schedules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'oncall_schedules' AND indexname = 'idx_oncall_schedules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_oncall_schedules_deleted_at ON oncall_schedules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE page_registries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN page_registries.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'page_registries' AND indexname = 'idx_page_registries_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_page_registries_deleted_at ON page_registries USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registry_histories' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE page_registry_histories ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN page_registry_histories.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'page_registry_histories' AND indexname = 'idx_page_registry_histories_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_page_registry_histories_deleted_at ON page_registry_histories USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_requests' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE permission_requests ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN permission_requests.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'permission_requests' AND indexname = 'idx_permission_requests_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_permission_requests_deleted_at ON permission_requests USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permissions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE permissions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN permissions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'permissions' AND indexname = 'idx_permissions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_permissions_deleted_at ON permissions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_checkpoints' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE pipeline_checkpoints ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN pipeline_checkpoints.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pipeline_checkpoints' AND indexname = 'idx_pipeline_checkpoints_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_pipeline_checkpoints_deleted_at ON pipeline_checkpoints USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_stages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE pipeline_stages ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN pipeline_stages.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pipeline_stages' AND indexname = 'idx_pipeline_stages_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_pipeline_stages_deleted_at ON pipeline_stages USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_tasks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE pipeline_tasks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN pipeline_tasks.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pipeline_tasks' AND indexname = 'idx_pipeline_tasks_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_deleted_at ON pipeline_tasks USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playground_requests' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE playground_requests ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN playground_requests.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'playground_requests' AND indexname = 'idx_playground_requests_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_playground_requests_deleted_at ON playground_requests USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_audit_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugin_audit_entries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN plugin_audit_entries.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugin_audit_entries' AND indexname = 'idx_plugin_audit_entries_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_plugin_audit_entries_deleted_at ON plugin_audit_entries USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugin_executions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN plugin_executions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugin_executions' AND indexname = 'idx_plugin_executions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_plugin_executions_deleted_at ON plugin_executions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_resource_quotas' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugin_resource_quotas ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN plugin_resource_quotas.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugin_resource_quotas' AND indexname = 'idx_plugin_resource_quotas_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_plugin_resource_quotas_deleted_at ON plugin_resource_quotas USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_security_events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugin_security_events ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN plugin_security_events.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugin_security_events' AND indexname = 'idx_plugin_security_events_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_plugin_security_events_deleted_at ON plugin_security_events USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_tenant_quotas' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugin_tenant_quotas ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN plugin_tenant_quotas.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugin_tenant_quotas' AND indexname = 'idx_plugin_tenant_quotas_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_plugin_tenant_quotas_deleted_at ON plugin_tenant_quotas USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugins' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugins ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN plugins.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugins' AND indexname = 'idx_plugins_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_plugins_deleted_at ON plugins USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_bundles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE policy_bundles ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN policy_bundles.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'policy_bundles' AND indexname = 'idx_policy_bundles_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_policy_bundles_deleted_at ON policy_bundles USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_evaluations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE policy_evaluations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN policy_evaluations.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'policy_evaluations' AND indexname = 'idx_policy_evaluations_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_policy_evaluations_deleted_at ON policy_evaluations USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_exemptions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE policy_exemptions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN policy_exemptions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'policy_exemptions' AND indexname = 'idx_policy_exemptions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_policy_exemptions_deleted_at ON policy_exemptions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_overrides' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE policy_overrides ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN policy_overrides.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'policy_overrides' AND indexname = 'idx_policy_overrides_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_policy_overrides_deleted_at ON policy_overrides USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_violations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE policy_violations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN policy_violations.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'policy_violations' AND indexname = 'idx_policy_violations_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_policy_violations_deleted_at ON policy_violations USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_documents' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE portal_documents ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN portal_documents.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'portal_documents' AND indexname = 'idx_portal_documents_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_portal_documents_deleted_at ON portal_documents USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_change_links' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE problem_change_links ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN problem_change_links.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'problem_change_links' AND indexname = 'idx_problem_change_links_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_problem_change_links_deleted_at ON problem_change_links USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_incident_links' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE problem_incident_links ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN problem_incident_links.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'problem_incident_links' AND indexname = 'idx_problem_incident_links_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_problem_incident_links_deleted_at ON problem_incident_links USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_known_errors' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE problem_known_errors ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN problem_known_errors.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'problem_known_errors' AND indexname = 'idx_problem_known_errors_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_problem_known_errors_deleted_at ON problem_known_errors USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_problems' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE problem_problems ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN problem_problems.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'problem_problems' AND indexname = 'idx_problem_problems_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_problem_problems_deleted_at ON problem_problems USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lines' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE product_lines ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN product_lines.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'product_lines' AND indexname = 'idx_product_lines_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_product_lines_deleted_at ON product_lines USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressive_deploys' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE progressive_deploys ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN progressive_deploys.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'progressive_deploys' AND indexname = 'idx_progressive_deploys_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_progressive_deploys_deleted_at ON progressive_deploys USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_members' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE project_members ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN project_members.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'project_members' AND indexname = 'idx_project_members_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_project_members_deleted_at ON project_members USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pull_requests' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE pull_requests ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN pull_requests.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pull_requests' AND indexname = 'idx_pull_requests_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_pull_requests_deleted_at ON pull_requests USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_alerts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE quality_alerts ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN quality_alerts.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'quality_alerts' AND indexname = 'idx_quality_alerts_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_quality_alerts_deleted_at ON quality_alerts USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_scan_results' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE quality_scan_results ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN quality_scan_results.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'quality_scan_results' AND indexname = 'idx_quality_scan_results_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_quality_scan_results_deleted_at ON quality_scan_results USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_execution_records' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE query_execution_records ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN query_execution_records.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'query_execution_records' AND indexname = 'idx_query_execution_records_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_query_execution_records_deleted_at ON query_execution_records USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recording_sessions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE recording_sessions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN recording_sessions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'recording_sessions' AND indexname = 'idx_recording_sessions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_recording_sessions_deleted_at ON recording_sessions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_notes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE release_notes ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN release_notes.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'release_notes' AND indexname = 'idx_release_notes_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_release_notes_deleted_at ON release_notes USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_trains' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE release_trains ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN release_trains.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'release_trains' AND indexname = 'idx_release_trains_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_release_trains_deleted_at ON release_trains USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'replay_sessions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE replay_sessions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN replay_sessions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'replay_sessions' AND indexname = 'idx_replay_sessions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_replay_sessions_deleted_at ON replay_sessions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_datasources' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE report_datasources ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN report_datasources.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'report_datasources' AND indexname = 'idx_report_datasources_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_report_datasources_deleted_at ON report_datasources USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_definitions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE report_definitions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN report_definitions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'report_definitions' AND indexname = 'idx_report_definitions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_report_definitions_deleted_at ON report_definitions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE report_executions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN report_executions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'report_executions' AND indexname = 'idx_report_executions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_report_executions_deleted_at ON report_executions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_schedules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE report_schedules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN report_schedules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'report_schedules' AND indexname = 'idx_report_schedules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_report_schedules_deleted_at ON report_schedules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'response_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE response_history ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN response_history.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'response_history' AND indexname = 'idx_response_history_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_response_history_deleted_at ON response_history USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retention_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE retention_policies ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN retention_policies.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'retention_policies' AND indexname = 'idx_retention_policies_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_retention_policies_deleted_at ON retention_policies USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE reviews ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN reviews.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'reviews' AND indexname = 'idx_reviews_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_reviews_deleted_at ON reviews USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roi_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE roi_entries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN roi_entries.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'roi_entries' AND indexname = 'idx_roi_entries_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_roi_entries_deleted_at ON roi_entries USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE roles ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN roles.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'roles' AND indexname = 'idx_roles_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_roles_deleted_at ON roles USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rollbacks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE rollbacks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN rollbacks.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'rollbacks' AND indexname = 'idx_rollbacks_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_rollbacks_deleted_at ON rollbacks USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_instances' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE saga_instances ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN saga_instances.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'saga_instances' AND indexname = 'idx_saga_instances_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_saga_instances_deleted_at ON saga_instances USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_steps' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE saga_steps ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN saga_steps.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'saga_steps' AND indexname = 'idx_saga_steps_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_saga_steps_deleted_at ON saga_steps USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_transactions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE saga_transactions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN saga_transactions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'saga_transactions' AND indexname = 'idx_saga_transactions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_saga_transactions_deleted_at ON saga_transactions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sandbox_network_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sandbox_network_policies ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN sandbox_network_policies.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sandbox_network_policies' AND indexname = 'idx_sandbox_network_policies_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sandbox_network_policies_deleted_at ON sandbox_network_policies USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_reports' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE scan_reports ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN scan_reports.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'scan_reports' AND indexname = 'idx_scan_reports_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_scan_reports_deleted_at ON scan_reports USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_templates' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE script_templates ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN script_templates.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'script_templates' AND indexname = 'idx_script_templates_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_script_templates_deleted_at ON script_templates USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sdk_tasks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sdk_tasks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN sdk_tasks.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sdk_tasks' AND indexname = 'idx_sdk_tasks_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sdk_tasks_deleted_at ON sdk_tasks USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_deployments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE serverless_deployments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN serverless_deployments.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'serverless_deployments' AND indexname = 'idx_serverless_deployments_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_serverless_deployments_deleted_at ON serverless_deployments USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_function_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE serverless_function_logs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN serverless_function_logs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'serverless_function_logs' AND indexname = 'idx_serverless_function_logs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_serverless_function_logs_deleted_at ON serverless_function_logs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_functions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE serverless_functions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN serverless_functions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'serverless_functions' AND indexname = 'idx_serverless_functions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_serverless_functions_deleted_at ON serverless_functions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_triggers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE serverless_triggers ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN serverless_triggers.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'serverless_triggers' AND indexname = 'idx_serverless_triggers_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_serverless_triggers_deleted_at ON serverless_triggers USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_registries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE service_registries ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN service_registries.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'service_registries' AND indexname = 'idx_service_registries_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_service_registries_deleted_at ON service_registries USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sessions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN sessions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sessions' AND indexname = 'idx_sessions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at ON sessions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_breach_events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sla_breach_events ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN sla_breach_events.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sla_breach_events' AND indexname = 'idx_sla_breach_events_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sla_breach_events_deleted_at ON sla_breach_events USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_definitions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sla_definitions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN sla_definitions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sla_definitions' AND indexname = 'idx_sla_definitions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sla_definitions_deleted_at ON sla_definitions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_trackings' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sla_trackings ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN sla_trackings.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sla_trackings' AND indexname = 'idx_sla_trackings_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sla_trackings_deleted_at ON sla_trackings USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_audit' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE smart_deploy_audit ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN smart_deploy_audit.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'smart_deploy_audit' AND indexname = 'idx_smart_deploy_audit_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_smart_deploy_audit_deleted_at ON smart_deploy_audit USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_deployments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE smart_deploy_deployments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN smart_deploy_deployments.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'smart_deploy_deployments' AND indexname = 'idx_smart_deploy_deployments_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_smart_deploy_deployments_deleted_at ON smart_deploy_deployments USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_rollbacks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE smart_deploy_rollbacks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN smart_deploy_rollbacks.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'smart_deploy_rollbacks' AND indexname = 'idx_smart_deploy_rollbacks_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_smart_deploy_rollbacks_deleted_at ON smart_deploy_rollbacks USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE snapshots ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN snapshots.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'snapshots' AND indexname = 'idx_snapshots_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_snapshots_deleted_at ON snapshots USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprint_tickets' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sprint_tickets ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN sprint_tickets.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sprint_tickets' AND indexname = 'idx_sprint_tickets_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sprint_tickets_deleted_at ON sprint_tickets USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprints' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sprints ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN sprints.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sprints' AND indexname = 'idx_sprints_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sprints_deleted_at ON sprints USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_audit_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sql_audit_history ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN sql_audit_history.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sql_audit_history' AND indexname = 'idx_sql_audit_history_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sql_audit_history_deleted_at ON sql_audit_history USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_blacklist' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sql_blacklist ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN sql_blacklist.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sql_blacklist' AND indexname = 'idx_sql_blacklist_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sql_blacklist_deleted_at ON sql_blacklist USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_orders' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sql_orders ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN sql_orders.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sql_orders' AND indexname = 'idx_sql_orders_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sql_orders_deleted_at ON sql_orders USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_config_histories' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE subapp_config_histories ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN subapp_config_histories.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subapp_config_histories' AND indexname = 'idx_subapp_config_histories_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_subapp_config_histories_deleted_at ON subapp_config_histories USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE subapp_configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN subapp_configs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subapp_configs' AND indexname = 'idx_subapp_configs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_subapp_configs_deleted_at ON subapp_configs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN subscriptions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subscriptions' AND indexname = 'idx_subscriptions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_deleted_at ON subscriptions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE team_members ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN team_members.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'team_members' AND indexname = 'idx_team_members_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_team_members_deleted_at ON team_members USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_roles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE team_roles ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN team_roles.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'team_roles' AND indexname = 'idx_team_roles_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_team_roles_deleted_at ON team_roles USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE teams ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN teams.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'teams' AND indexname = 'idx_teams_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_teams_deleted_at ON teams USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE temporary_permissions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN temporary_permissions.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'temporary_permissions' AND indexname = 'idx_temporary_permissions_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_temporary_permissions_deleted_at ON temporary_permissions USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_invites' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE tenant_invites ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN tenant_invites.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tenant_invites' AND indexname = 'idx_tenant_invites_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_tenant_invites_deleted_at ON tenant_invites USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quota_alerts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE tenant_quota_alerts ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN tenant_quota_alerts.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tenant_quota_alerts' AND indexname = 'idx_tenant_quota_alerts_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_tenant_quota_alerts_deleted_at ON tenant_quota_alerts USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quotas' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE tenant_quotas ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN tenant_quotas.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tenant_quotas' AND indexname = 'idx_tenant_quotas_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_tenant_quotas_deleted_at ON tenant_quotas USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_users' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE tenant_users ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN tenant_users.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tenant_users' AND indexname = 'idx_tenant_users_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_tenant_users_deleted_at ON tenant_users USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignment_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_assignment_rules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_assignment_rules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_assignment_rules' AND indexname = 'idx_ticket_assignment_rules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_assignment_rules_deleted_at ON ticket_assignment_rules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_assignments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_assignments.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_assignments' AND indexname = 'idx_ticket_assignments_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_assignments_deleted_at ON ticket_assignments USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_automation_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_automation_rules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_automation_rules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_automation_rules' AND indexname = 'idx_ticket_automation_rules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_automation_rules_deleted_at ON ticket_automation_rules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_engineers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_dispatch_engineers ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_dispatch_engineers.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_dispatch_engineers' AND indexname = 'idx_ticket_dispatch_engineers_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_dispatch_engineers_deleted_at ON ticket_dispatch_engineers USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_dispatch_rules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_dispatch_rules.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_dispatch_rules' AND indexname = 'idx_ticket_dispatch_rules_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_dispatch_rules_deleted_at ON ticket_dispatch_rules USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_relations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_relations ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_relations.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_relations' AND indexname = 'idx_ticket_relations_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_relations_deleted_at ON ticket_relations USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_breaches' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_sla_breaches ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_sla_breaches.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_sla_breaches' AND indexname = 'idx_ticket_sla_breaches_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_sla_breaches_deleted_at ON ticket_sla_breaches USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_sla_policies ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_sla_policies.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_sla_policies' AND indexname = 'idx_ticket_sla_policies_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_sla_policies_deleted_at ON ticket_sla_policies USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_targets' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_sla_targets ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_sla_targets.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_sla_targets' AND indexname = 'idx_ticket_sla_targets_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_sla_targets_deleted_at ON ticket_sla_targets USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_tracking' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_sla_tracking ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_sla_tracking.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_sla_tracking' AND indexname = 'idx_ticket_sla_tracking_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_sla_tracking_deleted_at ON ticket_sla_tracking USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_suspends' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_suspends ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_suspends.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_suspends' AND indexname = 'idx_ticket_suspends_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_suspends_deleted_at ON ticket_suspends USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_transfers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_transfers ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_transfers.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_transfers' AND indexname = 'idx_ticket_transfers_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_transfers_deleted_at ON ticket_transfers USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_workflow_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_workflow_history ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticket_workflow_history.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_workflow_history' AND indexname = 'idx_ticket_workflow_history_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_workflow_history_deleted_at ON ticket_workflow_history USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_dispatch_weights' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticketing_dispatch_weights ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticketing_dispatch_weights.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticketing_dispatch_weights' AND indexname = 'idx_ticketing_dispatch_weights_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticketing_dispatch_weights_deleted_at ON ticketing_dispatch_weights USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_service_state' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticketing_service_state ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN ticketing_service_state.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticketing_service_state' AND indexname = 'idx_ticketing_service_state_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ticketing_service_state_deleted_at ON ticketing_service_state USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE tickets ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN tickets.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tickets' AND indexname = 'idx_tickets_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON tickets USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traffic_records' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE traffic_records ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN traffic_records.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'traffic_records' AND indexname = 'idx_traffic_records_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_traffic_records_deleted_at ON traffic_records USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'upload_tasks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE upload_tasks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN upload_tasks.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'upload_tasks' AND indexname = 'idx_upload_tasks_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_upload_tasks_deleted_at ON upload_tasks USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_limits' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE usage_limits ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN usage_limits.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'usage_limits' AND indexname = 'idx_usage_limits_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_usage_limits_deleted_at ON usage_limits USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_records' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE usage_records ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN usage_records.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'usage_records' AND indexname = 'idx_usage_records_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_usage_records_deleted_at ON usage_records USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'idx_users_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhooks_secrets' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE webhooks_secrets ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN webhooks_secrets.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'webhooks_secrets' AND indexname = 'idx_webhooks_secrets_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_webhooks_secrets_deleted_at ON webhooks_secrets USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'widget_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE widget_configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN widget_configs.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'widget_configs' AND indexname = 'idx_widget_configs_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_widget_configs_deleted_at ON widget_configs USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbenches' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE workbenches ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN workbenches.deleted_at IS 'Soft delete timestamp; NULL means active';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'workbenches' AND indexname = 'idx_workbenches_deleted_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_workbenches_deleted_at ON workbenches USING btree (deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Migration complete
SELECT 'Added soft delete to 282 tables' AS migration_result;

COMMIT;
