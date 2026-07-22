-- Auto-generated rollback for version 072. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_sprint_tickets_sort_order";

DROP INDEX IF EXISTS "idx_sprint_tickets_status";

DROP INDEX IF EXISTS "idx_sprint_tickets_ticket_id";

DROP INDEX IF EXISTS "idx_sprint_tickets_sprint_id";

DROP INDEX IF EXISTS "idx_sprint_tickets_tenant_id";

DROP TABLE IF EXISTS "sprint_tickets" CASCADE;

DROP INDEX IF EXISTS "idx_sprints_status";

DROP INDEX IF EXISTS "idx_sprints_tenant_id";
