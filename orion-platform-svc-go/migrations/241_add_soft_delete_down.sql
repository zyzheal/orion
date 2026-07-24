-- Migration: 241_add_soft_delete_down.sql
-- Description: Rollback soft delete columns and indexes
-- Phase: 5.5

BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'workbenches' AND indexname = 'idx_workbenches_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_workbenches_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workbenches' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE workbenches DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'widget_configs' AND indexname = 'idx_widget_configs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_widget_configs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'widget_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE widget_configs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'webhooks_secrets' AND indexname = 'idx_webhooks_secrets_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_webhooks_secrets_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhooks_secrets' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE webhooks_secrets DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'idx_users_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_users_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'usage_records' AND indexname = 'idx_usage_records_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_usage_records_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_records' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE usage_records DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'usage_limits' AND indexname = 'idx_usage_limits_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_usage_limits_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_limits' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE usage_limits DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'upload_tasks' AND indexname = 'idx_upload_tasks_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_upload_tasks_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'upload_tasks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE upload_tasks DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'traffic_records' AND indexname = 'idx_traffic_records_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_traffic_records_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'traffic_records' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE traffic_records DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tickets' AND indexname = 'idx_tickets_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_tickets_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE tickets DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticketing_service_state' AND indexname = 'idx_ticketing_service_state_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticketing_service_state_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_service_state' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticketing_service_state DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticketing_dispatch_weights' AND indexname = 'idx_ticketing_dispatch_weights_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticketing_dispatch_weights_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticketing_dispatch_weights' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticketing_dispatch_weights DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_workflow_history' AND indexname = 'idx_ticket_workflow_history_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_workflow_history_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_workflow_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_workflow_history DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_transfers' AND indexname = 'idx_ticket_transfers_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_transfers_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_transfers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_transfers DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_suspends' AND indexname = 'idx_ticket_suspends_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_suspends_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_suspends' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_suspends DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_sla_tracking' AND indexname = 'idx_ticket_sla_tracking_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_sla_tracking_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_tracking' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_sla_tracking DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_sla_targets' AND indexname = 'idx_ticket_sla_targets_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_sla_targets_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_targets' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_sla_targets DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_sla_policies' AND indexname = 'idx_ticket_sla_policies_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_sla_policies_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_sla_policies DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_sla_breaches' AND indexname = 'idx_ticket_sla_breaches_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_sla_breaches_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_sla_breaches' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_sla_breaches DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_relations' AND indexname = 'idx_ticket_relations_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_relations_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_relations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_relations DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_dispatch_rules' AND indexname = 'idx_ticket_dispatch_rules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_dispatch_rules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_dispatch_rules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_dispatch_engineers' AND indexname = 'idx_ticket_dispatch_engineers_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_dispatch_engineers_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_dispatch_engineers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_dispatch_engineers DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_automation_rules' AND indexname = 'idx_ticket_automation_rules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_automation_rules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_automation_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_automation_rules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_assignments' AND indexname = 'idx_ticket_assignments_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_assignments_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_assignments DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ticket_assignment_rules' AND indexname = 'idx_ticket_assignment_rules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ticket_assignment_rules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_assignment_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ticket_assignment_rules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tenant_users' AND indexname = 'idx_tenant_users_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_tenant_users_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_users' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE tenant_users DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tenant_quotas' AND indexname = 'idx_tenant_quotas_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_tenant_quotas_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quotas' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tenant_quota_alerts' AND indexname = 'idx_tenant_quota_alerts_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_tenant_quota_alerts_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_quota_alerts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE tenant_quota_alerts DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tenant_invites' AND indexname = 'idx_tenant_invites_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_tenant_invites_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_invites' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE tenant_invites DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'temporary_permissions' AND indexname = 'idx_temporary_permissions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_temporary_permissions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temporary_permissions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE temporary_permissions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'teams' AND indexname = 'idx_teams_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_teams_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE teams DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'team_roles' AND indexname = 'idx_team_roles_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_team_roles_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_roles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE team_roles DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'team_members' AND indexname = 'idx_team_members_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_team_members_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE team_members DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subscriptions' AND indexname = 'idx_subscriptions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_subscriptions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE subscriptions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subapp_configs' AND indexname = 'idx_subapp_configs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_subapp_configs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE subapp_configs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subapp_config_histories' AND indexname = 'idx_subapp_config_histories_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_subapp_config_histories_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subapp_config_histories' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE subapp_config_histories DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sql_orders' AND indexname = 'idx_sql_orders_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_sql_orders_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_orders' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sql_orders DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sql_blacklist' AND indexname = 'idx_sql_blacklist_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_sql_blacklist_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_blacklist' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sql_blacklist DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sql_audit_history' AND indexname = 'idx_sql_audit_history_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_sql_audit_history_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sql_audit_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sql_audit_history DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sprints' AND indexname = 'idx_sprints_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_sprints_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprints' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sprints DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sprint_tickets' AND indexname = 'idx_sprint_tickets_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_sprint_tickets_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprint_tickets' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sprint_tickets DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'snapshots' AND indexname = 'idx_snapshots_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_snapshots_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE snapshots DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'smart_deploy_rollbacks' AND indexname = 'idx_smart_deploy_rollbacks_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_smart_deploy_rollbacks_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_rollbacks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE smart_deploy_rollbacks DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'smart_deploy_deployments' AND indexname = 'idx_smart_deploy_deployments_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_smart_deploy_deployments_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_deployments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE smart_deploy_deployments DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'smart_deploy_audit' AND indexname = 'idx_smart_deploy_audit_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_smart_deploy_audit_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_deploy_audit' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE smart_deploy_audit DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sla_trackings' AND indexname = 'idx_sla_trackings_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_sla_trackings_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_trackings' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sla_trackings DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sla_definitions' AND indexname = 'idx_sla_definitions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_sla_definitions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_definitions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sla_definitions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sla_breach_events' AND indexname = 'idx_sla_breach_events_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_sla_breach_events_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_breach_events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sla_breach_events DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sessions' AND indexname = 'idx_sessions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_sessions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sessions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'service_registries' AND indexname = 'idx_service_registries_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_service_registries_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_registries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE service_registries DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'serverless_triggers' AND indexname = 'idx_serverless_triggers_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_serverless_triggers_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_triggers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE serverless_triggers DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'serverless_functions' AND indexname = 'idx_serverless_functions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_serverless_functions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_functions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE serverless_functions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'serverless_function_logs' AND indexname = 'idx_serverless_function_logs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_serverless_function_logs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_function_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE serverless_function_logs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'serverless_deployments' AND indexname = 'idx_serverless_deployments_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_serverless_deployments_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'serverless_deployments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE serverless_deployments DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sdk_tasks' AND indexname = 'idx_sdk_tasks_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_sdk_tasks_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sdk_tasks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sdk_tasks DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'script_templates' AND indexname = 'idx_script_templates_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_script_templates_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'script_templates' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE script_templates DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'scan_reports' AND indexname = 'idx_scan_reports_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_scan_reports_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_reports' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE scan_reports DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sandbox_network_policies' AND indexname = 'idx_sandbox_network_policies_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_sandbox_network_policies_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sandbox_network_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE sandbox_network_policies DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'saga_transactions' AND indexname = 'idx_saga_transactions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_saga_transactions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_transactions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE saga_transactions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'saga_steps' AND indexname = 'idx_saga_steps_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_saga_steps_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_steps' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE saga_steps DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'saga_instances' AND indexname = 'idx_saga_instances_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_saga_instances_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saga_instances' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE saga_instances DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'rollbacks' AND indexname = 'idx_rollbacks_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_rollbacks_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rollbacks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE rollbacks DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'roles' AND indexname = 'idx_roles_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_roles_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE roles DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'roi_entries' AND indexname = 'idx_roi_entries_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_roi_entries_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roi_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE roi_entries DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'reviews' AND indexname = 'idx_reviews_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_reviews_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE reviews DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'retention_policies' AND indexname = 'idx_retention_policies_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_retention_policies_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retention_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE retention_policies DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'response_history' AND indexname = 'idx_response_history_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_response_history_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'response_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE response_history DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'report_schedules' AND indexname = 'idx_report_schedules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_report_schedules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_schedules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE report_schedules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'report_executions' AND indexname = 'idx_report_executions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_report_executions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE report_executions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'report_definitions' AND indexname = 'idx_report_definitions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_report_definitions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_definitions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE report_definitions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'report_datasources' AND indexname = 'idx_report_datasources_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_report_datasources_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_datasources' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE report_datasources DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'replay_sessions' AND indexname = 'idx_replay_sessions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_replay_sessions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'replay_sessions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE replay_sessions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'release_trains' AND indexname = 'idx_release_trains_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_release_trains_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_trains' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE release_trains DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'release_notes' AND indexname = 'idx_release_notes_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_release_notes_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'release_notes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE release_notes DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'recording_sessions' AND indexname = 'idx_recording_sessions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_recording_sessions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recording_sessions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE recording_sessions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'query_execution_records' AND indexname = 'idx_query_execution_records_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_query_execution_records_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_execution_records' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE query_execution_records DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'quality_scan_results' AND indexname = 'idx_quality_scan_results_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_quality_scan_results_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_scan_results' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE quality_scan_results DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'quality_alerts' AND indexname = 'idx_quality_alerts_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_quality_alerts_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quality_alerts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE quality_alerts DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pull_requests' AND indexname = 'idx_pull_requests_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_pull_requests_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pull_requests' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE pull_requests DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'project_members' AND indexname = 'idx_project_members_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_project_members_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_members' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE project_members DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'progressive_deploys' AND indexname = 'idx_progressive_deploys_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_progressive_deploys_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progressive_deploys' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE progressive_deploys DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'product_lines' AND indexname = 'idx_product_lines_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_product_lines_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lines' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE product_lines DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'problem_problems' AND indexname = 'idx_problem_problems_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_problem_problems_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_problems' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE problem_problems DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'problem_known_errors' AND indexname = 'idx_problem_known_errors_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_problem_known_errors_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_known_errors' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE problem_known_errors DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'problem_incident_links' AND indexname = 'idx_problem_incident_links_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_problem_incident_links_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_incident_links' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE problem_incident_links DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'problem_change_links' AND indexname = 'idx_problem_change_links_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_problem_change_links_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problem_change_links' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE problem_change_links DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'portal_documents' AND indexname = 'idx_portal_documents_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_portal_documents_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_documents' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE portal_documents DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'policy_violations' AND indexname = 'idx_policy_violations_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_policy_violations_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_violations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE policy_violations DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'policy_overrides' AND indexname = 'idx_policy_overrides_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_policy_overrides_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_overrides' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE policy_overrides DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'policy_exemptions' AND indexname = 'idx_policy_exemptions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_policy_exemptions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_exemptions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE policy_exemptions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'policy_evaluations' AND indexname = 'idx_policy_evaluations_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_policy_evaluations_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_evaluations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE policy_evaluations DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'policy_bundles' AND indexname = 'idx_policy_bundles_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_policy_bundles_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_bundles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE policy_bundles DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugins' AND indexname = 'idx_plugins_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_plugins_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugins' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugins DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugin_tenant_quotas' AND indexname = 'idx_plugin_tenant_quotas_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_plugin_tenant_quotas_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_tenant_quotas' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugin_tenant_quotas DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugin_security_events' AND indexname = 'idx_plugin_security_events_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_plugin_security_events_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_security_events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugin_security_events DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugin_resource_quotas' AND indexname = 'idx_plugin_resource_quotas_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_plugin_resource_quotas_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_resource_quotas' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugin_resource_quotas DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugin_executions' AND indexname = 'idx_plugin_executions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_plugin_executions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugin_executions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'plugin_audit_entries' AND indexname = 'idx_plugin_audit_entries_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_plugin_audit_entries_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plugin_audit_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE plugin_audit_entries DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'playground_requests' AND indexname = 'idx_playground_requests_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_playground_requests_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playground_requests' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE playground_requests DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pipeline_tasks' AND indexname = 'idx_pipeline_tasks_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_pipeline_tasks_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_tasks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE pipeline_tasks DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pipeline_stages' AND indexname = 'idx_pipeline_stages_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_pipeline_stages_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_stages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE pipeline_stages DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pipeline_checkpoints' AND indexname = 'idx_pipeline_checkpoints_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_pipeline_checkpoints_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_checkpoints' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE pipeline_checkpoints DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'permissions' AND indexname = 'idx_permissions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_permissions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permissions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE permissions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'permission_requests' AND indexname = 'idx_permission_requests_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_permission_requests_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permission_requests' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE permission_requests DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'page_registry_histories' AND indexname = 'idx_page_registry_histories_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_page_registry_histories_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registry_histories' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE page_registry_histories DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'page_registries' AND indexname = 'idx_page_registries_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_page_registries_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_registries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE page_registries DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'oncall_schedules' AND indexname = 'idx_oncall_schedules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_oncall_schedules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_schedules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE oncall_schedules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'oncall_overrides' AND indexname = 'idx_oncall_overrides_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_oncall_overrides_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_overrides' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE oncall_overrides DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'oncall_assignments' AND indexname = 'idx_oncall_assignments_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_oncall_assignments_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oncall_assignments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE oncall_assignments DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'notification_templates' AND indexname = 'idx_notification_templates_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_notification_templates_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_templates' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE notification_templates DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'notification_records' AND indexname = 'idx_notification_records_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_notification_records_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_records' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE notification_records DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'namespace_allocations' AND indexname = 'idx_namespace_allocations_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_namespace_allocations_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'namespace_allocations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE namespace_allocations DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'monitoring_metrics' AND indexname = 'idx_monitoring_metrics_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_monitoring_metrics_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_metrics' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE monitoring_metrics DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'monitoring_anomalies' AND indexname = 'idx_monitoring_anomalies_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_monitoring_anomalies_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_anomalies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE monitoring_anomalies DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'monitoring_alerts' AND indexname = 'idx_monitoring_alerts_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_monitoring_alerts_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alerts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE monitoring_alerts DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'monitoring_alert_rules' AND indexname = 'idx_monitoring_alert_rules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_monitoring_alert_rules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_alert_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE monitoring_alert_rules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'mock_rules' AND indexname = 'idx_mock_rules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_mock_rules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mock_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE mock_rules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lowcode_workflow_instance' AND indexname = 'idx_lowcode_workflow_instance_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_lowcode_workflow_instance_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_instance' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE lowcode_workflow_instance DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lowcode_workflow_definition' AND indexname = 'idx_lowcode_workflow_definition_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_lowcode_workflow_definition_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lowcode_workflow_definition' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE lowcode_workflow_definition DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'locales' AND indexname = 'idx_locales_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_locales_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locales' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE locales DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lineage_relationships' AND indexname = 'idx_lineage_relationships_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_lineage_relationships_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_relationships' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE lineage_relationships DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lineage_nodes' AND indexname = 'idx_lineage_nodes_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_lineage_nodes_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lineage_nodes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE lineage_nodes DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'library_versions' AND indexname = 'idx_library_versions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_library_versions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE library_versions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'library_dependents' AND indexname = 'idx_library_dependents_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_library_dependents_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'library_dependents' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE library_dependents DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'knowledge_sync_logs' AND indexname = 'idx_knowledge_sync_logs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_knowledge_sync_logs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_sync_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE knowledge_sync_logs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'knowledge_spaces' AND indexname = 'idx_knowledge_spaces_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_knowledge_spaces_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_spaces' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE knowledge_spaces DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'knowledge_documents' AND indexname = 'idx_knowledge_documents_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_knowledge_documents_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_documents' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'knowledge_doc_versions' AND indexname = 'idx_knowledge_doc_versions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_knowledge_doc_versions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_doc_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE knowledge_doc_versions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'internal_libraries' AND indexname = 'idx_internal_libraries_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_internal_libraries_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'internal_libraries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE internal_libraries DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'infrastructure_sandboxes' AND indexname = 'idx_infrastructure_sandboxes_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_infrastructure_sandboxes_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_sandboxes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE infrastructure_sandboxes DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'infrastructure_connectors' AND indexname = 'idx_infrastructure_connectors_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_infrastructure_connectors_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infrastructure_connectors' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE infrastructure_connectors DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'incidents' AND indexname = 'idx_incidents_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_incidents_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE incidents DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'incident_timeline_events' AND indexname = 'idx_incident_timeline_events_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_incident_timeline_events_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_timeline_events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE incident_timeline_events DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'incident_postmortems' AND indexname = 'idx_incident_postmortems_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_incident_postmortems_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_postmortems' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE incident_postmortems DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'incident_escalations' AND indexname = 'idx_incident_escalations_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_incident_escalations_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_escalations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE incident_escalations DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'inception_configs' AND indexname = 'idx_inception_configs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_inception_configs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inception_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE inception_configs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'iac_workspaces' AND indexname = 'idx_iac_workspaces_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_iac_workspaces_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspaces' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE iac_workspaces DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'iac_workspace_modules' AND indexname = 'idx_iac_workspace_modules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_iac_workspace_modules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_workspace_modules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE iac_workspace_modules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'iac_state_versions' AND indexname = 'idx_iac_state_versions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_iac_state_versions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_state_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE iac_state_versions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'iac_resources' AND indexname = 'idx_iac_resources_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_iac_resources_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_resources' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE iac_resources DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'iac_plans' AND indexname = 'idx_iac_plans_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_iac_plans_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'iac_plans' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE iac_plans DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'i18n_translations' AND indexname = 'idx_i18n_translations_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_i18n_translations_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'i18n_translations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE i18n_translations DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'hotfix_channels' AND indexname = 'idx_hotfix_channels_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_hotfix_channels_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hotfix_channels' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE hotfix_channels DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'hook_chains' AND indexname = 'idx_hook_chains_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_hook_chains_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hook_chains' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE hook_chains DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'handler_registry_entries' AND indexname = 'idx_handler_registry_entries_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_handler_registry_entries_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registry_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE handler_registry_entries DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'handler_registries' AND indexname = 'idx_handler_registries_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_handler_registries_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'handler_registries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE handler_registries DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'gitops_sync_statuses' AND indexname = 'idx_gitops_sync_statuses_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_gitops_sync_statuses_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_sync_statuses' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE gitops_sync_statuses DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'gitops_configs' AND indexname = 'idx_gitops_configs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_gitops_configs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gitops_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE gitops_configs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'git_changelog_entries' AND indexname = 'idx_git_changelog_entries_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_git_changelog_entries_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'git_changelog_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE git_changelog_entries DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'gateway_routes' AND indexname = 'idx_gateway_routes_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_gateway_routes_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gateway_routes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE gateway_routes DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'flag_toggle_history' AND indexname = 'idx_flag_toggle_history_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_flag_toggle_history_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flag_toggle_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE flag_toggle_history DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'finops_reports' AND indexname = 'idx_finops_reports_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_finops_reports_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_reports' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE finops_reports DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'finops_cost_items' AND indexname = 'idx_finops_cost_items_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_finops_cost_items_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_cost_items' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE finops_cost_items DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'finops_budget_guards' AND indexname = 'idx_finops_budget_guards_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_finops_budget_guards_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_budget_guards' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE finops_budget_guards DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'finops_anomalies' AND indexname = 'idx_finops_anomalies_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_finops_anomalies_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finops_anomalies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE finops_anomalies DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'federated_clusters' AND indexname = 'idx_federated_clusters_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_federated_clusters_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'federated_clusters' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE federated_clusters DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'feature_flags' AND indexname = 'idx_feature_flags_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_feature_flags_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_flags' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE feature_flags DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'experiment_runs' AND indexname = 'idx_experiment_runs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_experiment_runs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'experiment_runs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE experiment_runs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'events' AND indexname = 'idx_events_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_events_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE events DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'event_triggers' AND indexname = 'idx_event_triggers_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_event_triggers_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_triggers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE event_triggers DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'escalation_policies' AND indexname = 'idx_escalation_policies_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_escalation_policies_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escalation_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE escalation_policies DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'emergency_deploys' AND indexname = 'idx_emergency_deploys_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_emergency_deploys_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emergency_deploys' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE emergency_deploys DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'efficiency_scores' AND indexname = 'idx_efficiency_scores_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_efficiency_scores_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_scores' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE efficiency_scores DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'efficiency_recommendations' AND indexname = 'idx_efficiency_recommendations_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_efficiency_recommendations_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_recommendations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE efficiency_recommendations DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'efficiency_metrics' AND indexname = 'idx_efficiency_metrics_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_efficiency_metrics_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'efficiency_metrics' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE efficiency_metrics DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'domain_snapshots' AND indexname = 'idx_domain_snapshots_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_domain_snapshots_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_snapshots' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE domain_snapshots DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'domain_events' AND indexname = 'idx_domain_events_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_domain_events_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE domain_events DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'document_versions' AND indexname = 'idx_document_versions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_document_versions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE document_versions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'diagnostic_symptoms' AND indexname = 'idx_diagnostic_symptoms_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_diagnostic_symptoms_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_symptoms' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE diagnostic_symptoms DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'diagnostic_sessions' AND indexname = 'idx_diagnostic_sessions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_diagnostic_sessions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_sessions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE diagnostic_sessions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'diagnostic_reports' AND indexname = 'idx_diagnostic_reports_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_diagnostic_reports_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_reports' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE diagnostic_reports DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'diagnostic_patterns' AND indexname = 'idx_diagnostic_patterns_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_diagnostic_patterns_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diagnostic_patterns' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE diagnostic_patterns DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'developer_portals' AND indexname = 'idx_developer_portals_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_developer_portals_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'developer_portals' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE developer_portals DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'deployments' AND indexname = 'idx_deployments_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_deployments_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE deployments DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'deploy_windows' AND indexname = 'idx_deploy_windows_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_deploy_windows_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_windows' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE deploy_windows DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'deploy_audit_entries' AND indexname = 'idx_deploy_audit_entries_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_deploy_audit_entries_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deploy_audit_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE deploy_audit_entries DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'data_sources' AND indexname = 'idx_data_sources_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_data_sources_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_sources' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE data_sources DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'data_quality_rules' AND indexname = 'idx_data_quality_rules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_data_quality_rules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_quality_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE data_quality_rules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'data_pipelines' AND indexname = 'idx_data_pipelines_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_data_pipelines_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_pipelines' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE data_pipelines DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'data_lineages' AND indexname = 'idx_data_lineages_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_data_lineages_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_lineages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE data_lineages DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cron_jobs' AND indexname = 'idx_cron_jobs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_cron_jobs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_jobs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cron_jobs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cron_job_logs' AND indexname = 'idx_cron_job_logs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_cron_job_logs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cron_job_logs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cron_job_executions' AND indexname = 'idx_cron_job_executions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_cron_job_executions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cron_job_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cron_job_executions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cost_allocations' AND indexname = 'idx_cost_allocations_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_cost_allocations_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cost_allocations DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cost_allocation_tags' AND indexname = 'idx_cost_allocation_tags_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_cost_allocation_tags_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_tags' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cost_allocation_tags DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cost_allocation_rules' AND indexname = 'idx_cost_allocation_rules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_cost_allocation_rules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cost_allocation_rules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cost_allocation_reports' AND indexname = 'idx_cost_allocation_reports_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_cost_allocation_reports_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_allocation_reports' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cost_allocation_reports DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'contract_endpoints' AND indexname = 'idx_contract_endpoints_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_contract_endpoints_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_endpoints' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE contract_endpoints DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'configs' AND indexname = 'idx_configs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_configs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE configs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_webhooks' AND indexname = 'idx_config_webhooks_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_config_webhooks_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_webhooks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_webhooks DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_versions' AND indexname = 'idx_config_versions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_config_versions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_versions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_templates' AND indexname = 'idx_config_templates_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_config_templates_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_templates' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_templates DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_template_versions' AND indexname = 'idx_config_template_versions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_config_template_versions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_template_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_template_versions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_snapshots' AND indexname = 'idx_config_snapshots_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_config_snapshots_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_snapshots' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_snapshots DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'config_audit_entries' AND indexname = 'idx_config_audit_entries_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_config_audit_entries_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'config_audit_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE config_audit_entries DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'compliance_policies' AND indexname = 'idx_compliance_policies_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_compliance_policies_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE compliance_policies DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'compliance_frameworks' AND indexname = 'idx_compliance_frameworks_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_compliance_frameworks_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_frameworks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE compliance_frameworks DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'compliance_evidence' AND indexname = 'idx_compliance_evidence_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_compliance_evidence_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_evidence' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE compliance_evidence DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'comments' AND indexname = 'idx_comments_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_comments_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE comments DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'command_logs' AND indexname = 'idx_command_logs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_command_logs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE command_logs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'command_log_details' AND indexname = 'idx_command_log_details_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_command_log_details_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_log_details' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE command_log_details DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'collection_schedules' AND indexname = 'idx_collection_schedules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_collection_schedules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collection_schedules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE collection_schedules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'code_repos' AND indexname = 'idx_code_repos_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_code_repos_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repos' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE code_repos DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'code_repo_adapters' AND indexname = 'idx_code_repo_adapters_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_code_repo_adapters_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_repo_adapters' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE code_repo_adapters DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cis' AND indexname = 'idx_cis_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_cis_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cis' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE cis DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'circuit_breaker_events' AND indexname = 'idx_circuit_breaker_events_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_circuit_breaker_events_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'circuit_breaker_events' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE circuit_breaker_events DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ci_versions' AND indexname = 'idx_ci_versions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ci_versions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ci_versions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ci_types' AND indexname = 'idx_ci_types_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ci_types_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_types' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ci_types DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ci_type_versions' AND indexname = 'idx_ci_type_versions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ci_type_versions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ci_type_versions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ci_type_attributes' AND indexname = 'idx_ci_type_attributes_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ci_type_attributes_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_type_attributes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ci_type_attributes DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ci_relations' AND indexname = 'idx_ci_relations_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ci_relations_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ci_relations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ci_relations DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_webhooks' AND indexname = 'idx_chatops_webhooks_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_webhooks_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_webhooks' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_webhooks DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_sessions' AND indexname = 'idx_chatops_sessions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_sessions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_sessions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_sessions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_rate_limits' AND indexname = 'idx_chatops_rate_limits_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_rate_limits_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_rate_limits' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_rate_limits DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_question_configs' AND indexname = 'idx_chatops_question_configs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_question_configs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_question_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_question_configs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_platform_configs' AND indexname = 'idx_chatops_platform_configs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_platform_configs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_platform_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_platform_configs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_permission_roles' AND indexname = 'idx_chatops_permission_roles_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_permission_roles_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_permission_roles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_permission_roles DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_notification_preferences' AND indexname = 'idx_chatops_notification_preferences_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_notification_preferences_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_notification_preferences' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_notification_preferences DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_messages' AND indexname = 'idx_chatops_messages_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_messages_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_messages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_messages DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_executions' AND indexname = 'idx_chatops_executions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_executions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_executions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_environment_permissions' AND indexname = 'idx_chatops_environment_permissions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_environment_permissions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_environment_permissions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_environment_permissions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_dnd_settings' AND indexname = 'idx_chatops_dnd_settings_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_dnd_settings_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_dnd_settings' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_dnd_settings DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_commands' AND indexname = 'idx_chatops_commands_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_commands_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_commands' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_commands DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_command_versions' AND indexname = 'idx_chatops_command_versions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_command_versions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_command_versions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_command_permissions' AND indexname = 'idx_chatops_command_permissions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_command_permissions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_permissions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_command_permissions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_command_configs' AND indexname = 'idx_chatops_command_configs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_command_configs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_command_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_command_configs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_capability_mappings' AND indexname = 'idx_chatops_capability_mappings_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_capability_mappings_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_capability_mappings' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_capability_mappings DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_audit_logs' AND indexname = 'idx_chatops_audit_logs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_audit_logs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_audit_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_audit_logs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_approval_configs' AND indexname = 'idx_chatops_approval_configs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_approval_configs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_approval_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_approval_configs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chatops_alert_states' AND indexname = 'idx_chatops_alert_states_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_chatops_alert_states_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatops_alert_states' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE chatops_alert_states DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'change_executions' AND indexname = 'idx_change_executions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_change_executions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE change_executions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'change_approvals' AND indexname = 'idx_change_approvals_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_change_approvals_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_approvals' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE change_approvals DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'capability_audit_logs' AND indexname = 'idx_capability_audit_logs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_capability_audit_logs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_audit_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE capability_audit_logs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'capabilities' AND indexname = 'idx_capabilities_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_capabilities_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capabilities' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE capabilities DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'canary_deployments' AND indexname = 'idx_canary_deployments_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_canary_deployments_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canary_deployments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE canary_deployments DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'build_logs' AND indexname = 'idx_build_logs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_build_logs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_logs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE build_logs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'build_images' AND indexname = 'idx_build_images_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_build_images_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_images' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE build_images DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'build_cache_entries' AND indexname = 'idx_build_cache_entries_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_build_cache_entries_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_entries' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE build_cache_entries DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'build_cache_configs' AND indexname = 'idx_build_cache_configs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_build_cache_configs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'build_cache_configs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE build_cache_configs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'billing_subscriptions' AND indexname = 'idx_billing_subscriptions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_billing_subscriptions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_subscriptions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE billing_subscriptions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'billing_line_items' AND indexname = 'idx_billing_line_items_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_billing_line_items_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_line_items' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE billing_line_items DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'billing_invoices' AND indexname = 'idx_billing_invoices_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_billing_invoices_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_invoices' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE billing_invoices DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'billing_accounts' AND indexname = 'idx_billing_accounts_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_billing_accounts_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_accounts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE billing_accounts DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'backup_storages' AND indexname = 'idx_backup_storages_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_backup_storages_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_storages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE backup_storages DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'backup_restores' AND indexname = 'idx_backup_restores_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_backup_restores_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_restores' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE backup_restores DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'backup_policies' AND indexname = 'idx_backup_policies_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_backup_policies_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_policies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE backup_policies DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'backup_jobs' AND indexname = 'idx_backup_jobs_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_backup_jobs_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_jobs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE backup_jobs DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_rules' AND indexname = 'idx_audit_rules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_audit_rules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE audit_rules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_reports' AND indexname = 'idx_audit_reports_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_audit_reports_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_reports' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE audit_reports DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_plans' AND indexname = 'idx_audit_plans_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_audit_plans_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_plans' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE audit_plans DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_findings' AND indexname = 'idx_audit_findings_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_audit_findings_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_findings' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE audit_findings DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_executions' AND indexname = 'idx_audit_executions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_audit_executions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_executions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE audit_executions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'artifact_tags' AND indexname = 'idx_artifact_tags_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_artifact_tags_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_tags' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE artifact_tags DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'artifact_scans' AND indexname = 'idx_artifact_scans_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_artifact_scans_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_scans' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE artifact_scans DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'artifact_promotions' AND indexname = 'idx_artifact_promotions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_artifact_promotions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_promotions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE artifact_promotions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'artifact_operations' AND indexname = 'idx_artifact_operations_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_artifact_operations_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_operations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE artifact_operations DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'artifact_downloads' AND indexname = 'idx_artifact_downloads_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_artifact_downloads_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artifact_downloads' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE artifact_downloads DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'approval_templates' AND indexname = 'idx_approval_templates_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_approval_templates_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_templates' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE approval_templates DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'approval_requests' AND indexname = 'idx_approval_requests_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_approval_requests_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE approval_requests DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'approval_levels' AND indexname = 'idx_approval_levels_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_approval_levels_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_levels' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE approval_levels DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'approval_history' AND indexname = 'idx_approval_history_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_approval_history_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE approval_history DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'approval_gates' AND indexname = 'idx_approval_gates_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_approval_gates_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_gates' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE approval_gates DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_market_subscriptions' AND indexname = 'idx_api_market_subscriptions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_market_subscriptions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_subscriptions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_market_subscriptions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_market_products' AND indexname = 'idx_api_market_products_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_market_products_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_products' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_market_products DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_market_keys' AND indexname = 'idx_api_market_keys_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_market_keys_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_keys' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_market_keys DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_market_apps' AND indexname = 'idx_api_market_apps_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_market_apps_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_market_apps' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_market_apps DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_keys' AND indexname = 'idx_api_keys_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_keys_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_keys DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_governance_violations' AND indexname = 'idx_api_governance_violations_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_governance_violations_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_violations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_governance_violations DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_governance_versions' AND indexname = 'idx_api_governance_versions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_governance_versions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_versions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_governance_versions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_governance_verification_history' AND indexname = 'idx_api_governance_verification_history_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_governance_verification_history_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_verification_history' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_governance_verification_history DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_governance_rules' AND indexname = 'idx_api_governance_rules_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_governance_rules_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_rules' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_governance_rules DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_governance_contracts' AND indexname = 'idx_api_governance_contracts_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_governance_contracts_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_governance_contracts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_governance_contracts DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_contracts' AND indexname = 'idx_api_contracts_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_contracts_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_contracts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_contracts DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'api_consumptions' AND indexname = 'idx_api_consumptions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_api_consumptions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_consumptions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE api_consumptions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'alerts' AND indexname = 'idx_alerts_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_alerts_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alerts DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'alert_topologies' AND indexname = 'idx_alert_topologies_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_alert_topologies_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_topologies' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alert_topologies DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'alert_node_health' AND indexname = 'idx_alert_node_health_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_alert_node_health_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_node_health' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alert_node_health DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'alert_maintenance_windows' AND indexname = 'idx_alert_maintenance_windows_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_alert_maintenance_windows_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_maintenance_windows' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alert_maintenance_windows DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'alert_known_issues' AND indexname = 'idx_alert_known_issues_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_alert_known_issues_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_known_issues' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE alert_known_issues DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ai_gateway_requests' AND indexname = 'idx_ai_gateway_requests_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ai_gateway_requests_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_gateway_requests' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ai_gateway_requests DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ai_decisions' AND indexname = 'idx_ai_decisions_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ai_decisions_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decisions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ai_decisions DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ai_decision_traces' AND indexname = 'idx_ai_decision_traces_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ai_decision_traces_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_traces' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ai_decision_traces DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ai_decision_feedback' AND indexname = 'idx_ai_decision_feedback_deleted_at'
  ) THEN
    DROP INDEX IF EXISTS idx_ai_decision_feedback_deleted_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_decision_feedback' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE ai_decision_feedback DROP COLUMN IF EXISTS deleted_at;
  END IF;
END $$;

SELECT 'Removed soft delete from 282 tables' AS migration_result;

COMMIT;
