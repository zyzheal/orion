-- Auto-generated rollback for version 002. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- REVIEW: unknown or non-reversible statement:
--   application handles this.

DROP INDEX IF EXISTS "idx_ticketing_dispatch_weights_tenant_id";

DROP INDEX IF EXISTS "idx_ticket_assignments_assignee";

DROP INDEX IF EXISTS "idx_ticket_assignments_ticket_id";

DROP INDEX IF EXISTS "idx_ticket_assignments_tenant_id";

DROP INDEX IF EXISTS "idx_ticket_sla_tracking_breached";

DROP INDEX IF EXISTS "idx_ticket_sla_tracking_ticket_id";

DROP INDEX IF EXISTS "idx_ticket_sla_breaches_tenant_id";

DROP INDEX IF EXISTS "idx_ticket_transfers_tenant_id";

DROP INDEX IF EXISTS "idx_tickets_sla_policy_id";
