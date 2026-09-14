-- Migration 582 rollback: capability mapping tables and the columns the
-- capability repository references.
--
-- Reverse of 582_create_capability_tables.sql. All three mapping tables are
-- owned by internal/capability alone, so dropping them loses nothing from
-- another module. The mapping tables go first, then the columns: the order
-- mirrors the forward dependency direction and the runner applies this
-- inside its own transaction.

DROP TABLE IF EXISTS capability_user_mappings;
DROP TABLE IF EXISTS capability_role_mappings;
DROP TABLE IF EXISTS command_capability_mappings;

DROP INDEX IF EXISTS idx_capabilities_parent;
ALTER TABLE capabilities DROP COLUMN IF EXISTS parent_capability_id;

DROP INDEX IF EXISTS idx_permission_requests_status;
ALTER TABLE permission_requests DROP COLUMN IF EXISTS rejected_reason;
ALTER TABLE permission_requests DROP COLUMN IF EXISTS rejected_by;
ALTER TABLE permission_requests DROP COLUMN IF EXISTS approver_id;
ALTER TABLE permission_requests DROP COLUMN IF EXISTS environment_suffix;
ALTER TABLE permission_requests DROP COLUMN IF EXISTS duration_hours;

-- Restore the original nullability and drop the default the forward
-- migration set, so temporary_permissions returns to its pre-582 shape.
ALTER TABLE temporary_permissions ALTER COLUMN environment_suffix DROP NOT NULL;
ALTER TABLE temporary_permissions ALTER COLUMN environment_suffix DROP DEFAULT;
