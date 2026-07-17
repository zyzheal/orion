-- Auto-generated rollback for version 076. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_ticket_automation_rules_trigger";

DROP INDEX IF EXISTS "idx_ticket_automation_rules_enabled";

DROP INDEX IF EXISTS "idx_ticket_automation_rules_tenant_id";

DROP TABLE IF EXISTS "ticket_automation_rules" CASCADE;

DROP INDEX IF EXISTS "idx_ticket_sla_breaches_type";

DROP INDEX IF EXISTS "idx_ticket_sla_breaches_ticket_id";

DROP TABLE IF EXISTS "ticket_sla_breaches" CASCADE;

DROP INDEX IF EXISTS "idx_ticket_sla_policies_active";

DROP INDEX IF EXISTS "idx_ticket_sla_policies_tenant_id";

DROP TABLE IF EXISTS "ticket_sla_policies" CASCADE;

DROP INDEX IF EXISTS "idx_ticket_suspends_status";

DROP INDEX IF EXISTS "idx_ticket_suspends_engineer_id";

DROP INDEX IF EXISTS "idx_ticket_suspends_tenant_id";

DROP TABLE IF EXISTS "ticket_suspends" CASCADE;

DROP INDEX IF EXISTS "idx_ticket_transfers_created_at";

DROP INDEX IF EXISTS "idx_ticket_transfers_ticket_id";

DROP TABLE IF EXISTS "ticket_transfers" CASCADE;

DROP INDEX IF EXISTS "idx_ticket_dispatch_rules_enabled";

DROP INDEX IF EXISTS "idx_ticket_dispatch_rules_tenant_id";

DROP TABLE IF EXISTS "ticket_dispatch_rules" CASCADE;

DROP INDEX IF EXISTS "idx_ticket_dispatch_engineers_is_active";

DROP INDEX IF EXISTS "idx_ticket_dispatch_engineers_user_id";

DROP INDEX IF EXISTS "idx_ticket_dispatch_engineers_tenant_id";

DROP TABLE IF EXISTS "ticket_dispatch_engineers" CASCADE;

DROP INDEX IF EXISTS "idx_ticket_sla_targets_priority";

DROP INDEX IF EXISTS "idx_ticket_sla_targets_tenant_id";

DROP TABLE IF EXISTS "ticket_sla_targets" CASCADE;

DROP INDEX IF EXISTS "idx_ticket_assignment_rules_enabled";

DROP INDEX IF EXISTS "idx_ticket_assignment_rules_tenant_id";

DROP TABLE IF EXISTS "ticket_assignment_rules" CASCADE;

DROP INDEX IF EXISTS "idx_ticket_relations_type";

DROP INDEX IF EXISTS "idx_ticket_relations_related_id";

DROP INDEX IF EXISTS "idx_ticket_relations_ticket_id";

DROP INDEX IF EXISTS "idx_ticket_relations_tenant_id";

DROP TABLE IF EXISTS "ticket_relations" CASCADE;

DROP INDEX IF EXISTS "idx_ticket_workflow_history_created_at";

DROP INDEX IF EXISTS "idx_ticket_workflow_history_ticket_id";

DROP TABLE IF EXISTS "ticket_workflow_history" CASCADE;

DROP INDEX IF EXISTS "idx_tickets_created_at";

DROP INDEX IF EXISTS "idx_tickets_reporter_id";

DROP INDEX IF EXISTS "idx_tickets_assignee_id";

DROP INDEX IF EXISTS "idx_tickets_category";

DROP INDEX IF EXISTS "idx_tickets_priority";

DROP INDEX IF EXISTS "idx_tickets_status";

DROP INDEX IF EXISTS "idx_tickets_tenant_id";
