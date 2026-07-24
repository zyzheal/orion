-- Auto-generated rollback for version 037. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- REVIEW: unknown or non-reversible statement:
--   CREATE OR REPLACE FUNCTION update_event_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW()
-- REVIEW: unknown or non-reversible statement:
--   RETURN NEW
-- REVIEW: unknown or non-reversible statement:
--   END
-- REVIEW: unknown or non-reversible statement:
--   $$ LANGUAGE plpgsql
-- REVIEW: unknown or non-reversible statement:
--   CREATE TRIGGER trigger_update_event_triggers_updated_at
    BEFORE UPDATE ON event_triggers
    FOR EACH ROW
    EXECUTE FUNCTION update_event_triggers_updated_at()

DROP INDEX IF EXISTS "idx_event_triggers_event_type";

DROP INDEX IF EXISTS "idx_event_triggers_tenant_id";
