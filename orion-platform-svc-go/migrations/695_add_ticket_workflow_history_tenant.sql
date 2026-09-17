-- 695_add_ticket_workflow_history_tenant.sql
--
-- ticket_workflow_history was created by 076_create_ticketing_tables.sql without
-- a tenant_id column, yet every tenant-scoped repository method that touches it
-- already writes and filters on one:
--
--   internal/ticketing/repository/repository.go AddWorkflowHistory INSERTs
--     tenant_id and GetWorkflowHistory filters WHERE tenant_id=$1.
--
-- With no such column the driver rejects the whole statement, so the six routes
-- that reach those methods answered 500 from the driver instead of returning
-- data. Four of the six propagate the error (transition, assign, resolve,
-- close), which made the ticket lifecycle unwritable.
--
-- The column is added nullable on purpose: 693 and the other orphan-table
-- migrations ship schema whose writers are not yet mounted, and a NOT NULL
-- addition would fail on a database that already holds rows. Both writers are
-- fixed in the same change to populate it, so no new row lands NULL.
--
-- tenant_id is UUID to match tickets.tenant_id (076), the table this history
-- belongs to; migration 239 unified tenant ids to UUID.
--
-- Idempotent by construction (IF NOT EXISTS).

ALTER TABLE ticket_workflow_history
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

COMMENT ON COLUMN ticket_workflow_history.tenant_id IS
    'Tenant the workflow event belongs to; matches tickets.tenant_id';

CREATE INDEX IF NOT EXISTS idx_ticket_workflow_history_tenant_id
    ON ticket_workflow_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ticket_workflow_history_tenant_action
    ON ticket_workflow_history(tenant_id, action);
