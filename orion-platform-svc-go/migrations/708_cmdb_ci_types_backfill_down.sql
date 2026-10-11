-- Migration 708 down: Undo backfill (nullable column, so just NULL out type_id)
--
-- Note: This does NOT delete the cmdb_ci_types rows created by Migration 708.
-- Reason: those rows may have been manually edited/extended by users after
-- the initial backfill; dropping them would lose user-defined attributes.
-- If full rollback is required (e.g., reverting to pre-ADR-013 state), the
-- operator should manually decide which types to keep/delete, then run
-- Migration 706 down to drop the table.
--
-- This down only NULLs type_id, which is the actual "state change" from
-- the backfill. The FK relationship is preserved but dereferenced.

BEGIN;

UPDATE cmdb_cis SET type_id = NULL, updated_at = NOW()
WHERE type_id IS NOT NULL;

COMMIT;
