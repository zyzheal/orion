-- Reverse 696_add_ticket_relation_transfer_columns.sql.
--
-- SET NOT NULL is the exact inverse of the forward relaxation. It fails if any
-- ticket_relations row now has a NULL tenant_id, which is the correct signal:
-- the data no longer satisfies the constraint the forward migration removed.

ALTER TABLE ticket_transfers DROP COLUMN IF EXISTS hold_duration_ms;
ALTER TABLE ticket_transfers DROP COLUMN IF EXISTS initiated_by;

ALTER TABLE ticket_relations DROP COLUMN IF EXISTS confidence;
ALTER TABLE ticket_relations DROP COLUMN IF EXISTS description;

ALTER TABLE ticket_relations ALTER COLUMN tenant_id SET NOT NULL;
