-- 697_ticket_sla_tracking_unique_ticket_id_down.sql
--
-- Remove the unique constraint the up migration added so UpsertSLATracking goes
-- back to failing on every call.
--
-- No data needs restoring. The up migration deleted the duplicate rows it had
-- collapsed, and those rows were leftovers of upserts that could never have
-- succeeded, so nothing live is lost by rolling back.
--
-- IF EXISTS keeps the rollback idempotent for a database that never ran 697.

ALTER TABLE ticket_sla_tracking
    DROP CONSTRAINT IF EXISTS uq_ticket_sla_tracking_ticket_id;
