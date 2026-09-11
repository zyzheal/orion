-- Auto-generated rollback for version 056. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_oncall_overrides_time_range";

DROP INDEX IF EXISTS "idx_oncall_assignments_time_range";

DROP INDEX IF EXISTS "idx_oncall_overrides_assignee_id";

DROP INDEX IF EXISTS "idx_oncall_overrides_schedule_id";

DROP INDEX IF EXISTS "idx_oncall_assignments_assignee_id";

DROP INDEX IF EXISTS "idx_oncall_assignments_schedule_id";
