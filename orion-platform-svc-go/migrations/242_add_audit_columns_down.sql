-- Migration: 242_add_audit_columns_down.sql
-- Description: Rollback audit columns
-- Phase: 5.6

BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_triggers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE workflow_triggers DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_triggers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE workflow_triggers DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_tasks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE workflow_tasks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbenches' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE workbenches DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbenches' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE workbenches DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'widget_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE widget_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'widget_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE widget_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhooks_secrets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE webhooks_secrets DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhooks_secrets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE webhooks_secrets DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'version_archives' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE version_archives DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'version_archives' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE version_archives DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vectorize_ruleses' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE vectorize_ruleses DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vectorize_ruleses' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE vectorize_ruleses DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vector_stores' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE vector_stores DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vector_stores' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE vector_stores DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_records' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE usage_records DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE usage_records DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE usage_records DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_limits' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE usage_limits DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_limits' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE usage_limits DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_limits' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE usage_limits DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'upload_tasks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE upload_tasks DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'upload_tasks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE upload_tasks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'upload_tasks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE upload_tasks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE unified_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE unified_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_profiles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE u_e_b_a_profiles DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_profiles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE u_e_b_a_profiles DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_alerts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE u_e_b_a_alerts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'u_e_b_a_alerts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE u_e_b_a_alerts DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trigger_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE trigger_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trigger_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE trigger_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traffic_records' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE traffic_records DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traffic_records' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE traffic_records DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traffic_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE traffic_records DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traffic_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE traffic_records DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_spans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE trace_spans DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_spans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE trace_spans DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_sampling_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE trace_sampling_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trace_sampling_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE trace_sampling_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topologies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE topologies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topologies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE topologies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tickets DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tickets DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_service_state' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE ticketing_service_state DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_service_state' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticketing_service_state DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_service_state' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticketing_service_state DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_dispatch_weights' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE ticketing_dispatch_weights DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_dispatch_weights' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticketing_dispatch_weights DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_dispatch_weights' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticketing_dispatch_weights DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_workflow_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_workflow_history DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_workflow_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_workflow_history DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_workflow_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_workflow_history DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_transfers' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_transfers DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_transfers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_transfers DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_transfers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_transfers DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_suspends' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_suspends DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_suspends' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_suspends DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_suspends' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_suspends DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_tracking' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_sla_tracking DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_tracking' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_sla_tracking DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_targets' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_sla_targets DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_targets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_sla_targets DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_targets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_sla_targets DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_sla_policies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_sla_policies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_breaches' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_sla_breaches DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_breaches' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE ticket_sla_breaches DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_breaches' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_sla_breaches DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_breaches' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_sla_breaches DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_relations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_relations DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_relations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_relations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_relations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_relations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_knowledges' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_knowledges DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_knowledges' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_knowledges DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_rules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_dispatch_rules DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_dispatch_rules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_dispatch_rules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_engineers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_dispatch_engineers DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_engineers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_dispatch_engineers DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_automation_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_automation_rules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_automation_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_automation_rules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_assignments DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_assignments DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_assignments DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignment_rules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ticket_assignment_rules DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignment_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ticket_assignment_rules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignment_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ticket_assignment_rules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_suites' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE test_suites DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_suites' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE test_suites DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_execution_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE test_execution_records DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_execution_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE test_execution_records DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_code_mappings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE test_code_mappings DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_code_mappings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE test_code_mappings DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_cases' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE test_cases DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_cases' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE test_cases DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_users' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tenant_users DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_users' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tenant_users DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quotas' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quotas' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quota_alerts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE tenant_quota_alerts DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quota_alerts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tenant_quota_alerts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quota_alerts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tenant_quota_alerts DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_invites' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE tenant_invites DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_invites' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tenant_invites DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_invites' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tenant_invites DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE temporary_permissions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE temporary_permissions DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE temporary_permissions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE temporary_permissions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE teams DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_roles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE team_roles DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_roles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE team_roles DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_roles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE team_roles DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_roles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE team_roles DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE team_members DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE team_members DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE team_members DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE team_members DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tasks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tasks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE subscriptions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE subscriptions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_config_histories' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE subapp_config_histories DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_config_histories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE subapp_config_histories DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_config_histories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE subapp_config_histories DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stages' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE stages DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stages' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE stages DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_orders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE sql_orders DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_orders' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sql_orders DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_orders' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sql_orders DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_blacklist' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sql_blacklist DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_audit_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE sql_audit_history DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_audit_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sql_audit_history DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_audit_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sql_audit_history DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprints' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sprints DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprints' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sprints DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprint_tickets' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE sprint_tickets DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprint_tickets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sprint_tickets DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprint_tickets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sprint_tickets DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE snapshots DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE snapshots DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE snapshots DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_rollbacks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE smart_deploy_rollbacks DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_rollbacks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE smart_deploy_rollbacks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_rollbacks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE smart_deploy_rollbacks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_deployments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE smart_deploy_deployments DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_deployments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE smart_deploy_deployments DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_audit' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE smart_deploy_audit DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_audit' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE smart_deploy_audit DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_audit' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE smart_deploy_audit DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_audit' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE smart_deploy_audit DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_trackings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sla_trackings DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_trackings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sla_trackings DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_definitions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sla_definitions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_breach_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE sla_breach_events DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_breach_events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sla_breach_events DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_breach_events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sla_breach_events DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skills' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE skills DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skills' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE skills DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_reviews' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE skill_reviews DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_reviews' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE skill_reviews DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_instances' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE skill_instances DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_instances' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE skill_instances DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE skill_executions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE skill_executions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE skill_audit_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE skill_audit_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE simulations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE simulations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE sessions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sessions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sessions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_topologies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE service_topologies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_topologies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE service_topologies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_registries' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE service_registries DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_registries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE service_registries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_registries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE service_registries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_healths' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE service_healths DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_healths' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE service_healths DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_catalogs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE service_catalogs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_catalogs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE service_catalogs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_triggers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE serverless_triggers DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_triggers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE serverless_triggers DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_functions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE serverless_functions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_functions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE serverless_functions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_function_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE serverless_function_logs DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_function_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE serverless_function_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_function_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE serverless_function_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_deployments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE serverless_deployments DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_deployments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE serverless_deployments DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'self_services' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE self_services DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'self_services' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE self_services DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'secrets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE secrets DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sdk_tasks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sdk_tasks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sdk_tasks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sdk_tasks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE scripts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scripts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE scripts DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE script_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE script_versions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE script_templates DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_templates' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE script_templates DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_libraries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE script_libraries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_libraries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE script_libraries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduling_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE scheduling_policies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduling_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE scheduling_policies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_notifications' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE scheduled_notifications DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_notifications' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE scheduled_notifications DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_reports' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE scan_reports DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE scan_reports DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE scan_reports DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sandbox_network_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE sandbox_network_policies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sandbox_network_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sandbox_network_policies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_transactions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE saga_transactions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_transactions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE saga_transactions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_steps' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE saga_steps DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_steps' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE saga_steps DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_instances' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE saga_instances DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_instances' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE saga_instances DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_providers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_s_o_providers DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_providers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_s_o_providers DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_s_o_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_o_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_s_o_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_status_event_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_s_e_status_event_records DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_status_event_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_s_e_status_event_records DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_log_event_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_s_e_log_event_records DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_s_e_log_event_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_s_e_log_event_records DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_o_definitions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_l_o_definitions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_o_definitions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_l_o_definitions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_i_measurements' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_l_i_measurements DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_l_i_measurements' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_l_i_measurements DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_ms' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_b_o_ms DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_ms' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_b_o_ms DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_m_documents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE s_b_o_m_documents DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 's_b_o_m_documents' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE s_b_o_m_documents DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE runs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE runs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runbooks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE runbooks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runbooks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE runbooks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rollbacks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE rollbacks DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rollbacks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE rollbacks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rollbacks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE rollbacks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE roles DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE roles DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roi_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE roi_entries DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roi_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE roi_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roi_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE roi_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE risks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE risks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE reviews DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE reviews DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE reviews DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE review_requests DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retention_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE retention_policies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retention_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE retention_policies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'response_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE response_history DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'response_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE response_history DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'response_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE response_history DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_recommendations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE resilience_recommendations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_recommendations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE resilience_recommendations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_histories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE resilience_histories DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_histories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE resilience_histories DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_benchmarks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE resilience_benchmarks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resilience_benchmarks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE resilience_benchmarks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE reports DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE reports DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_schedules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE report_schedules DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_schedules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE report_schedules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_schedules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE report_schedules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE report_executions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE report_executions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_definitions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE report_definitions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_datasources' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE report_datasources DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_datasources' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE report_datasources DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'replay_sessions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE replay_sessions DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'replay_sessions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE replay_sessions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'replay_sessions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE replay_sessions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_trains' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE release_trains DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_trains' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE release_trains DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_notes' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE release_notes DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_notes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE release_notes DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE records DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE records DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recording_sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE recording_sessions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recording_sessions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE recording_sessions DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recording_sessions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE recording_sessions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recording_sessions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE recording_sessions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE recommendations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE recommendations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'r_o_i_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE r_o_i_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'r_o_i_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE r_o_i_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queues' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE queues DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queues' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE queues DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_execution_records' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE query_execution_records DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_execution_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE query_execution_records DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_execution_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE query_execution_records DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_scan_results' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE quality_scan_results DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_scan_results' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE quality_scan_results DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_scan_results' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE quality_scan_results DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_alerts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE quality_alerts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_alerts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE quality_alerts DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pull_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pull_requests DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pull_requests' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE pull_requests DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_members' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE project_members DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_members' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE project_members DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressives' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE progressives DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressives' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE progressives DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressive_deploys' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE progressive_deploys DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressive_deploys' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE progressive_deploys DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE profiles DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE profiles DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lines' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE product_lines DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lines' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE product_lines DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'process_steps' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE process_steps DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'process_steps' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE process_steps DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_problems' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE problem_problems DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_known_errors' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE problem_known_errors DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_known_errors' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE problem_known_errors DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_known_errors' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE problem_known_errors DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_incident_links' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE problem_incident_links DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_incident_links' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE problem_incident_links DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_incident_links' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE problem_incident_links DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_change_links' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE problem_change_links DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_change_links' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE problem_change_links DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_change_links' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE problem_change_links DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'privacy_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE privacy_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'privacy_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE privacy_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_documents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE portal_documents DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_workflows' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_workflows DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_workflows' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_workflows DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_violations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_violations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_violations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_violations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_overrides' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE policy_overrides DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_overrides' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_overrides DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_overrides' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_overrides DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_exemptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_exemptions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_exemptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_exemptions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_evaluations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE policy_evaluations DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_evaluations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_evaluations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_evaluations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_evaluations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_bundles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE policy_bundles DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_bundles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policy_bundles DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_bundles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policy_bundles DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE policies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE policies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugins' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugins DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugins' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugins DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_tenant_quotas' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_tenant_quotas DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_tenant_quotas' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_tenant_quotas DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_security_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE plugin_security_events DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_security_events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_security_events DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_security_events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_security_events DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_resource_quotas' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_resource_quotas DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_resource_quotas' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_resource_quotas DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_hotreloads' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_hotreloads DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_hotreloads' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_hotreloads DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE plugin_executions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_executions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE plugin_executions DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_executions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_executions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_audit_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE plugin_audit_entries DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_audit_entries' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE plugin_audit_entries DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_audit_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE plugin_audit_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_audit_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE plugin_audit_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playground_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE playground_requests DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playground_requests' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE playground_requests DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_templates DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_tasks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_tasks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_tasks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE pipeline_tasks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_stages' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_stages DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_stages' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE pipeline_stages DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_runs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_runs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_runs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE pipeline_runs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_checkpoints' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE pipeline_checkpoints DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_checkpoints' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pipeline_checkpoints DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_checkpoints' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE pipeline_checkpoints DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phase_groups' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE phase_groups DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permissions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE permissions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permissions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE permissions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE permission_requests DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_requests' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE permission_requests DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE permission_audit_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE permission_audit_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registry_histories' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE page_registry_histories DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registry_histories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE page_registry_histories DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registry_histories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE page_registry_histories DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE page_registries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE page_registries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p_r_test_results' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE p_r_test_results DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p_r_test_results' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE p_r_test_results DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otel_collector_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE otel_collector_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otel_collector_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE otel_collector_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_schedules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE oncall_schedules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_schedules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE oncall_schedules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_overrides' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE oncall_overrides DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_overrides' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE oncall_overrides DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_overrides' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE oncall_overrides DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_assignments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE oncall_assignments DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_assignments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE oncall_assignments DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_assignments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE oncall_assignments DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oci_registries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE oci_registries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oci_registries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE oci_registries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE notification_templates DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_templates' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE notification_templates DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_records' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE notification_records DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE notification_records DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE notification_records DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_managements' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE notification_managements DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_managements' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE notification_managements DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_channels' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE notification_channels DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_channels' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE notification_channels DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'namespace_allocations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE namespace_allocations DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'namespace_allocations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE namespace_allocations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'namespace_allocations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE namespace_allocations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'multi_modal_triggers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE multi_modal_triggers DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'multi_modal_triggers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE multi_modal_triggers DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_metrics' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE monitoring_metrics DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_metrics' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE monitoring_metrics DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_anomalies' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE monitoring_anomalies DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_anomalies' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE monitoring_anomalies DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_anomalies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE monitoring_anomalies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_anomalies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE monitoring_anomalies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alerts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE monitoring_alerts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alerts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE monitoring_alerts DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alert_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE monitoring_alert_rules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alert_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE monitoring_alert_rules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'model_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE model_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE mock_rules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE mock_rules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'migration_plans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE migration_plans DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'migration_plans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE migration_plans DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'metricses' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE metricses DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'metricses' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE metricses DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_queues' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE message_queues DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_queues' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE message_queues DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_windows' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE maintenance_windows DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_windows' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE maintenance_windows DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_f_a_devices' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE m_f_a_devices DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_f_a_devices' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE m_f_a_devices DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_c_p_servers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE m_c_p_servers DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'm_c_p_servers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE m_c_p_servers DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_instance' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE lowcode_workflow_instance DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_instance' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lowcode_workflow_instance DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_instance' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE lowcode_workflow_instance DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_definition' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lowcode_workflow_definition DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_instances' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lowcode_instances DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_instances' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE lowcode_instances DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_flows' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lowcode_flows DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locales' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE locales DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locales' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE locales DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_relationships' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE lineage_relationships DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_relationships' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lineage_relationships DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_relationships' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE lineage_relationships DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_nodes' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE lineage_nodes DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_nodes' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE lineage_nodes DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_nodes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE lineage_nodes DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE library_versions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE library_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE library_versions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_dependents' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE library_dependents DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_dependents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE library_dependents DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_dependents' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE library_dependents DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_l_m_traces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE l_l_m_traces DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_l_m_traces' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE l_l_m_traces DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_sync_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE knowledge_sync_logs DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_sync_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE knowledge_sync_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_sync_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE knowledge_sync_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_spaces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE knowledge_spaces DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_spaces' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE knowledge_spaces DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_documents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_documents' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_doc_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE knowledge_doc_versions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_doc_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE knowledge_doc_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_doc_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE knowledge_doc_versions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'internal_libraries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE internal_libraries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'internal_libraries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE internal_libraries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integrations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE integrations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integrations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE integrations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_sandboxes' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE infrastructure_sandboxes DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_sandboxes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE infrastructure_sandboxes DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_connectors' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE infrastructure_connectors DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_connectors' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE infrastructure_connectors DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE incidents DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE incidents DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_timeline_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE incident_timeline_events DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_timeline_events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE incident_timeline_events DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_timeline_events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE incident_timeline_events DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_postmortems' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE incident_postmortems DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_escalations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE incident_escalations DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_escalations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE incident_escalations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_escalations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE incident_escalations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inception_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE inception_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inception_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE inception_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspaces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE iac_workspaces DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspaces' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE iac_workspaces DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspace_modules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE iac_workspace_modules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspace_modules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE iac_workspace_modules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_state_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE iac_state_versions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_state_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE iac_state_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_state_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE iac_state_versions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_resources' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE iac_resources DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_resources' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE iac_resources DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_plans' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE iac_plans DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_plans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE iac_plans DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_plans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE iac_plans DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'i18n_translations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE i18n_translations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'i18n_translations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE i18n_translations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hotfix_channels' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE hotfix_channels DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hotfix_channels' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE hotfix_channels DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hook_chains' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE hook_chains DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hook_chains' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE hook_chains DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE health_checks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE health_checks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'healing_incidents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE healing_incidents DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'healing_incidents' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE healing_incidents DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registry_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE handler_registry_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registry_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE handler_registry_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE handler_registries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE handler_registries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'governance_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE governance_policies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_params' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE global_params DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_params' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE global_params DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_sync_statuses' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE gitops_sync_statuses DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_sync_statuses' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE gitops_sync_statuses DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_sync_statuses' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE gitops_sync_statuses DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE gitops_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE gitops_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'git_changelog_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE git_changelog_entries DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'git_changelog_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE git_changelog_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'git_changelog_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE git_changelog_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flag_toggle_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE flag_toggle_history DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flag_toggle_history' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE flag_toggle_history DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flag_toggle_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE flag_toggle_history DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flag_toggle_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE flag_toggle_history DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_reports' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE finops_reports DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_reports' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE finops_reports DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE finops_reports DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE finops_reports DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_cost_items' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE finops_cost_items DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_cost_items' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE finops_cost_items DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_cost_items' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE finops_cost_items DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_budget_guards' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE finops_budget_guards DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_budget_guards' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE finops_budget_guards DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_anomalies' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE finops_anomalies DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_anomalies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE finops_anomalies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_anomalies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE finops_anomalies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'federated_clusters' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE federated_clusters DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'federated_clusters' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE federated_clusters DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'federated_clusters' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE federated_clusters DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fault_injections' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE fault_injections DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fault_injections' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE fault_injections DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE experiments DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_runs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE experiment_runs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_runs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE experiment_runs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_results' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE experiment_results DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_results' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE experiment_results DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE experiment_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE experiment_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execution_control_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE execution_control_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execution_control_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE execution_control_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE events DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE events DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE events DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_triggers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE event_triggers DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_triggers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE event_triggers DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evaluations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE evaluations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evaluations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE evaluations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escalation_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE escalation_policies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escalation_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE escalation_policies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'error_budgets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE error_budgets DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'error_budgets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE error_budgets DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ephemeral_envs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ephemeral_envs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ephemeral_envs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ephemeral_envs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_profiles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE env_profiles DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_profiles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE env_profiles DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_lifecycles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE env_lifecycles DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'env_lifecycles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE env_lifecycles DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emergency_deploys' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE emergency_deploys DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emergency_deploys' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE emergency_deploys DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_scores' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE efficiency_scores DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_scores' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE efficiency_scores DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_scores' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE efficiency_scores DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_recommendations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE efficiency_recommendations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_recommendations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE efficiency_recommendations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_metrics' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE efficiency_metrics DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_metrics' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE efficiency_metrics DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dual_engines' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE dual_engines DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dual_engines' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE dual_engines DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drift_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE drift_reports DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drift_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE drift_reports DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_snapshots' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE domain_snapshots DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_snapshots' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE domain_snapshots DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_snapshots' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE domain_snapshots DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE domain_events DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE domain_events DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE domain_events DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE document_versions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE document_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'do_not_disturbs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE do_not_disturbs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'do_not_disturbs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE do_not_disturbs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'disaster_plans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE disaster_plans DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'disaster_plans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE disaster_plans DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'digital_twins' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE digital_twins DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'digital_twins' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE digital_twins DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_symptoms' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE diagnostic_symptoms DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_symptoms' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE diagnostic_symptoms DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_symptoms' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE diagnostic_symptoms DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE diagnostic_sessions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_sessions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE diagnostic_sessions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_sessions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE diagnostic_sessions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_reports' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE diagnostic_reports DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE diagnostic_reports DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE diagnostic_reports DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_patterns' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE diagnostic_patterns DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_patterns' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE diagnostic_patterns DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_patterns' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE diagnostic_patterns DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developer_portals' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE developer_portals DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developer_portals' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE developer_portals DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE deployments DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE deployments DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployment_triggers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE deployment_triggers DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployment_triggers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE deployment_triggers DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_windows' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE deploy_windows DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_audit_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE deploy_audit_entries DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_audit_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE deploy_audit_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_audit_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE deploy_audit_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dependency_coordinations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE dependency_coordinations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dependency_coordinations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE dependency_coordinations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE degradations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE degradations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_histories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE degradation_histories DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_histories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE degradation_histories DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE degradation_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'degradation_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE degradation_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decisions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE decisions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_traces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE decision_traces DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_traces' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE decision_traces DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_feedbacks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE decision_feedbacks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_explanations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE decision_explanations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_explanations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE decision_explanations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_sources' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE data_sources DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_sources' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE data_sources DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_quality_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE data_quality_rules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_quality_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE data_quality_rules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_pipelines' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE data_pipelines DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_pipelines' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE data_pipelines DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_lineages' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE data_lineages DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_lineages' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE data_lineages DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cross_domains' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cross_domains DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cross_domains' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cross_domains DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_jobs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cron_jobs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_jobs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cron_jobs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE cron_job_logs DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cron_job_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cron_job_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE cron_job_executions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_executions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE cron_job_executions DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cron_job_executions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cron_job_executions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_records DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cost_records DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cost_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_allocations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_tags' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_allocation_tags DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_tags' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cost_allocation_tags DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_rules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE cost_allocation_rules DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_allocation_rules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cost_allocation_rules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cost_allocation_reports DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cost_allocation_reports DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_endpoints' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE contract_endpoints DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_endpoints' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE contract_endpoints DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_endpoints' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE contract_endpoints DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_webhooks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_webhooks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_webhooks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE config_webhooks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE config_versions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_templates DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_template_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE config_template_versions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_template_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_template_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_snapshots' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE config_snapshots DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_snapshots' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_snapshots DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_mgmts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_mgmts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_mgmts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE config_mgmts DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_audit_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE config_audit_entries DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_audit_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE config_audit_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_audit_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE config_audit_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_schedules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE compliance_schedules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_schedules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE compliance_schedules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE compliance_reports DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE compliance_reports DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE compliance_policies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE compliance_policies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_frameworks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE compliance_frameworks DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_frameworks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE compliance_frameworks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_frameworks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE compliance_frameworks DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_evidence' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE compliance_evidence DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_evidence' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE compliance_evidence DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_evidence' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE compliance_evidence DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_evidence' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE compliance_evidence DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_advanceds' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE community_advanceds DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_advanceds' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE community_advanceds DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE communities DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE communities DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE comments DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE comments DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE comments DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE command_logs DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE command_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE command_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_log_details' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE command_log_details DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_log_details' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE command_log_details DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_log_details' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE command_log_details DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collection_schedules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE collection_schedules DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collection_schedules' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE collection_schedules DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collection_schedules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE collection_schedules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collection_schedules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE collection_schedules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repos' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE code_repos DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repos' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE code_repos DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repos' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE code_repos DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repo_adapters' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE code_repo_adapters DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repo_adapters' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE code_repo_adapters DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repo_adapters' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE code_repo_adapters DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cloud_resources' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cloud_resources DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cloud_resources' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cloud_resources DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cloud_accounts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cloud_accounts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cis' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cis DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breakers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE circuit_breakers DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breakers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE circuit_breakers DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE circuit_breaker_events DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE circuit_breaker_events DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE circuit_breaker_events DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE circuit_breaker_events DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ci_versions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ci_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_types' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ci_types DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_types' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ci_types DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ci_type_versions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ci_type_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ci_type_versions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_attributes' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ci_type_attributes DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_attributes' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ci_type_attributes DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_attributes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ci_type_attributes DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_relations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ci_relations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checkpoints' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE checkpoints DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checkpoints' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE checkpoints DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_webhooks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_webhooks DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_webhooks' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_webhooks DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_sessions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_sessions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_sessions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_sessions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_rate_limits' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_rate_limits DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_rate_limits' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_rate_limits DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_rate_limits' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_rate_limits DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_question_configs DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_question_configs DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_question_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_question_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_platform_configs DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_platform_configs DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_platform_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_platform_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_permission_roles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_permission_roles DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_permission_roles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_permission_roles DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_permission_roles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_permission_roles DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_permission_roles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_permission_roles DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_notification_preferences' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_notification_preferences DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_notification_preferences' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_notification_preferences DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_messages' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_messages DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_messages' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_messages DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_messages' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_messages DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_executions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_executions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_executions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_environment_permissions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_environment_permissions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_environment_permissions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_environment_permissions DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_environment_permissions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_environment_permissions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_environment_permissions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_environment_permissions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_dnd_settings DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_dnd_settings DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_dnd_settings DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_dnd_settings DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_commands' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_commands DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_commands' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_commands DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_command_versions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_command_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_permissions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_command_permissions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_permissions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_command_permissions DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_permissions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_command_permissions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_permissions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_command_permissions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_command_configs DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_command_configs DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_command_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_command_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_capability_mappings' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_capability_mappings DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_capability_mappings' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_capability_mappings DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_capability_mappings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_capability_mappings DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_capability_mappings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_capability_mappings DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_audit_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_audit_logs DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_audit_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_audit_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_approval_configs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE chatops_approval_configs DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_approval_configs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE chatops_approval_configs DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_approval_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_approval_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_approval_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_approval_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_alert_states' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chatops_alert_states DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_alert_states' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chatops_alert_states DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chargeback_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chargeback_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chargeback_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE chargeback_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chaos_experiments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE chaos_experiments DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE change_requests DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_histories' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE change_histories DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_histories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE change_histories DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE change_executions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE change_executions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE change_executions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_approvals' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE change_approvals DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_approvals' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE change_approvals DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_approvals' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE change_approvals DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_analysises' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE change_analysises DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_audit_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE capability_audit_logs DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE capability_audit_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE capability_audit_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capabilities' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE capabilities DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capabilities' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE capabilities DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_traffics' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE canary_traffics DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_traffics' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE canary_traffics DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_deployments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE canary_deployments DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_deployments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE canary_deployments DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE canary_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE canary_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cache_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cache_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_cleanups' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE cache_cleanups DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cache_cleanups' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE cache_cleanups DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'builds' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE builds DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE build_logs DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE build_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE build_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_images' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE build_images DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_images' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE build_images DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_environments' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE build_environments DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_environments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE build_environments DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE build_cache_entries DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE build_cache_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE build_cache_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE build_cache_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE build_cache_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE budgets DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE budgets DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_history_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE budget_history_records DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_history_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE budget_history_records DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_configs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE budget_configs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_configs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE budget_configs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_subscriptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE billing_subscriptions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_subscriptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE billing_subscriptions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_line_items' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE billing_line_items DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_line_items' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE billing_line_items DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_line_items' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE billing_line_items DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_invoices' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE billing_invoices DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_invoices' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE billing_invoices DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_accounts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE billing_accounts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_accounts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE billing_accounts DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bi_dashboards' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE bi_dashboards DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bi_dashboards' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE bi_dashboards DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_runs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE batch_runs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_runs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE batch_runs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'baselines' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE baselines DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'baselines' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE baselines DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_storages' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE backup_storages DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_storages' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE backup_storages DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_restores' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE backup_restores DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_restores' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE backup_restores DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE backup_policies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE backup_policies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_jobs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE backup_jobs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_jobs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE backup_jobs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_token_blacklists' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE auth_token_blacklists DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_token_blacklists' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE auth_token_blacklists DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_keies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE auth_keies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_keies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE auth_keies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_rules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE audit_rules DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_rules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_rules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_reports' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE audit_reports DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_reports' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_reports DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_reports' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_reports DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_plans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_plans DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_plans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_plans DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_findings' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE audit_findings DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_findings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_findings DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_findings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_findings DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_executions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE audit_executions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_executions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE audit_executions DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_executions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE audit_executions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_executions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE audit_executions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifacts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifacts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_tags' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE artifact_tags DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_tags' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_tags DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_tags' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_tags DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_signatures' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_signatures DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_signatures' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_signatures DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_scans' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_scans DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_scans' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_scans DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_promotions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE artifact_promotions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_promotions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_promotions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_promotions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_promotions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_operations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE artifact_operations DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_operations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_operations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_operations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_operations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_lifecycles' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_lifecycles DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_lifecycles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_lifecycles DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_downloads' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE artifact_downloads DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_downloads' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE artifact_downloads DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_downloads' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE artifact_downloads DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_downloads' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE artifact_downloads DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_templates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE approval_templates DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_templates' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE approval_templates DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE approval_requests DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE approval_requests DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_levels' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE approval_levels DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_levels' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE approval_levels DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE approval_history DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE approval_history DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE approval_history DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_gates' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE approval_gates DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_gates' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE approval_gates DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apm_entries' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE apm_entries DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apm_entries' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE apm_entries DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apk_upload_records' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE apk_upload_records DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apk_upload_records' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE apk_upload_records DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_subscriptions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_market_subscriptions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_subscriptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_market_subscriptions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_subscriptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_market_subscriptions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_products' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_market_products DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_products' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_market_products DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_products' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_market_products DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_keys' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_market_keys DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_keys' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_market_keys DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_keys' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_market_keys DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_apps' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_market_apps DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_apps' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_market_apps DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_apps' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_market_apps DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_keys DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_keys DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_violations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_governance_violations DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_violations' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_governance_violations DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_violations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_governance_violations DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_governance_versions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_versions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_governance_versions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_governance_versions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_verification_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_governance_verification_history DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_verification_history' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_governance_verification_history DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_verification_history' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_governance_verification_history DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_rules' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_governance_rules DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_rules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_governance_rules DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_contracts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_governance_contracts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_contracts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_governance_contracts DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_contracts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_contracts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_consumptions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE api_consumptions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_consumptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE api_consumptions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_consumptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE api_consumptions DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysises' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE analysises DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analysises' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE analysises DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alerts DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alerts DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_topologies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alert_topologies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_topologies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alert_topologies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_node_health' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE alert_node_health DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_node_health' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE alert_node_health DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_node_health' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alert_node_health DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_node_health' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alert_node_health DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_maintenance_windows' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE alert_maintenance_windows DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_maintenance_windows' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alert_maintenance_windows DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_maintenance_windows' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alert_maintenance_windows DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_known_issues' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alert_known_issues DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_known_issues' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alert_known_issues DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_breakers' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE alert_breakers DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_breakers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE alert_breakers DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_gateway_requests' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ai_gateway_requests DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_gateway_requests' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ai_gateway_requests DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_gateway_requests' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ai_gateway_requests DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decisions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ai_decisions DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decisions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ai_decisions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ai_decision_traces DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE ai_decision_traces DROP COLUMN IF EXISTS created_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ai_decision_traces DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ai_decision_traces DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_feedback' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ai_decision_feedback DROP COLUMN IF EXISTS updated_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_feedback' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE ai_decision_feedback DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE agents DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_audit_logs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE agent_audit_logs DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_audit_logs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE agent_audit_logs DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_models' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE a_i_models DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_decisions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE a_i_decisions DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_i_agents' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE a_i_agents DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_b_a_c_policies' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE a_b_a_c_policies DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'a_b_a_c_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE a_b_a_c_policies DROP COLUMN IF EXISTS created_by;
  END IF;
END $$;

SELECT 'Removed audit columns from 438 tables' AS migration_result;

COMMIT;
