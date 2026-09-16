-- ticket_automation module table: automation rule registry
-- Migration 687
--
-- internal/ticket-automation/repository issues five statements against
-- ticket_automation (Create / GetByID / List / Update / Delete) and the module
-- is live: cmd/server/blueprint_batch_wiring.go builds repo -> service ->
-- handler and cmd/server/router.go registers its five routes
--   GET    /api/v1/ticket-automation
--   POST   /api/v1/ticket-automation
--   GET    /api/v1/ticket-automation/:id
--   PUT    /api/v1/ticket-automation/:id
--   DELETE /api/v1/ticket-automation/:id
-- No migration ever created the table, so all five routes failed at the driver
-- with `relation "ticket_automation" does not exist`. The repository also used
-- to write the identifier as `ticket-automation` (hyphen); postgres rejects a
-- hyphenated unquoted identifier as a syntax error before name resolution, so
-- even a correctly named table would not have saved the module. Both are fixed.
--
-- Column shapes mirror 377_create_incident_actions_table.sql, which is the same
-- module family (the repository code is byte-identical apart from the table
-- name). VARCHAR(36) is sufficient because Create binds uuid.New().String().
-- value stays nullable: the handler enforces binding:"required" on value, so a
-- default here would only hide a caller bug rather than fix one.
--
-- created_at / updated_at carry DEFAULT NOW() on purpose: Update never writes
-- them through the caller path (the repository stamps updated_at itself), and a
-- NOT NULL column without a default would 500 on any caller that omits it.

CREATE TABLE IF NOT EXISTS ticket_automation (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_automation_tenant ON ticket_automation(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_automation_enabled ON ticket_automation(tenant_id, enabled);
