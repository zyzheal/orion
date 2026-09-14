-- Migration 582: capability mapping tables and the missing columns the
-- capability repository already references.
--
-- internal/capability was dead at the SQL layer, not at the code layer. Every
-- one of the 34 statements in internal/capability/repository/repository.go
-- was executed against PostgreSQL 16.14 during review and none of them
-- succeeded except two no-ops. Three whole tables that the repository writes
-- to had no runnable DDL anywhere in migrations/, and eleven columns it
-- reads or writes had never been created. Verified server errors, verbatim:
--
--   pq: relation "command_capability_mappings" does not exist
--   pq: relation "capability_role_mappings" does not exist
--   pq: relation "capability_user_mappings" does not exist
--   pq: column "capability_id" of relation "capabilities" does not exist
--   pq: column "parent_capability_id" of relation "capabilities" does not exist
--   pq: column "revoked" of relation "temporary_permissions" does not exist
--   pq: column "duration_hours" of relation "permission_requests" does not exist
--   pq: column "approver_id" of relation "permission_requests" does not exist
--   pq: column "rejected_by" of relation "permission_requests" does not exist
--   pq: column "target_type" of relation "permission_audit_logs" does not exist
--
-- Without the three mapping tables CheckPermission could only ever answer
-- true through a temporary permission: role grants and direct user grants
-- were unreachable, so a role-based authorisation system that cannot grant
-- by role.
--
-- What this file does NOT add:
--   * temporary_permissions.revoked. The table already has revoked_at
--     TIMESTAMPTZ, so "revoked" is expressible without a second column. The
--     repository now predicates on revoked_at IS NULL and stamps
--     revoked_at = NOW(), which is the existing schema's own revocation
--     column. Adding a boolean would have created two competing sources of
--     truth for one fact.
--   * temporary_permissions.updated_at. The repository's revoke statement
--     referenced it, but the column was never created by any migration.
--     revoking a temporary permission is a single-column write, so the
--     honest fix is to stop referencing a column that does not exist rather
--     than to create one for it.
--   * permission_audit_logs.target_type / target_id / details. InsertAuditLog
--     wrote those three, and permission_audit_logs does not have them -- but
--     capability_audit_logs does, exactly, so the bug was the table name and
--     the fix is to write to capability_audit_logs. Adding the columns to the
--     wrong table would have made the code look right while still not
--     recording where the audit events were meant to be read from.
--   * capabilities.capability_id. GetByCapabilityID and
--     GetCapabilityForPermissionRequest both filtered on it, and both had
--     zero callers -- the service resolves a capability by id everywhere
--     through verifyCapabilityExists -> GetByID. They were deleted rather
--     than given a column: creating capabilities.capability_id would have
--     made a second, empty identifier live and ambiguous with id.
--
-- environment_suffix is NOT NULL DEFAULT '' on the two tables that own it.
-- A nullable column under a plain UNIQUE constraint treats every NULL as
-- distinct, so ON CONFLICT ... DO NOTHING would never have fired for a
-- generic (no-environment) mapping and a second insert of the same command
-- would create a duplicate row. SELECT capability_id ... for that duplicate
-- pair then fails in the repository with "sql: multiple rows returned" -- a
-- regression this migration would otherwise have introduced. The repository
-- normalises a nil suffix to '' so the upsert is deterministic.
--
-- The runner already wraps each file in its own transaction, so a literal
-- BEGIN;/COMMIT; here would commit the runner's transaction early and make
-- tx.Commit() fail with 'pq: unexpected transaction status idle'.

-- --- mapping tables: command -> capability ---

CREATE TABLE IF NOT EXISTS command_capability_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    capability_id VARCHAR(255) NOT NULL,
    command_name VARCHAR(255) NOT NULL,
    command_action VARCHAR(255) NOT NULL,
    environment_suffix VARCHAR(64) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One generic mapping per command+action, plus one per environment suffix.
-- environment_suffix is NOT NULL so the unique constraint applies to a
-- generic mapping as well; see the note above.
CREATE UNIQUE INDEX IF NOT EXISTS uq_command_capability_mappings_key
    ON command_capability_mappings(tenant_id, command_name, command_action, environment_suffix);
CREATE INDEX IF NOT EXISTS idx_command_capability_mappings_capability
    ON command_capability_mappings(tenant_id, capability_id);

-- --- mapping tables: role -> capability ---

CREATE TABLE IF NOT EXISTS capability_role_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    capability_id VARCHAR(255) NOT NULL,
    role_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_capability_role_mappings_key
    ON capability_role_mappings(tenant_id, capability_id, role_name);
CREATE INDEX IF NOT EXISTS idx_capability_role_mappings_role
    ON capability_role_mappings(tenant_id, role_name);

-- --- mapping tables: user -> capability (direct grant) ---

CREATE TABLE IF NOT EXISTS capability_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    capability_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    granted_by VARCHAR(255),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_capability_user_mappings_key
    ON capability_user_mappings(tenant_id, capability_id, user_id);
CREATE INDEX IF NOT EXISTS idx_capability_user_mappings_user
    ON capability_user_mappings(tenant_id, user_id);

-- --- hierarchy column on capabilities ---

-- The repository's ListRoot / ListByParent / HasChildren already filtered on
-- parent_capability_id, but no migration created it, so the capability tree
-- endpoint was a 500 and the hierarchy could not be built at all.
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS parent_capability_id UUID;

CREATE INDEX IF NOT EXISTS idx_capabilities_parent ON capabilities(tenant_id, parent_capability_id);

-- --- permission_requests: the fields the workflow writes ---

-- duration_hours and environment_suffix are the fields CreatePermissionRequest
-- wrote, so a request record could never be inserted -- the whole request
-- lifecycle was unreachable. approver_id / rejected_by / rejected_reason are
-- the fields the approve and reject statements set.
ALTER TABLE permission_requests ADD COLUMN IF NOT EXISTS duration_hours INTEGER;
ALTER TABLE permission_requests ADD COLUMN IF NOT EXISTS environment_suffix VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE permission_requests ADD COLUMN IF NOT EXISTS approver_id VARCHAR(255);
ALTER TABLE permission_requests ADD COLUMN IF NOT EXISTS rejected_by VARCHAR(255);
ALTER TABLE permission_requests ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(tenant_id, status);

-- temporary_permissions.environment_suffix was nullable with no default, and
-- the repository writes '' for a generic grant. Backfill any NULL rows and
-- make the column NOT NULL so reading it into a plain string field can never
-- hit a NULL-to-string scan error.
UPDATE temporary_permissions SET environment_suffix = '' WHERE environment_suffix IS NULL;
ALTER TABLE temporary_permissions ALTER COLUMN environment_suffix SET DEFAULT '';
ALTER TABLE temporary_permissions ALTER COLUMN environment_suffix SET NOT NULL;
