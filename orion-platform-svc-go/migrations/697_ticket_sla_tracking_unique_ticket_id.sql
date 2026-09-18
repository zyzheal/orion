-- 697_ticket_sla_tracking_unique_ticket_id.sql
--
-- ticket_sla_tracking was created by 245_ticketing_schema_fixes.sql with a plain,
-- non-unique index on ticket_id:
--
--   CREATE INDEX IF NOT EXISTS idx_ticket_sla_tracking_ticket_id
--       ON ticket_sla_tracking(ticket_id);
--
-- repository.UpsertSLATracking issues
--
--   INSERT INTO ticket_sla_tracking (...) VALUES (...)
--     ON CONFLICT (ticket_id) DO UPDATE SET updated_at=$7 RETURNING <projection>
--
-- Postgres resolves the ON CONFLICT target against unique indexes and unique
-- constraints only. With nothing unique on ticket_id the driver rejects every
-- call before any row is inserted:
--
--   ERROR: there is no unique or exclusion constraint matching the
--           ON CONFLICT specification
--
-- Service.CreateTicket is the only caller, and it calls UpsertSLATracking after
-- the ticket row and the workflow history row are already committed, so every
-- POST /tickets answered 500 with a ticket that existed and an SLA row that did
-- not. The failure is invisible to go build and go vet: the statement is well
-- formed and only Postgres knows there is no conflict target.
--
-- 571 added deleted_at to this table, so the constraint deliberately covers
-- every row rather than only live ones; checked first and nothing in the
-- codebase writes deleted_at for ticket_sla_tracking, so no soft-deleted row can
-- shadow a live one.
--
-- The duplicates an earlier run may have accumulated are collapsed first. Each
-- group is one ticket created more than once, so the newest physical row is kept
-- and the rest are deleted. ctid is stable for a row lifetime, which makes the
-- comparison deterministic without a tie-breaking column. Those deleted rows are
-- the only data this migration removes; they were leftovers of upserts that could
-- never have succeeded, so the rollback has nothing to restore.
--
-- ticket_id is VARCHAR(255) and holds the UUID string of tickets.id, which is how
-- the repository passes it. No foreign key is added, so the type mismatch between
-- VARCHAR and UUID stays out of this migration.

DELETE FROM ticket_sla_tracking a
USING ticket_sla_tracking b
WHERE a.ticket_id = b.ticket_id
  AND a.ctid < b.ctid;

ALTER TABLE ticket_sla_tracking
    ADD CONSTRAINT uq_ticket_sla_tracking_ticket_id UNIQUE (ticket_id);

COMMENT ON CONSTRAINT uq_ticket_sla_tracking_ticket_id ON ticket_sla_tracking IS
    'One SLA tracking row per ticket; required by UpsertSLATracking ON CONFLICT (ticket_id)';
