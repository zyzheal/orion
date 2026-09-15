-- Policy module: the one relation the repository names that no migration created.
--
-- Migration 060_create_policy_tables.sql creates policies, policy_evaluations,
-- policy_violations, policy_overrides, policy_bundles and policy_exemptions.
-- It does NOT create policy_definitions. The policy repository reads and writes
-- policy_definitions for every definition method (CreatePolicy, GetPolicy,
-- ListPolicies, UpdatePolicy, DeletePolicy, TogglePolicy), so before this
-- migration all 25 registered /policies routes failed at the SQL layer with
-- `pq: relation "policy_definitions" does not exist` before any business logic
-- could run.
--
-- 060's `policies` table is not renamed. `grep -rn 'policy_definitions'
-- migrations/` returned zero matches, and 060's `policies` is the relation the
-- later migrations own: 239 casts its tenant_id to UUID, 570 adds fk_policies_tenant
-- and fk_policies_user, and 572 adds created_by and updated_by. Shadowing it
-- would leave those migrations altering an empty relation.
--
-- The column list is exactly the eight db tags on models.Policy. 060 gives
-- policies a `created_at TIMESTAMP WITH TIME ZONE NOT NULL` with no default, so
-- the repository sets created_at and updated_at in Go rather than relying on
-- NOW(); this table follows the same shape instead of inventing a different one.
--
-- description and rego default to '' because models.Policy declares them as
-- plain strings: scanning a SQL NULL into a Go string fails the whole read, and
-- EvaluatePolicy returns policy.Rego straight to the caller for the disabled
-- branch, where an empty string is the meaningful answer.
--
-- enabled defaults to TRUE because a policy that is stored but never evaluated
-- is the more surprising state than the one the module already documents for
-- 060's table, and CreatePolicyRequest.Enabled is a bool that a client omits
-- when it wants the default.

CREATE TABLE IF NOT EXISTS policy_definitions (
    id          VARCHAR(36)  PRIMARY KEY,
    tenant_id   VARCHAR(128) NOT NULL,
    name        VARCHAR(512) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    rego        TEXT         NOT NULL DEFAULT '',
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL
);

-- ListPolicies is the only reader that sorts, and it sorts by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_policy_definitions_tenant ON policy_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_definitions_enabled ON policy_definitions(enabled);
CREATE INDEX IF NOT EXISTS idx_policy_definitions_created ON policy_definitions(created_at DESC);
