-- Reverse 695_add_ticket_workflow_history_tenant.sql.

DROP INDEX IF EXISTS idx_ticket_workflow_history_tenant_action;
DROP INDEX IF EXISTS idx_ticket_workflow_history_tenant_id;

ALTER TABLE ticket_workflow_history DROP COLUMN IF EXISTS tenant_id;
