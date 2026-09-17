-- 696_add_ticket_relation_transfer_columns.sql
--
-- 076_create_ticketing_tables.sql creates ticket_relations and ticket_transfers
-- with a much narrower shape than the live internal/ticket repositories write:
--
--   internal/ticket/repository/relation.go Create INSERTs
--     related_ticket_id, relation_type, created_by, description, confidence;
--     ListByTicket / Exists / FindSimilar read related_ticket_id and
--     relation_type and ORDER BY confidence.
--
--   internal/ticket/repository/transfer.go Create INSERTs
--     from_engineer_id, to_engineer_id, initiated_by, reason, hold_duration_ms;
--     GetStats reads AVG(hold_duration_ms) and GROUP BY to_engineer_id.
--
-- Two of those names are just stale aliases of 076's own columns (the code is
-- fixed to write 076's names, no schema change needed):
--
--     related_ticket_id -> related_id      relation_type -> type
--     from_engineer_id  -> from_user_id    to_engineer_id  -> to_user_id
--
-- The remaining four have no home in 076 at all, and they are not optional:
-- POST /api/v1/tickets/:id/relations takes description and confidence from the
-- body, GET .../related filters on confidence, and POST /api/v1/tickets/:id/
-- transfer requires initiated_by with binding:"required" while returning
-- hold_duration_ms in the response. Without the columns every one of those
-- calls fails in the driver.
--
-- They are added nullable on purpose: 076's earlier rows already exist and have
-- none of these values, and a NOT NULL addition would fail on a populated
-- database. confidence defaults to 0 so a hand-written row still sorts at the
-- bottom of FindSimilar's ORDER BY confidence DESC.
--
-- No tenant_id is added: no repository method in internal/ticket takes a tenant
-- id for these two tables, so a NOT NULL column would turn every legal insert
-- into a constraint failure. Precedent is
-- 686_create_ticket_domain_missing_tables.sql.
--
-- 076 declares ticket_relations.tenant_id NOT NULL with no default, which makes
-- the same call fatal today. It is relaxed to nullable rather than rewritten:
-- the repository signatures (Create / ListByTicket / Exists / FindSimilar)
-- carry no tenant id and the handlers never read one, so threading it through
-- is a tenant-scope change, not a column fix. Ticket_transfers has no
-- tenant_id at all, so only relations need this. Adding a nullable column would
-- be pointless here — the column already exists and is simply required.
--
-- Idempotent by construction (IF NOT EXISTS; DROP NOT NULL is a no-op when the
-- constraint is already gone).

ALTER TABLE ticket_relations
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE ticket_relations
    ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN ticket_relations.description IS
    'Free-text explanation of why the two tickets are related';
COMMENT ON COLUMN ticket_relations.confidence IS
    '0..1 confidence the relation was detected or asserted with';

ALTER TABLE ticket_transfers
    ADD COLUMN IF NOT EXISTS initiated_by VARCHAR(255);

ALTER TABLE ticket_transfers
    ADD COLUMN IF NOT EXISTS hold_duration_ms BIGINT;

COMMENT ON COLUMN ticket_transfers.initiated_by IS
    'User or system that initiated the transfer; matches transfer_service.go';
COMMENT ON COLUMN ticket_transfers.hold_duration_ms IS
    'Milliseconds the ticket was held during the transfer';

ALTER TABLE ticket_relations ALTER COLUMN tenant_id DROP NOT NULL;
