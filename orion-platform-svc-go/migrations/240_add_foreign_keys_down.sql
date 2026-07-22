-- Migration: 240_add_foreign_keys_down.sql
-- Description: Rollback foreign key constraints for tenant_id and user_id
-- Phase: 5.4

BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_workflow_triggers_tenant'
  ) THEN
    ALTER TABLE workflow_triggers DROP CONSTRAINT fk_workflow_triggers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_workflow_tasks_tenant'
  ) THEN
    ALTER TABLE workflow_tasks DROP CONSTRAINT fk_workflow_tasks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_workbenches_tenant'
  ) THEN
    ALTER TABLE workbenches DROP CONSTRAINT fk_workbenches_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_widget_configs_tenant'
  ) THEN
    ALTER TABLE widget_configs DROP CONSTRAINT fk_widget_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_webhooks_secrets_tenant'
  ) THEN
    ALTER TABLE webhooks_secrets DROP CONSTRAINT fk_webhooks_secrets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_versions_tenant'
  ) THEN
    ALTER TABLE versions DROP CONSTRAINT fk_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_version_archives_tenant'
  ) THEN
    ALTER TABLE version_archives DROP CONSTRAINT fk_version_archives_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_vectorize_ruleses_tenant'
  ) THEN
    ALTER TABLE vectorize_ruleses DROP CONSTRAINT fk_vectorize_ruleses_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_vector_stores_tenant'
  ) THEN
    ALTER TABLE vector_stores DROP CONSTRAINT fk_vector_stores_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_usage_records_tenant'
  ) THEN
    ALTER TABLE usage_records DROP CONSTRAINT fk_usage_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_usage_limits_tenant'
  ) THEN
    ALTER TABLE usage_limits DROP CONSTRAINT fk_usage_limits_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_upload_tasks_tenant'
  ) THEN
    ALTER TABLE upload_tasks DROP CONSTRAINT fk_upload_tasks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_unified_configs_tenant'
  ) THEN
    ALTER TABLE unified_configs DROP CONSTRAINT fk_unified_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_profiles_tenant'
  ) THEN
    ALTER TABLE u_e_b_a_profiles DROP CONSTRAINT fk_u_e_b_a_profiles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_alerts_tenant'
  ) THEN
    ALTER TABLE u_e_b_a_alerts DROP CONSTRAINT fk_u_e_b_a_alerts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_trigger_logs_tenant'
  ) THEN
    ALTER TABLE trigger_logs DROP CONSTRAINT fk_trigger_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_traffic_records_tenant'
  ) THEN
    ALTER TABLE traffic_records DROP CONSTRAINT fk_traffic_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_trace_spans_tenant'
  ) THEN
    ALTER TABLE trace_spans DROP CONSTRAINT fk_trace_spans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_trace_sampling_configs_tenant'
  ) THEN
    ALTER TABLE trace_sampling_configs DROP CONSTRAINT fk_trace_sampling_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_topologies_tenant'
  ) THEN
    ALTER TABLE topologies DROP CONSTRAINT fk_topologies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_tenant'
  ) THEN
    ALTER TABLE tickets DROP CONSTRAINT fk_tickets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticketing_service_state_tenant'
  ) THEN
    ALTER TABLE ticketing_service_state DROP CONSTRAINT fk_ticketing_service_state_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticketing_dispatch_weights_tenant'
  ) THEN
    ALTER TABLE ticketing_dispatch_weights DROP CONSTRAINT fk_ticketing_dispatch_weights_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_suspends_tenant'
  ) THEN
    ALTER TABLE ticket_suspends DROP CONSTRAINT fk_ticket_suspends_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_sla_targets_tenant'
  ) THEN
    ALTER TABLE ticket_sla_targets DROP CONSTRAINT fk_ticket_sla_targets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_sla_policies_tenant'
  ) THEN
    ALTER TABLE ticket_sla_policies DROP CONSTRAINT fk_ticket_sla_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_relations_tenant'
  ) THEN
    ALTER TABLE ticket_relations DROP CONSTRAINT fk_ticket_relations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_knowledges_tenant'
  ) THEN
    ALTER TABLE ticket_knowledges DROP CONSTRAINT fk_ticket_knowledges_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_dispatch_rules_tenant'
  ) THEN
    ALTER TABLE ticket_dispatch_rules DROP CONSTRAINT fk_ticket_dispatch_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_dispatch_engineers_tenant'
  ) THEN
    ALTER TABLE ticket_dispatch_engineers DROP CONSTRAINT fk_ticket_dispatch_engineers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_automation_rules_tenant'
  ) THEN
    ALTER TABLE ticket_automation_rules DROP CONSTRAINT fk_ticket_automation_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_assignments_tenant'
  ) THEN
    ALTER TABLE ticket_assignments DROP CONSTRAINT fk_ticket_assignments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_assignment_rules_tenant'
  ) THEN
    ALTER TABLE ticket_assignment_rules DROP CONSTRAINT fk_ticket_assignment_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_suites_tenant'
  ) THEN
    ALTER TABLE test_suites DROP CONSTRAINT fk_test_suites_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_execution_records_tenant'
  ) THEN
    ALTER TABLE test_execution_records DROP CONSTRAINT fk_test_execution_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_code_mappings_tenant'
  ) THEN
    ALTER TABLE test_code_mappings DROP CONSTRAINT fk_test_code_mappings_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_test_cases_tenant'
  ) THEN
    ALTER TABLE test_cases DROP CONSTRAINT fk_test_cases_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_users_tenant'
  ) THEN
    ALTER TABLE tenant_users DROP CONSTRAINT fk_tenant_users_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_quotas_tenant'
  ) THEN
    ALTER TABLE tenant_quotas DROP CONSTRAINT fk_tenant_quotas_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_quota_alerts_tenant'
  ) THEN
    ALTER TABLE tenant_quota_alerts DROP CONSTRAINT fk_tenant_quota_alerts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_invites_tenant'
  ) THEN
    ALTER TABLE tenant_invites DROP CONSTRAINT fk_tenant_invites_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_temporary_permissions_tenant'
  ) THEN
    ALTER TABLE temporary_permissions DROP CONSTRAINT fk_temporary_permissions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_teams_tenant'
  ) THEN
    ALTER TABLE teams DROP CONSTRAINT fk_teams_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_roles_tenant'
  ) THEN
    ALTER TABLE team_roles DROP CONSTRAINT fk_team_roles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_members_tenant'
  ) THEN
    ALTER TABLE team_members DROP CONSTRAINT fk_team_members_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_tenant'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT fk_tasks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_tenant'
  ) THEN
    ALTER TABLE subscriptions DROP CONSTRAINT fk_subscriptions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subapp_configs_tenant'
  ) THEN
    ALTER TABLE subapp_configs DROP CONSTRAINT fk_subapp_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subapp_config_histories_tenant'
  ) THEN
    ALTER TABLE subapp_config_histories DROP CONSTRAINT fk_subapp_config_histories_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_stages_tenant'
  ) THEN
    ALTER TABLE stages DROP CONSTRAINT fk_stages_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_orders_tenant'
  ) THEN
    ALTER TABLE sql_orders DROP CONSTRAINT fk_sql_orders_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_blacklist_tenant'
  ) THEN
    ALTER TABLE sql_blacklist DROP CONSTRAINT fk_sql_blacklist_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_audit_history_tenant'
  ) THEN
    ALTER TABLE sql_audit_history DROP CONSTRAINT fk_sql_audit_history_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sprints_tenant'
  ) THEN
    ALTER TABLE sprints DROP CONSTRAINT fk_sprints_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sprint_tickets_tenant'
  ) THEN
    ALTER TABLE sprint_tickets DROP CONSTRAINT fk_sprint_tickets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_snapshots_tenant'
  ) THEN
    ALTER TABLE snapshots DROP CONSTRAINT fk_snapshots_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_smart_deploy_rollbacks_tenant'
  ) THEN
    ALTER TABLE smart_deploy_rollbacks DROP CONSTRAINT fk_smart_deploy_rollbacks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_smart_deploy_deployments_tenant'
  ) THEN
    ALTER TABLE smart_deploy_deployments DROP CONSTRAINT fk_smart_deploy_deployments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_smart_deploy_audit_tenant'
  ) THEN
    ALTER TABLE smart_deploy_audit DROP CONSTRAINT fk_smart_deploy_audit_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sla_trackings_tenant'
  ) THEN
    ALTER TABLE sla_trackings DROP CONSTRAINT fk_sla_trackings_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sla_definitions_tenant'
  ) THEN
    ALTER TABLE sla_definitions DROP CONSTRAINT fk_sla_definitions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sla_breach_events_tenant'
  ) THEN
    ALTER TABLE sla_breach_events DROP CONSTRAINT fk_sla_breach_events_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skills_tenant'
  ) THEN
    ALTER TABLE skills DROP CONSTRAINT fk_skills_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_reviews_tenant'
  ) THEN
    ALTER TABLE skill_reviews DROP CONSTRAINT fk_skill_reviews_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_instances_tenant'
  ) THEN
    ALTER TABLE skill_instances DROP CONSTRAINT fk_skill_instances_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_executions_tenant'
  ) THEN
    ALTER TABLE skill_executions DROP CONSTRAINT fk_skill_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_audit_logs_tenant'
  ) THEN
    ALTER TABLE skill_audit_logs DROP CONSTRAINT fk_skill_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_simulations_tenant'
  ) THEN
    ALTER TABLE simulations DROP CONSTRAINT fk_simulations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_topologies_tenant'
  ) THEN
    ALTER TABLE service_topologies DROP CONSTRAINT fk_service_topologies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_registries_tenant'
  ) THEN
    ALTER TABLE service_registries DROP CONSTRAINT fk_service_registries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_healths_tenant'
  ) THEN
    ALTER TABLE service_healths DROP CONSTRAINT fk_service_healths_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_catalogs_tenant'
  ) THEN
    ALTER TABLE service_catalogs DROP CONSTRAINT fk_service_catalogs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_triggers_tenant'
  ) THEN
    ALTER TABLE serverless_triggers DROP CONSTRAINT fk_serverless_triggers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_functions_tenant'
  ) THEN
    ALTER TABLE serverless_functions DROP CONSTRAINT fk_serverless_functions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_function_logs_tenant'
  ) THEN
    ALTER TABLE serverless_function_logs DROP CONSTRAINT fk_serverless_function_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_serverless_deployments_tenant'
  ) THEN
    ALTER TABLE serverless_deployments DROP CONSTRAINT fk_serverless_deployments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_self_services_tenant'
  ) THEN
    ALTER TABLE self_services DROP CONSTRAINT fk_self_services_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_secrets_tenant'
  ) THEN
    ALTER TABLE secrets DROP CONSTRAINT fk_secrets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sdk_tasks_tenant'
  ) THEN
    ALTER TABLE sdk_tasks DROP CONSTRAINT fk_sdk_tasks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scripts_tenant'
  ) THEN
    ALTER TABLE scripts DROP CONSTRAINT fk_scripts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_script_versions_tenant'
  ) THEN
    ALTER TABLE script_versions DROP CONSTRAINT fk_script_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_script_templates_tenant'
  ) THEN
    ALTER TABLE script_templates DROP CONSTRAINT fk_script_templates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_script_libraries_tenant'
  ) THEN
    ALTER TABLE script_libraries DROP CONSTRAINT fk_script_libraries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scheduling_policies_tenant'
  ) THEN
    ALTER TABLE scheduling_policies DROP CONSTRAINT fk_scheduling_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scheduled_notifications_tenant'
  ) THEN
    ALTER TABLE scheduled_notifications DROP CONSTRAINT fk_scheduled_notifications_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scan_reports_tenant'
  ) THEN
    ALTER TABLE scan_reports DROP CONSTRAINT fk_scan_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_saga_transactions_tenant'
  ) THEN
    ALTER TABLE saga_transactions DROP CONSTRAINT fk_saga_transactions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_saga_steps_tenant'
  ) THEN
    ALTER TABLE saga_steps DROP CONSTRAINT fk_saga_steps_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_saga_instances_tenant'
  ) THEN
    ALTER TABLE saga_instances DROP CONSTRAINT fk_saga_instances_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_o_providers_tenant'
  ) THEN
    ALTER TABLE s_s_o_providers DROP CONSTRAINT fk_s_s_o_providers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_o_configs_tenant'
  ) THEN
    ALTER TABLE s_s_o_configs DROP CONSTRAINT fk_s_s_o_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_e_status_event_records_tenant'
  ) THEN
    ALTER TABLE s_s_e_status_event_records DROP CONSTRAINT fk_s_s_e_status_event_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_s_e_log_event_records_tenant'
  ) THEN
    ALTER TABLE s_s_e_log_event_records DROP CONSTRAINT fk_s_s_e_log_event_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_l_o_definitions_tenant'
  ) THEN
    ALTER TABLE s_l_o_definitions DROP CONSTRAINT fk_s_l_o_definitions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_l_i_measurements_tenant'
  ) THEN
    ALTER TABLE s_l_i_measurements DROP CONSTRAINT fk_s_l_i_measurements_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_b_o_ms_tenant'
  ) THEN
    ALTER TABLE s_b_o_ms DROP CONSTRAINT fk_s_b_o_ms_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_s_b_o_m_documents_tenant'
  ) THEN
    ALTER TABLE s_b_o_m_documents DROP CONSTRAINT fk_s_b_o_m_documents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_runs_tenant'
  ) THEN
    ALTER TABLE runs DROP CONSTRAINT fk_runs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_runbooks_tenant'
  ) THEN
    ALTER TABLE runbooks DROP CONSTRAINT fk_runbooks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rollbacks_tenant'
  ) THEN
    ALTER TABLE rollbacks DROP CONSTRAINT fk_rollbacks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_roi_entries_tenant'
  ) THEN
    ALTER TABLE roi_entries DROP CONSTRAINT fk_roi_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_risks_tenant'
  ) THEN
    ALTER TABLE risks DROP CONSTRAINT fk_risks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reviews_tenant'
  ) THEN
    ALTER TABLE reviews DROP CONSTRAINT fk_reviews_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_review_requests_tenant'
  ) THEN
    ALTER TABLE review_requests DROP CONSTRAINT fk_review_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_retention_policies_tenant'
  ) THEN
    ALTER TABLE retention_policies DROP CONSTRAINT fk_retention_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_response_history_tenant'
  ) THEN
    ALTER TABLE response_history DROP CONSTRAINT fk_response_history_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resilience_recommendations_tenant'
  ) THEN
    ALTER TABLE resilience_recommendations DROP CONSTRAINT fk_resilience_recommendations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resilience_histories_tenant'
  ) THEN
    ALTER TABLE resilience_histories DROP CONSTRAINT fk_resilience_histories_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resilience_benchmarks_tenant'
  ) THEN
    ALTER TABLE resilience_benchmarks DROP CONSTRAINT fk_resilience_benchmarks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reports_tenant'
  ) THEN
    ALTER TABLE reports DROP CONSTRAINT fk_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_schedules_tenant'
  ) THEN
    ALTER TABLE report_schedules DROP CONSTRAINT fk_report_schedules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_executions_tenant'
  ) THEN
    ALTER TABLE report_executions DROP CONSTRAINT fk_report_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_definitions_tenant'
  ) THEN
    ALTER TABLE report_definitions DROP CONSTRAINT fk_report_definitions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_datasources_tenant'
  ) THEN
    ALTER TABLE report_datasources DROP CONSTRAINT fk_report_datasources_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_replay_sessions_tenant'
  ) THEN
    ALTER TABLE replay_sessions DROP CONSTRAINT fk_replay_sessions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_release_trains_tenant'
  ) THEN
    ALTER TABLE release_trains DROP CONSTRAINT fk_release_trains_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_release_notes_tenant'
  ) THEN
    ALTER TABLE release_notes DROP CONSTRAINT fk_release_notes_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_records_tenant'
  ) THEN
    ALTER TABLE records DROP CONSTRAINT fk_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_recording_sessions_tenant'
  ) THEN
    ALTER TABLE recording_sessions DROP CONSTRAINT fk_recording_sessions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_recommendations_tenant'
  ) THEN
    ALTER TABLE recommendations DROP CONSTRAINT fk_recommendations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_r_o_i_entries_tenant'
  ) THEN
    ALTER TABLE r_o_i_entries DROP CONSTRAINT fk_r_o_i_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_queues_tenant'
  ) THEN
    ALTER TABLE queues DROP CONSTRAINT fk_queues_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_query_execution_records_tenant'
  ) THEN
    ALTER TABLE query_execution_records DROP CONSTRAINT fk_query_execution_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_quality_scan_results_tenant'
  ) THEN
    ALTER TABLE quality_scan_results DROP CONSTRAINT fk_quality_scan_results_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_quality_alerts_tenant'
  ) THEN
    ALTER TABLE quality_alerts DROP CONSTRAINT fk_quality_alerts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pull_requests_tenant'
  ) THEN
    ALTER TABLE pull_requests DROP CONSTRAINT fk_pull_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_tenant'
  ) THEN
    ALTER TABLE projects DROP CONSTRAINT fk_projects_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_members_tenant'
  ) THEN
    ALTER TABLE project_members DROP CONSTRAINT fk_project_members_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_progressives_tenant'
  ) THEN
    ALTER TABLE progressives DROP CONSTRAINT fk_progressives_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_progressive_deploys_tenant'
  ) THEN
    ALTER TABLE progressive_deploys DROP CONSTRAINT fk_progressive_deploys_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_tenant'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT fk_profiles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_lines_tenant'
  ) THEN
    ALTER TABLE product_lines DROP CONSTRAINT fk_product_lines_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_process_steps_tenant'
  ) THEN
    ALTER TABLE process_steps DROP CONSTRAINT fk_process_steps_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_problem_problems_tenant'
  ) THEN
    ALTER TABLE problem_problems DROP CONSTRAINT fk_problem_problems_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_privacy_configs_tenant'
  ) THEN
    ALTER TABLE privacy_configs DROP CONSTRAINT fk_privacy_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_portal_documents_tenant'
  ) THEN
    ALTER TABLE portal_documents DROP CONSTRAINT fk_portal_documents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_workflows_tenant'
  ) THEN
    ALTER TABLE policy_workflows DROP CONSTRAINT fk_policy_workflows_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_violations_tenant'
  ) THEN
    ALTER TABLE policy_violations DROP CONSTRAINT fk_policy_violations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_overrides_tenant'
  ) THEN
    ALTER TABLE policy_overrides DROP CONSTRAINT fk_policy_overrides_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_exemptions_tenant'
  ) THEN
    ALTER TABLE policy_exemptions DROP CONSTRAINT fk_policy_exemptions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_evaluations_tenant'
  ) THEN
    ALTER TABLE policy_evaluations DROP CONSTRAINT fk_policy_evaluations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_bundles_tenant'
  ) THEN
    ALTER TABLE policy_bundles DROP CONSTRAINT fk_policy_bundles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policies_tenant'
  ) THEN
    ALTER TABLE policies DROP CONSTRAINT fk_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugins_tenant'
  ) THEN
    ALTER TABLE plugins DROP CONSTRAINT fk_plugins_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_tenant_quotas_tenant'
  ) THEN
    ALTER TABLE plugin_tenant_quotas DROP CONSTRAINT fk_plugin_tenant_quotas_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_security_events_tenant'
  ) THEN
    ALTER TABLE plugin_security_events DROP CONSTRAINT fk_plugin_security_events_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_resource_quotas_tenant'
  ) THEN
    ALTER TABLE plugin_resource_quotas DROP CONSTRAINT fk_plugin_resource_quotas_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_hotreloads_tenant'
  ) THEN
    ALTER TABLE plugin_hotreloads DROP CONSTRAINT fk_plugin_hotreloads_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_executions_tenant'
  ) THEN
    ALTER TABLE plugin_executions DROP CONSTRAINT fk_plugin_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_audit_entries_tenant'
  ) THEN
    ALTER TABLE plugin_audit_entries DROP CONSTRAINT fk_plugin_audit_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_playground_requests_tenant'
  ) THEN
    ALTER TABLE playground_requests DROP CONSTRAINT fk_playground_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_versions_tenant'
  ) THEN
    ALTER TABLE pipeline_versions DROP CONSTRAINT fk_pipeline_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_templates_tenant'
  ) THEN
    ALTER TABLE pipeline_templates DROP CONSTRAINT fk_pipeline_templates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_tasks_tenant'
  ) THEN
    ALTER TABLE pipeline_tasks DROP CONSTRAINT fk_pipeline_tasks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_stages_tenant'
  ) THEN
    ALTER TABLE pipeline_stages DROP CONSTRAINT fk_pipeline_stages_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pipeline_runs_tenant'
  ) THEN
    ALTER TABLE pipeline_runs DROP CONSTRAINT fk_pipeline_runs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_phase_groups_tenant'
  ) THEN
    ALTER TABLE phase_groups DROP CONSTRAINT fk_phase_groups_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_requests_tenant'
  ) THEN
    ALTER TABLE permission_requests DROP CONSTRAINT fk_permission_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_audit_logs_tenant'
  ) THEN
    ALTER TABLE permission_audit_logs DROP CONSTRAINT fk_permission_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_page_registry_histories_tenant'
  ) THEN
    ALTER TABLE page_registry_histories DROP CONSTRAINT fk_page_registry_histories_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_page_registries_tenant'
  ) THEN
    ALTER TABLE page_registries DROP CONSTRAINT fk_page_registries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_p_r_test_results_tenant'
  ) THEN
    ALTER TABLE p_r_test_results DROP CONSTRAINT fk_p_r_test_results_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_otel_collector_configs_tenant'
  ) THEN
    ALTER TABLE otel_collector_configs DROP CONSTRAINT fk_otel_collector_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_oncall_schedules_tenant'
  ) THEN
    ALTER TABLE oncall_schedules DROP CONSTRAINT fk_oncall_schedules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_oci_registries_tenant'
  ) THEN
    ALTER TABLE oci_registries DROP CONSTRAINT fk_oci_registries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_templates_tenant'
  ) THEN
    ALTER TABLE notification_templates DROP CONSTRAINT fk_notification_templates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_records_tenant'
  ) THEN
    ALTER TABLE notification_records DROP CONSTRAINT fk_notification_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_managements_tenant'
  ) THEN
    ALTER TABLE notification_managements DROP CONSTRAINT fk_notification_managements_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_channels_tenant'
  ) THEN
    ALTER TABLE notification_channels DROP CONSTRAINT fk_notification_channels_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_namespace_allocations_tenant'
  ) THEN
    ALTER TABLE namespace_allocations DROP CONSTRAINT fk_namespace_allocations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_multi_modal_triggers_tenant'
  ) THEN
    ALTER TABLE multi_modal_triggers DROP CONSTRAINT fk_multi_modal_triggers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_metrics_tenant'
  ) THEN
    ALTER TABLE monitoring_metrics DROP CONSTRAINT fk_monitoring_metrics_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_anomalies_tenant'
  ) THEN
    ALTER TABLE monitoring_anomalies DROP CONSTRAINT fk_monitoring_anomalies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_alerts_tenant'
  ) THEN
    ALTER TABLE monitoring_alerts DROP CONSTRAINT fk_monitoring_alerts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_monitoring_alert_rules_tenant'
  ) THEN
    ALTER TABLE monitoring_alert_rules DROP CONSTRAINT fk_monitoring_alert_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_model_versions_tenant'
  ) THEN
    ALTER TABLE model_versions DROP CONSTRAINT fk_model_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_mock_rules_tenant'
  ) THEN
    ALTER TABLE mock_rules DROP CONSTRAINT fk_mock_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_migration_plans_tenant'
  ) THEN
    ALTER TABLE migration_plans DROP CONSTRAINT fk_migration_plans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_metricses_tenant'
  ) THEN
    ALTER TABLE metricses DROP CONSTRAINT fk_metricses_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_message_queues_tenant'
  ) THEN
    ALTER TABLE message_queues DROP CONSTRAINT fk_message_queues_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_maintenance_windows_tenant'
  ) THEN
    ALTER TABLE maintenance_windows DROP CONSTRAINT fk_maintenance_windows_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_m_f_a_devices_tenant'
  ) THEN
    ALTER TABLE m_f_a_devices DROP CONSTRAINT fk_m_f_a_devices_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_m_c_p_servers_tenant'
  ) THEN
    ALTER TABLE m_c_p_servers DROP CONSTRAINT fk_m_c_p_servers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_lowcode_workflow_definition_tenant'
  ) THEN
    ALTER TABLE lowcode_workflow_definition DROP CONSTRAINT fk_lowcode_workflow_definition_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_lowcode_instances_tenant'
  ) THEN
    ALTER TABLE lowcode_instances DROP CONSTRAINT fk_lowcode_instances_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_lowcode_flows_tenant'
  ) THEN
    ALTER TABLE lowcode_flows DROP CONSTRAINT fk_lowcode_flows_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_locales_tenant'
  ) THEN
    ALTER TABLE locales DROP CONSTRAINT fk_locales_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns_tenant'
  ) THEN
    ALTER TABLE l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns DROP CONSTRAINT fk_l_t_l_i_l_c_l_k_l_e_l_t_lu_l_a_l_u_l_t_l_o_l_m_l_a_l_t_l_i_l_o_l_ns_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_l_m_traces_tenant'
  ) THEN
    ALTER TABLE l_l_m_traces DROP CONSTRAINT fk_l_l_m_traces_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns_tenant'
  ) THEN
    ALTER TABLE l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns DROP CONSTRAINT fk_l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_knowledge_sync_logs_tenant'
  ) THEN
    ALTER TABLE knowledge_sync_logs DROP CONSTRAINT fk_knowledge_sync_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_knowledge_spaces_tenant'
  ) THEN
    ALTER TABLE knowledge_spaces DROP CONSTRAINT fk_knowledge_spaces_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_knowledge_documents_tenant'
  ) THEN
    ALTER TABLE knowledge_documents DROP CONSTRAINT fk_knowledge_documents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_internal_libraries_tenant'
  ) THEN
    ALTER TABLE internal_libraries DROP CONSTRAINT fk_internal_libraries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_integrations_tenant'
  ) THEN
    ALTER TABLE integrations DROP CONSTRAINT fk_integrations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_infrastructure_sandboxes_tenant'
  ) THEN
    ALTER TABLE infrastructure_sandboxes DROP CONSTRAINT fk_infrastructure_sandboxes_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_infrastructure_connectors_tenant'
  ) THEN
    ALTER TABLE infrastructure_connectors DROP CONSTRAINT fk_infrastructure_connectors_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incidents_tenant'
  ) THEN
    ALTER TABLE incidents DROP CONSTRAINT fk_incidents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incident_timeline_events_tenant'
  ) THEN
    ALTER TABLE incident_timeline_events DROP CONSTRAINT fk_incident_timeline_events_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incident_postmortems_tenant'
  ) THEN
    ALTER TABLE incident_postmortems DROP CONSTRAINT fk_incident_postmortems_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incident_escalations_tenant'
  ) THEN
    ALTER TABLE incident_escalations DROP CONSTRAINT fk_incident_escalations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_inception_configs_tenant'
  ) THEN
    ALTER TABLE inception_configs DROP CONSTRAINT fk_inception_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_workspaces_tenant'
  ) THEN
    ALTER TABLE iac_workspaces DROP CONSTRAINT fk_iac_workspaces_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_workspace_modules_tenant'
  ) THEN
    ALTER TABLE iac_workspace_modules DROP CONSTRAINT fk_iac_workspace_modules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_state_versions_tenant'
  ) THEN
    ALTER TABLE iac_state_versions DROP CONSTRAINT fk_iac_state_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_resources_tenant'
  ) THEN
    ALTER TABLE iac_resources DROP CONSTRAINT fk_iac_resources_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_iac_plans_tenant'
  ) THEN
    ALTER TABLE iac_plans DROP CONSTRAINT fk_iac_plans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_i18n_translations_tenant'
  ) THEN
    ALTER TABLE i18n_translations DROP CONSTRAINT fk_i18n_translations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_hotfix_channels_tenant'
  ) THEN
    ALTER TABLE hotfix_channels DROP CONSTRAINT fk_hotfix_channels_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_health_checks_tenant'
  ) THEN
    ALTER TABLE health_checks DROP CONSTRAINT fk_health_checks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_healing_incidents_tenant'
  ) THEN
    ALTER TABLE healing_incidents DROP CONSTRAINT fk_healing_incidents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_handler_registry_entries_tenant'
  ) THEN
    ALTER TABLE handler_registry_entries DROP CONSTRAINT fk_handler_registry_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_handler_registries_tenant'
  ) THEN
    ALTER TABLE handler_registries DROP CONSTRAINT fk_handler_registries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_governance_policies_tenant'
  ) THEN
    ALTER TABLE governance_policies DROP CONSTRAINT fk_governance_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_global_params_tenant'
  ) THEN
    ALTER TABLE global_params DROP CONSTRAINT fk_global_params_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gitops_sync_statuses_tenant'
  ) THEN
    ALTER TABLE gitops_sync_statuses DROP CONSTRAINT fk_gitops_sync_statuses_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gitops_configs_tenant'
  ) THEN
    ALTER TABLE gitops_configs DROP CONSTRAINT fk_gitops_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_git_changelog_entries_tenant'
  ) THEN
    ALTER TABLE git_changelog_entries DROP CONSTRAINT fk_git_changelog_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gateway_routes_tenant'
  ) THEN
    ALTER TABLE gateway_routes DROP CONSTRAINT fk_gateway_routes_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_reports_tenant'
  ) THEN
    ALTER TABLE finops_reports DROP CONSTRAINT fk_finops_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_cost_items_tenant'
  ) THEN
    ALTER TABLE finops_cost_items DROP CONSTRAINT fk_finops_cost_items_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_budget_guards_tenant'
  ) THEN
    ALTER TABLE finops_budget_guards DROP CONSTRAINT fk_finops_budget_guards_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finops_anomalies_tenant'
  ) THEN
    ALTER TABLE finops_anomalies DROP CONSTRAINT fk_finops_anomalies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_federated_clusters_tenant'
  ) THEN
    ALTER TABLE federated_clusters DROP CONSTRAINT fk_federated_clusters_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_feature_flags_tenant'
  ) THEN
    ALTER TABLE feature_flags DROP CONSTRAINT fk_feature_flags_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_fault_injections_tenant'
  ) THEN
    ALTER TABLE fault_injections DROP CONSTRAINT fk_fault_injections_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiments_tenant'
  ) THEN
    ALTER TABLE experiments DROP CONSTRAINT fk_experiments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiment_runs_tenant'
  ) THEN
    ALTER TABLE experiment_runs DROP CONSTRAINT fk_experiment_runs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiment_results_tenant'
  ) THEN
    ALTER TABLE experiment_results DROP CONSTRAINT fk_experiment_results_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_experiment_logs_tenant'
  ) THEN
    ALTER TABLE experiment_logs DROP CONSTRAINT fk_experiment_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_execution_control_logs_tenant'
  ) THEN
    ALTER TABLE execution_control_logs DROP CONSTRAINT fk_execution_control_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_evaluations_tenant'
  ) THEN
    ALTER TABLE evaluations DROP CONSTRAINT fk_evaluations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_escalation_policies_tenant'
  ) THEN
    ALTER TABLE escalation_policies DROP CONSTRAINT fk_escalation_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_error_budgets_tenant'
  ) THEN
    ALTER TABLE error_budgets DROP CONSTRAINT fk_error_budgets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ephemeral_envs_tenant'
  ) THEN
    ALTER TABLE ephemeral_envs DROP CONSTRAINT fk_ephemeral_envs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_environments_tenant'
  ) THEN
    ALTER TABLE environments DROP CONSTRAINT fk_environments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_env_profiles_tenant'
  ) THEN
    ALTER TABLE env_profiles DROP CONSTRAINT fk_env_profiles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_env_lifecycles_tenant'
  ) THEN
    ALTER TABLE env_lifecycles DROP CONSTRAINT fk_env_lifecycles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_emergency_deploys_tenant'
  ) THEN
    ALTER TABLE emergency_deploys DROP CONSTRAINT fk_emergency_deploys_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_efficiency_scores_tenant'
  ) THEN
    ALTER TABLE efficiency_scores DROP CONSTRAINT fk_efficiency_scores_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_efficiency_recommendations_tenant'
  ) THEN
    ALTER TABLE efficiency_recommendations DROP CONSTRAINT fk_efficiency_recommendations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_efficiency_metrics_tenant'
  ) THEN
    ALTER TABLE efficiency_metrics DROP CONSTRAINT fk_efficiency_metrics_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_dual_engines_tenant'
  ) THEN
    ALTER TABLE dual_engines DROP CONSTRAINT fk_dual_engines_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_drift_reports_tenant'
  ) THEN
    ALTER TABLE drift_reports DROP CONSTRAINT fk_drift_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_domain_snapshots_tenant'
  ) THEN
    ALTER TABLE domain_snapshots DROP CONSTRAINT fk_domain_snapshots_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_domain_events_tenant'
  ) THEN
    ALTER TABLE domain_events DROP CONSTRAINT fk_domain_events_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_versions_tenant'
  ) THEN
    ALTER TABLE document_versions DROP CONSTRAINT fk_document_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_do_not_disturbs_tenant'
  ) THEN
    ALTER TABLE do_not_disturbs DROP CONSTRAINT fk_do_not_disturbs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_disaster_plans_tenant'
  ) THEN
    ALTER TABLE disaster_plans DROP CONSTRAINT fk_disaster_plans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_digital_twins_tenant'
  ) THEN
    ALTER TABLE digital_twins DROP CONSTRAINT fk_digital_twins_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_diagnostic_sessions_tenant'
  ) THEN
    ALTER TABLE diagnostic_sessions DROP CONSTRAINT fk_diagnostic_sessions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_diagnostic_patterns_tenant'
  ) THEN
    ALTER TABLE diagnostic_patterns DROP CONSTRAINT fk_diagnostic_patterns_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_developer_portals_tenant'
  ) THEN
    ALTER TABLE developer_portals DROP CONSTRAINT fk_developer_portals_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deployments_tenant'
  ) THEN
    ALTER TABLE deployments DROP CONSTRAINT fk_deployments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deployment_triggers_tenant'
  ) THEN
    ALTER TABLE deployment_triggers DROP CONSTRAINT fk_deployment_triggers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deploy_windows_tenant'
  ) THEN
    ALTER TABLE deploy_windows DROP CONSTRAINT fk_deploy_windows_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deploy_audit_entries_tenant'
  ) THEN
    ALTER TABLE deploy_audit_entries DROP CONSTRAINT fk_deploy_audit_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_dependency_coordinations_tenant'
  ) THEN
    ALTER TABLE dependency_coordinations DROP CONSTRAINT fk_dependency_coordinations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_degradations_tenant'
  ) THEN
    ALTER TABLE degradations DROP CONSTRAINT fk_degradations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_degradation_histories_tenant'
  ) THEN
    ALTER TABLE degradation_histories DROP CONSTRAINT fk_degradation_histories_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_degradation_configs_tenant'
  ) THEN
    ALTER TABLE degradation_configs DROP CONSTRAINT fk_degradation_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decisions_tenant'
  ) THEN
    ALTER TABLE decisions DROP CONSTRAINT fk_decisions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decision_traces_tenant'
  ) THEN
    ALTER TABLE decision_traces DROP CONSTRAINT fk_decision_traces_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decision_feedbacks_tenant'
  ) THEN
    ALTER TABLE decision_feedbacks DROP CONSTRAINT fk_decision_feedbacks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decision_explanations_tenant'
  ) THEN
    ALTER TABLE decision_explanations DROP CONSTRAINT fk_decision_explanations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_sources_tenant'
  ) THEN
    ALTER TABLE data_sources DROP CONSTRAINT fk_data_sources_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_quality_rules_tenant'
  ) THEN
    ALTER TABLE data_quality_rules DROP CONSTRAINT fk_data_quality_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_pipelines_tenant'
  ) THEN
    ALTER TABLE data_pipelines DROP CONSTRAINT fk_data_pipelines_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_data_lineages_tenant'
  ) THEN
    ALTER TABLE data_lineages DROP CONSTRAINT fk_data_lineages_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cross_domains_tenant'
  ) THEN
    ALTER TABLE cross_domains DROP CONSTRAINT fk_cross_domains_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cron_jobs_tenant'
  ) THEN
    ALTER TABLE cron_jobs DROP CONSTRAINT fk_cron_jobs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cron_job_logs_tenant'
  ) THEN
    ALTER TABLE cron_job_logs DROP CONSTRAINT fk_cron_job_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cron_job_executions_tenant'
  ) THEN
    ALTER TABLE cron_job_executions DROP CONSTRAINT fk_cron_job_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_records_tenant'
  ) THEN
    ALTER TABLE cost_records DROP CONSTRAINT fk_cost_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_entries_tenant'
  ) THEN
    ALTER TABLE cost_entries DROP CONSTRAINT fk_cost_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_allocations_tenant'
  ) THEN
    ALTER TABLE cost_allocations DROP CONSTRAINT fk_cost_allocations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_allocation_tags_tenant'
  ) THEN
    ALTER TABLE cost_allocation_tags DROP CONSTRAINT fk_cost_allocation_tags_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_allocation_reports_tenant'
  ) THEN
    ALTER TABLE cost_allocation_reports DROP CONSTRAINT fk_cost_allocation_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_configs_tenant'
  ) THEN
    ALTER TABLE configs DROP CONSTRAINT fk_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_webhooks_tenant'
  ) THEN
    ALTER TABLE config_webhooks DROP CONSTRAINT fk_config_webhooks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_versions_tenant'
  ) THEN
    ALTER TABLE config_versions DROP CONSTRAINT fk_config_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_templates_tenant'
  ) THEN
    ALTER TABLE config_templates DROP CONSTRAINT fk_config_templates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_template_versions_tenant'
  ) THEN
    ALTER TABLE config_template_versions DROP CONSTRAINT fk_config_template_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_snapshots_tenant'
  ) THEN
    ALTER TABLE config_snapshots DROP CONSTRAINT fk_config_snapshots_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_mgmts_tenant'
  ) THEN
    ALTER TABLE config_mgmts DROP CONSTRAINT fk_config_mgmts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_audit_entries_tenant'
  ) THEN
    ALTER TABLE config_audit_entries DROP CONSTRAINT fk_config_audit_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_schedules_tenant'
  ) THEN
    ALTER TABLE compliance_schedules DROP CONSTRAINT fk_compliance_schedules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_reports_tenant'
  ) THEN
    ALTER TABLE compliance_reports DROP CONSTRAINT fk_compliance_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_policies_tenant'
  ) THEN
    ALTER TABLE compliance_policies DROP CONSTRAINT fk_compliance_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_frameworks_tenant'
  ) THEN
    ALTER TABLE compliance_frameworks DROP CONSTRAINT fk_compliance_frameworks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_evidence_tenant'
  ) THEN
    ALTER TABLE compliance_evidence DROP CONSTRAINT fk_compliance_evidence_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_community_advanceds_tenant'
  ) THEN
    ALTER TABLE community_advanceds DROP CONSTRAINT fk_community_advanceds_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_communities_tenant'
  ) THEN
    ALTER TABLE communities DROP CONSTRAINT fk_communities_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_comments_tenant'
  ) THEN
    ALTER TABLE comments DROP CONSTRAINT fk_comments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_command_logs_tenant'
  ) THEN
    ALTER TABLE command_logs DROP CONSTRAINT fk_command_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_command_log_details_tenant'
  ) THEN
    ALTER TABLE command_log_details DROP CONSTRAINT fk_command_log_details_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_code_repos_tenant'
  ) THEN
    ALTER TABLE code_repos DROP CONSTRAINT fk_code_repos_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_code_repo_adapters_tenant'
  ) THEN
    ALTER TABLE code_repo_adapters DROP CONSTRAINT fk_code_repo_adapters_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cloud_resources_tenant'
  ) THEN
    ALTER TABLE cloud_resources DROP CONSTRAINT fk_cloud_resources_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cloud_accounts_tenant'
  ) THEN
    ALTER TABLE cloud_accounts DROP CONSTRAINT fk_cloud_accounts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cis_tenant'
  ) THEN
    ALTER TABLE cis DROP CONSTRAINT fk_cis_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_circuit_breakers_tenant'
  ) THEN
    ALTER TABLE circuit_breakers DROP CONSTRAINT fk_circuit_breakers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_circuit_breaker_events_tenant'
  ) THEN
    ALTER TABLE circuit_breaker_events DROP CONSTRAINT fk_circuit_breaker_events_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ci_versions_tenant'
  ) THEN
    ALTER TABLE ci_versions DROP CONSTRAINT fk_ci_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ci_types_tenant'
  ) THEN
    ALTER TABLE ci_types DROP CONSTRAINT fk_ci_types_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ci_relations_tenant'
  ) THEN
    ALTER TABLE ci_relations DROP CONSTRAINT fk_ci_relations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_checkpoints_tenant'
  ) THEN
    ALTER TABLE checkpoints DROP CONSTRAINT fk_checkpoints_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_webhooks_tenant'
  ) THEN
    ALTER TABLE chatops_webhooks DROP CONSTRAINT fk_chatops_webhooks_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_sessions_tenant'
  ) THEN
    ALTER TABLE chatops_sessions DROP CONSTRAINT fk_chatops_sessions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_rate_limits_tenant'
  ) THEN
    ALTER TABLE chatops_rate_limits DROP CONSTRAINT fk_chatops_rate_limits_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_question_configs_tenant'
  ) THEN
    ALTER TABLE chatops_question_configs DROP CONSTRAINT fk_chatops_question_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_platform_configs_tenant'
  ) THEN
    ALTER TABLE chatops_platform_configs DROP CONSTRAINT fk_chatops_platform_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_permission_roles_tenant'
  ) THEN
    ALTER TABLE chatops_permission_roles DROP CONSTRAINT fk_chatops_permission_roles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_notification_preferences_tenant'
  ) THEN
    ALTER TABLE chatops_notification_preferences DROP CONSTRAINT fk_chatops_notification_preferences_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_messages_tenant'
  ) THEN
    ALTER TABLE chatops_messages DROP CONSTRAINT fk_chatops_messages_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_executions_tenant'
  ) THEN
    ALTER TABLE chatops_executions DROP CONSTRAINT fk_chatops_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_environment_permissions_tenant'
  ) THEN
    ALTER TABLE chatops_environment_permissions DROP CONSTRAINT fk_chatops_environment_permissions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_dnd_settings_tenant'
  ) THEN
    ALTER TABLE chatops_dnd_settings DROP CONSTRAINT fk_chatops_dnd_settings_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_commands_tenant'
  ) THEN
    ALTER TABLE chatops_commands DROP CONSTRAINT fk_chatops_commands_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_versions_tenant'
  ) THEN
    ALTER TABLE chatops_command_versions DROP CONSTRAINT fk_chatops_command_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_permissions_tenant'
  ) THEN
    ALTER TABLE chatops_command_permissions DROP CONSTRAINT fk_chatops_command_permissions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_configs_tenant'
  ) THEN
    ALTER TABLE chatops_command_configs DROP CONSTRAINT fk_chatops_command_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_capability_mappings_tenant'
  ) THEN
    ALTER TABLE chatops_capability_mappings DROP CONSTRAINT fk_chatops_capability_mappings_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_audit_logs_tenant'
  ) THEN
    ALTER TABLE chatops_audit_logs DROP CONSTRAINT fk_chatops_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_approval_configs_tenant'
  ) THEN
    ALTER TABLE chatops_approval_configs DROP CONSTRAINT fk_chatops_approval_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_alert_states_tenant'
  ) THEN
    ALTER TABLE chatops_alert_states DROP CONSTRAINT fk_chatops_alert_states_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chargeback_entries_tenant'
  ) THEN
    ALTER TABLE chargeback_entries DROP CONSTRAINT fk_chargeback_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chaos_experiments_tenant'
  ) THEN
    ALTER TABLE chaos_experiments DROP CONSTRAINT fk_chaos_experiments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_change_requests_tenant'
  ) THEN
    ALTER TABLE change_requests DROP CONSTRAINT fk_change_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_change_histories_tenant'
  ) THEN
    ALTER TABLE change_histories DROP CONSTRAINT fk_change_histories_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_change_analysises_tenant'
  ) THEN
    ALTER TABLE change_analysises DROP CONSTRAINT fk_change_analysises_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_capability_audit_logs_tenant'
  ) THEN
    ALTER TABLE capability_audit_logs DROP CONSTRAINT fk_capability_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_capabilities_tenant'
  ) THEN
    ALTER TABLE capabilities DROP CONSTRAINT fk_capabilities_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_canary_traffics_tenant'
  ) THEN
    ALTER TABLE canary_traffics DROP CONSTRAINT fk_canary_traffics_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_canary_deployments_tenant'
  ) THEN
    ALTER TABLE canary_deployments DROP CONSTRAINT fk_canary_deployments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_canary_configs_tenant'
  ) THEN
    ALTER TABLE canary_configs DROP CONSTRAINT fk_canary_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cache_entries_tenant'
  ) THEN
    ALTER TABLE cache_entries DROP CONSTRAINT fk_cache_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cache_cleanups_tenant'
  ) THEN
    ALTER TABLE cache_cleanups DROP CONSTRAINT fk_cache_cleanups_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_builds_tenant'
  ) THEN
    ALTER TABLE builds DROP CONSTRAINT fk_builds_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_logs_tenant'
  ) THEN
    ALTER TABLE build_logs DROP CONSTRAINT fk_build_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_images_tenant'
  ) THEN
    ALTER TABLE build_images DROP CONSTRAINT fk_build_images_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_environments_tenant'
  ) THEN
    ALTER TABLE build_environments DROP CONSTRAINT fk_build_environments_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_build_cache_configs_tenant'
  ) THEN
    ALTER TABLE build_cache_configs DROP CONSTRAINT fk_build_cache_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_budgets_tenant'
  ) THEN
    ALTER TABLE budgets DROP CONSTRAINT fk_budgets_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_budget_history_records_tenant'
  ) THEN
    ALTER TABLE budget_history_records DROP CONSTRAINT fk_budget_history_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_budget_configs_tenant'
  ) THEN
    ALTER TABLE budget_configs DROP CONSTRAINT fk_budget_configs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_billing_subscriptions_tenant'
  ) THEN
    ALTER TABLE billing_subscriptions DROP CONSTRAINT fk_billing_subscriptions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_billing_invoices_tenant'
  ) THEN
    ALTER TABLE billing_invoices DROP CONSTRAINT fk_billing_invoices_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_billing_accounts_tenant'
  ) THEN
    ALTER TABLE billing_accounts DROP CONSTRAINT fk_billing_accounts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_bi_dashboards_tenant'
  ) THEN
    ALTER TABLE bi_dashboards DROP CONSTRAINT fk_bi_dashboards_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_batch_runs_tenant'
  ) THEN
    ALTER TABLE batch_runs DROP CONSTRAINT fk_batch_runs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_baselines_tenant'
  ) THEN
    ALTER TABLE baselines DROP CONSTRAINT fk_baselines_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_storages_tenant'
  ) THEN
    ALTER TABLE backup_storages DROP CONSTRAINT fk_backup_storages_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_restores_tenant'
  ) THEN
    ALTER TABLE backup_restores DROP CONSTRAINT fk_backup_restores_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_policies_tenant'
  ) THEN
    ALTER TABLE backup_policies DROP CONSTRAINT fk_backup_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_jobs_tenant'
  ) THEN
    ALTER TABLE backup_jobs DROP CONSTRAINT fk_backup_jobs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_token_blacklists_tenant'
  ) THEN
    ALTER TABLE auth_token_blacklists DROP CONSTRAINT fk_auth_token_blacklists_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_keies_tenant'
  ) THEN
    ALTER TABLE auth_keies DROP CONSTRAINT fk_auth_keies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_rules_tenant'
  ) THEN
    ALTER TABLE audit_rules DROP CONSTRAINT fk_audit_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_reports_tenant'
  ) THEN
    ALTER TABLE audit_reports DROP CONSTRAINT fk_audit_reports_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_plans_tenant'
  ) THEN
    ALTER TABLE audit_plans DROP CONSTRAINT fk_audit_plans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_tenant'
  ) THEN
    ALTER TABLE audit_logs DROP CONSTRAINT fk_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_findings_tenant'
  ) THEN
    ALTER TABLE audit_findings DROP CONSTRAINT fk_audit_findings_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_executions_tenant'
  ) THEN
    ALTER TABLE audit_executions DROP CONSTRAINT fk_audit_executions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifacts_tenant'
  ) THEN
    ALTER TABLE artifacts DROP CONSTRAINT fk_artifacts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_tags_tenant'
  ) THEN
    ALTER TABLE artifact_tags DROP CONSTRAINT fk_artifact_tags_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_signatures_tenant'
  ) THEN
    ALTER TABLE artifact_signatures DROP CONSTRAINT fk_artifact_signatures_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_scans_tenant'
  ) THEN
    ALTER TABLE artifact_scans DROP CONSTRAINT fk_artifact_scans_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_promotions_tenant'
  ) THEN
    ALTER TABLE artifact_promotions DROP CONSTRAINT fk_artifact_promotions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_operations_tenant'
  ) THEN
    ALTER TABLE artifact_operations DROP CONSTRAINT fk_artifact_operations_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_lifecycles_tenant'
  ) THEN
    ALTER TABLE artifact_lifecycles DROP CONSTRAINT fk_artifact_lifecycles_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_artifact_downloads_tenant'
  ) THEN
    ALTER TABLE artifact_downloads DROP CONSTRAINT fk_artifact_downloads_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_templates_tenant'
  ) THEN
    ALTER TABLE approval_templates DROP CONSTRAINT fk_approval_templates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_requests_tenant'
  ) THEN
    ALTER TABLE approval_requests DROP CONSTRAINT fk_approval_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_levels_tenant'
  ) THEN
    ALTER TABLE approval_levels DROP CONSTRAINT fk_approval_levels_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_history_tenant'
  ) THEN
    ALTER TABLE approval_history DROP CONSTRAINT fk_approval_history_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_gates_tenant'
  ) THEN
    ALTER TABLE approval_gates DROP CONSTRAINT fk_approval_gates_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_apm_entries_tenant'
  ) THEN
    ALTER TABLE apm_entries DROP CONSTRAINT fk_apm_entries_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_apk_upload_records_tenant'
  ) THEN
    ALTER TABLE apk_upload_records DROP CONSTRAINT fk_apk_upload_records_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_market_products_tenant'
  ) THEN
    ALTER TABLE api_market_products DROP CONSTRAINT fk_api_market_products_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_market_keys_tenant'
  ) THEN
    ALTER TABLE api_market_keys DROP CONSTRAINT fk_api_market_keys_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_market_apps_tenant'
  ) THEN
    ALTER TABLE api_market_apps DROP CONSTRAINT fk_api_market_apps_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_governance_versions_tenant'
  ) THEN
    ALTER TABLE api_governance_versions DROP CONSTRAINT fk_api_governance_versions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_governance_rules_tenant'
  ) THEN
    ALTER TABLE api_governance_rules DROP CONSTRAINT fk_api_governance_rules_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_governance_contracts_tenant'
  ) THEN
    ALTER TABLE api_governance_contracts DROP CONSTRAINT fk_api_governance_contracts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_contracts_tenant'
  ) THEN
    ALTER TABLE api_contracts DROP CONSTRAINT fk_api_contracts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_consumptions_tenant'
  ) THEN
    ALTER TABLE api_consumptions DROP CONSTRAINT fk_api_consumptions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_analysises_tenant'
  ) THEN
    ALTER TABLE analysises DROP CONSTRAINT fk_analysises_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alerts_tenant'
  ) THEN
    ALTER TABLE alerts DROP CONSTRAINT fk_alerts_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_topologies_tenant'
  ) THEN
    ALTER TABLE alert_topologies DROP CONSTRAINT fk_alert_topologies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_node_health_tenant'
  ) THEN
    ALTER TABLE alert_node_health DROP CONSTRAINT fk_alert_node_health_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_maintenance_windows_tenant'
  ) THEN
    ALTER TABLE alert_maintenance_windows DROP CONSTRAINT fk_alert_maintenance_windows_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_known_issues_tenant'
  ) THEN
    ALTER TABLE alert_known_issues DROP CONSTRAINT fk_alert_known_issues_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_alert_breakers_tenant'
  ) THEN
    ALTER TABLE alert_breakers DROP CONSTRAINT fk_alert_breakers_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_gateway_requests_tenant'
  ) THEN
    ALTER TABLE ai_gateway_requests DROP CONSTRAINT fk_ai_gateway_requests_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_decisions_tenant'
  ) THEN
    ALTER TABLE ai_decisions DROP CONSTRAINT fk_ai_decisions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_decision_traces_tenant'
  ) THEN
    ALTER TABLE ai_decision_traces DROP CONSTRAINT fk_ai_decision_traces_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_decision_feedback_tenant'
  ) THEN
    ALTER TABLE ai_decision_feedback DROP CONSTRAINT fk_ai_decision_feedback_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_agents_tenant'
  ) THEN
    ALTER TABLE agents DROP CONSTRAINT fk_agents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_agent_audit_logs_tenant'
  ) THEN
    ALTER TABLE agent_audit_logs DROP CONSTRAINT fk_agent_audit_logs_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_i_models_tenant'
  ) THEN
    ALTER TABLE a_i_models DROP CONSTRAINT fk_a_i_models_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_i_decisions_tenant'
  ) THEN
    ALTER TABLE a_i_decisions DROP CONSTRAINT fk_a_i_decisions_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_i_agents_tenant'
  ) THEN
    ALTER TABLE a_i_agents DROP CONSTRAINT fk_a_i_agents_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_a_b_a_c_policies_tenant'
  ) THEN
    ALTER TABLE a_b_a_c_policies DROP CONSTRAINT fk_a_b_a_c_policies_tenant;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_profiles_user'
  ) THEN
    ALTER TABLE u_e_b_a_profiles DROP CONSTRAINT fk_u_e_b_a_profiles_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_u_e_b_a_alerts_user'
  ) THEN
    ALTER TABLE u_e_b_a_alerts DROP CONSTRAINT fk_u_e_b_a_alerts_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_workflow_history_user'
  ) THEN
    ALTER TABLE ticket_workflow_history DROP CONSTRAINT fk_ticket_workflow_history_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_transfers_user'
  ) THEN
    ALTER TABLE ticket_transfers DROP CONSTRAINT fk_ticket_transfers_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_dispatch_engineers_user'
  ) THEN
    ALTER TABLE ticket_dispatch_engineers DROP CONSTRAINT fk_ticket_dispatch_engineers_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_users_user'
  ) THEN
    ALTER TABLE tenant_users DROP CONSTRAINT fk_tenant_users_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_temporary_permissions_user'
  ) THEN
    ALTER TABLE temporary_permissions DROP CONSTRAINT fk_temporary_permissions_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_members_user'
  ) THEN
    ALTER TABLE team_members DROP CONSTRAINT fk_team_members_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_user'
  ) THEN
    ALTER TABLE subscriptions DROP CONSTRAINT fk_subscriptions_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sql_orders_user'
  ) THEN
    ALTER TABLE sql_orders DROP CONSTRAINT fk_sql_orders_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_executions_user'
  ) THEN
    ALTER TABLE skill_executions DROP CONSTRAINT fk_skill_executions_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_skill_audit_logs_user'
  ) THEN
    ALTER TABLE skill_audit_logs DROP CONSTRAINT fk_skill_audit_logs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_scheduled_notifications_user'
  ) THEN
    ALTER TABLE scheduled_notifications DROP CONSTRAINT fk_scheduled_notifications_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reviews_user'
  ) THEN
    ALTER TABLE reviews DROP CONSTRAINT fk_reviews_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_query_execution_records_user'
  ) THEN
    ALTER TABLE query_execution_records DROP CONSTRAINT fk_query_execution_records_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_members_user'
  ) THEN
    ALTER TABLE project_members DROP CONSTRAINT fk_project_members_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_workflows_user'
  ) THEN
    ALTER TABLE policy_workflows DROP CONSTRAINT fk_policy_workflows_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_policies_user'
  ) THEN
    ALTER TABLE policies DROP CONSTRAINT fk_policies_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_playground_requests_user'
  ) THEN
    ALTER TABLE playground_requests DROP CONSTRAINT fk_playground_requests_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_requests_user'
  ) THEN
    ALTER TABLE permission_requests DROP CONSTRAINT fk_permission_requests_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_permission_audit_logs_user'
  ) THEN
    ALTER TABLE permission_audit_logs DROP CONSTRAINT fk_permission_audit_logs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_templates_user'
  ) THEN
    ALTER TABLE notification_templates DROP CONSTRAINT fk_notification_templates_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_m_f_a_devices_user'
  ) THEN
    ALTER TABLE m_f_a_devices DROP CONSTRAINT fk_m_f_a_devices_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_l_l_m_traces_user'
  ) THEN
    ALTER TABLE l_l_m_traces DROP CONSTRAINT fk_l_l_m_traces_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_do_not_disturbs_user'
  ) THEN
    ALTER TABLE do_not_disturbs DROP CONSTRAINT fk_do_not_disturbs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deploy_audit_entries_user'
  ) THEN
    ALTER TABLE deploy_audit_entries DROP CONSTRAINT fk_deploy_audit_entries_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_audit_entries_user'
  ) THEN
    ALTER TABLE config_audit_entries DROP CONSTRAINT fk_config_audit_entries_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_comments_user'
  ) THEN
    ALTER TABLE comments DROP CONSTRAINT fk_comments_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_sessions_user'
  ) THEN
    ALTER TABLE chatops_sessions DROP CONSTRAINT fk_chatops_sessions_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_question_configs_user'
  ) THEN
    ALTER TABLE chatops_question_configs DROP CONSTRAINT fk_chatops_question_configs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_platform_configs_user'
  ) THEN
    ALTER TABLE chatops_platform_configs DROP CONSTRAINT fk_chatops_platform_configs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_notification_preferences_user'
  ) THEN
    ALTER TABLE chatops_notification_preferences DROP CONSTRAINT fk_chatops_notification_preferences_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_messages_user'
  ) THEN
    ALTER TABLE chatops_messages DROP CONSTRAINT fk_chatops_messages_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_executions_user'
  ) THEN
    ALTER TABLE chatops_executions DROP CONSTRAINT fk_chatops_executions_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_dnd_settings_user'
  ) THEN
    ALTER TABLE chatops_dnd_settings DROP CONSTRAINT fk_chatops_dnd_settings_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_command_configs_user'
  ) THEN
    ALTER TABLE chatops_command_configs DROP CONSTRAINT fk_chatops_command_configs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_audit_logs_user'
  ) THEN
    ALTER TABLE chatops_audit_logs DROP CONSTRAINT fk_chatops_audit_logs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chatops_alert_states_user'
  ) THEN
    ALTER TABLE chatops_alert_states DROP CONSTRAINT fk_chatops_alert_states_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_capability_audit_logs_user'
  ) THEN
    ALTER TABLE capability_audit_logs DROP CONSTRAINT fk_capability_audit_logs_user;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_user'
  ) THEN
    ALTER TABLE audit_logs DROP CONSTRAINT fk_audit_logs_user;
  END IF;
END $$;

SELECT 'Dropped 444 foreign key constraints' AS migration_result;

COMMIT;
