-- Auto-generated rollback for version 037. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- Fixed: trigger + function cleanup (auto-generator had left CREATE body in down file)
DROP TRIGGER IF EXISTS trigger_update_event_triggers_updated_at ON event_triggers;
DROP FUNCTION IF EXISTS update_event_triggers_updated_at();

DROP INDEX IF EXISTS "idx_event_triggers_event_type";
DROP INDEX IF EXISTS "idx_event_triggers_tenant_id";
