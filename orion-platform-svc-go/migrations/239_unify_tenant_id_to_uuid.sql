-- Migration: 239_unify_tenant_id_to_uuid.sql
-- Purpose: Unify all tenant_id columns from VARCHAR(255)/VARCHAR(36) to PostgreSQL native UUID
-- Impact: 171 tables affected
-- Notes: Safe conversion using USING clause; idempotent with IF EXISTS guard
--        This is a data-type-only change. Existing UUID-valued VARCHAR data will convert
--        automatically via ::UUID cast.
--
-- Migration number 239 follows the last existing migration (238).

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_b_a_c_policies' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE a_b_a_c_policies ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN a_b_a_c_policies.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_agents' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE a_i_agents ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN a_i_agents.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_decisions' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE a_i_decisions ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN a_i_decisions.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_models' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE a_i_models ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN a_i_models.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_audit_logs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE agent_audit_logs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN agent_audit_logs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE agents ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN agents.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_feedback' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE ai_decision_feedback ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN ai_decision_feedback.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE ai_decision_traces ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN ai_decision_traces.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decisions' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE ai_decisions ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN ai_decisions.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_gateway_requests' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE ai_gateway_requests ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN ai_gateway_requests.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_breakers' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE alert_breakers ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN alert_breakers.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysises' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE analysises ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN analysises.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apk_upload_records' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE apk_upload_records ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN apk_upload_records.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apm_entries' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE apm_entries ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN apm_entries.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_lifecycles' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE artifact_lifecycles ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN artifact_lifecycles.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_signatures' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE artifact_signatures ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN artifact_signatures.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifacts' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE artifacts ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN artifacts.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE audit_logs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN audit_logs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_keies' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE auth_keies ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN auth_keies.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_token_blacklists' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE auth_token_blacklists ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN auth_token_blacklists.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'baselines' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE baselines ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN baselines.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_runs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE batch_runs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN batch_runs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bi_dashboards' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE bi_dashboards ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN bi_dashboards.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_configs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE budget_configs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN budget_configs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_history_records' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE budget_history_records ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN budget_history_records.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE budgets ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN budgets.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_environments' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE build_environments ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN build_environments.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'builds' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE builds ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN builds.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_cleanups' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE cache_cleanups ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN cache_cleanups.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_entries' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE cache_entries ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN cache_entries.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_configs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE canary_configs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN canary_configs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_traffics' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE canary_traffics ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN canary_traffics.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_analysises' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE change_analysises ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN change_analysises.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_histories' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE change_histories ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN change_histories.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_requests' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE change_requests ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN change_requests.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chaos_experiments' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE chaos_experiments ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN chaos_experiments.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chargeback_entries' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE chargeback_entries ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN chargeback_entries.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checkpoints' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE checkpoints ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN checkpoints.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE circuit_breaker_events ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN circuit_breaker_events.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breakers' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE circuit_breakers ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN circuit_breakers.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cloud_accounts' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE cloud_accounts ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN cloud_accounts.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cloud_resources' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE cloud_resources ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN cloud_resources.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE communities ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN communities.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_advanceds' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE community_advanceds ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN community_advanceds.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_reports' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE compliance_reports ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN compliance_reports.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_schedules' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE compliance_schedules ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN compliance_schedules.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_mgmts' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE config_mgmts ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN config_mgmts.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_entries' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE cost_entries ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN cost_entries.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_records' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE cost_records ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN cost_records.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cross_domains' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE cross_domains ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN cross_domains.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_pipelines' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE data_pipelines ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN data_pipelines.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_explanations' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE decision_explanations ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN decision_explanations.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_feedbacks' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE decision_feedbacks ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN decision_feedbacks.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_traces' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE decision_traces ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN decision_traces.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decisions' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE decisions ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN decisions.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_configs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE degradation_configs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN degradation_configs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_histories' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE degradation_histories ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN degradation_histories.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradations' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE degradations ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN degradations.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dependency_coordinations' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE dependency_coordinations ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN dependency_coordinations.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployment_triggers' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE deployment_triggers ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN deployment_triggers.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'digital_twins' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE digital_twins ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN digital_twins.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'disaster_plans' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE disaster_plans ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN disaster_plans.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'do_not_disturbs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE do_not_disturbs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN do_not_disturbs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drift_reports' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE drift_reports ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN drift_reports.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dual_engines' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE dual_engines ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN dual_engines.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_lifecycles' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE env_lifecycles ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN env_lifecycles.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_profiles' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE env_profiles ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN env_profiles.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'environments' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE environments ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN environments.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ephemeral_envs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE ephemeral_envs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN ephemeral_envs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'error_budgets' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE error_budgets ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN error_budgets.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evaluations' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE evaluations ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN evaluations.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execution_control_logs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE execution_control_logs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN execution_control_logs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_logs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE experiment_logs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN experiment_logs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_results' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE experiment_results ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN experiment_results.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiments' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE experiments ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN experiments.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fault_injections' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE fault_injections ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN fault_injections.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_params' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE global_params ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN global_params.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'governance_policies' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE governance_policies ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN governance_policies.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'healing_incidents' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE healing_incidents ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN healing_incidents.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE health_checks ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN health_checks.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integrations' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE integrations ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN integrations.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_l_m_traces' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE l_l_m_traces ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN l_l_m_traces.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_flows' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE lowcode_flows ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN lowcode_flows.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_instances' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE lowcode_instances ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN lowcode_instances.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_c_p_servers' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE m_c_p_servers ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN m_c_p_servers.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_f_a_devices' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE m_f_a_devices ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN m_f_a_devices.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_windows' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE maintenance_windows ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN maintenance_windows.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_queues' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE message_queues ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN message_queues.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'metricses' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE metricses ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN metricses.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'migration_plans' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE migration_plans ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN migration_plans.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'model_versions' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE model_versions ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN model_versions.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'multi_modal_triggers' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE multi_modal_triggers ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN multi_modal_triggers.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_channels' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE notification_channels ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN notification_channels.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_managements' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE notification_managements ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN notification_managements.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oci_registries' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE oci_registries ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN oci_registries.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otel_collector_configs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE otel_collector_configs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN otel_collector_configs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p_r_test_results' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE p_r_test_results ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN p_r_test_results.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_audit_logs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE permission_audit_logs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN permission_audit_logs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phase_groups' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE phase_groups ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN phase_groups.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_runs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE pipeline_runs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN pipeline_runs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_stages' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE pipeline_stages ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN pipeline_stages.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_tasks' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE pipeline_tasks ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN pipeline_tasks.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_templates' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE pipeline_templates ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN pipeline_templates.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_versions' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE pipeline_versions ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN pipeline_versions.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_hotreloads' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE plugin_hotreloads ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN plugin_hotreloads.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policies' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE policies ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN policies.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_workflows' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE policy_workflows ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN policy_workflows.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'privacy_configs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE privacy_configs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN privacy_configs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'process_steps' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE process_steps ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN process_steps.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN profiles.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressives' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE progressives ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN progressives.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE projects ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN projects.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queues' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE queues ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN queues.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'r_o_i_entries' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE r_o_i_entries ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN r_o_i_entries.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE recommendations ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN recommendations.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'records' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE records ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN records.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE reports ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN reports.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_benchmarks' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE resilience_benchmarks ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN resilience_benchmarks.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_histories' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE resilience_histories ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN resilience_histories.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_recommendations' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE resilience_recommendations ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN resilience_recommendations.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_requests' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE review_requests ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN review_requests.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE risks ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN risks.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runbooks' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE runbooks ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN runbooks.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE runs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN runs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_m_documents' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE s_b_o_m_documents ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN s_b_o_m_documents.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_ms' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE s_b_o_ms ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN s_b_o_ms.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_i_measurements' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE s_l_i_measurements ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN s_l_i_measurements.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_o_definitions' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE s_l_o_definitions ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN s_l_o_definitions.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_log_event_records' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE s_s_e_log_event_records ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN s_s_e_log_event_records.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_status_event_records' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE s_s_e_status_event_records ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN s_s_e_status_event_records.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_configs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE s_s_o_configs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN s_s_o_configs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_providers' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE s_s_o_providers ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN s_s_o_providers.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_notifications' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE scheduled_notifications ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN scheduled_notifications.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduling_policies' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE scheduling_policies ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN scheduling_policies.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_libraries' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE script_libraries ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN script_libraries.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_versions' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE script_versions ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN script_versions.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE scripts ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN scripts.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'secrets' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE secrets ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN secrets.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'self_services' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE self_services ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN self_services.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_catalogs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE service_catalogs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN service_catalogs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_healths' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE service_healths ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN service_healths.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_topologies' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE service_topologies ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN service_topologies.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulations' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE simulations ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN simulations.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_audit_logs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE skill_audit_logs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN skill_audit_logs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_executions' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE skill_executions ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN skill_executions.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_instances' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE skill_instances ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN skill_instances.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_reviews' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE skill_reviews ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN skill_reviews.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skills' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE skills ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN skills.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stages' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE stages ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN stages.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE tasks ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN tasks.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE tenants ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN tenants.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_cases' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE test_cases ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN test_cases.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_code_mappings' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE test_code_mappings ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN test_code_mappings.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_execution_records' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE test_execution_records ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN test_execution_records.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_suites' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE test_suites ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN test_suites.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_knowledges' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE ticket_knowledges ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN ticket_knowledges.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topologies' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE topologies ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN topologies.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_sampling_configs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE trace_sampling_configs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN trace_sampling_configs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_spans' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE trace_spans ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN trace_spans.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trigger_logs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE trigger_logs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN trigger_logs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_alerts' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE u_e_b_a_alerts ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN u_e_b_a_alerts.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_profiles' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE u_e_b_a_profiles ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN u_e_b_a_profiles.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_configs' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE unified_configs ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN unified_configs.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vector_stores' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE vector_stores ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN vector_stores.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vectorize_ruleses' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE vectorize_ruleses ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN vectorize_ruleses.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'version_archives' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE version_archives ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN version_archives.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'versions' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE versions ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN versions.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_tasks' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE workflow_tasks ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN workflow_tasks.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_triggers' AND column_name = 'tenant_id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE workflow_triggers ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    COMMENT ON COLUMN workflow_triggers.tenant_id IS 'Tenant ID (UUID) - unified type';
  END IF;
END $$;

-- Migration complete
SELECT 'tenant_id unified to UUID in 171 tables' AS migration_result;
