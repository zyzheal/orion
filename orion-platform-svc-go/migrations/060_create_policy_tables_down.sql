-- Auto-generated rollback for version 060. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_policy_exemptions_category";

DROP INDEX IF EXISTS "idx_policy_exemptions_status";

DROP INDEX IF EXISTS "idx_policy_exemptions_policy_id";

DROP INDEX IF EXISTS "idx_policy_exemptions_violation_id";

DROP INDEX IF EXISTS "idx_policy_exemptions_tenant_id";

DROP TABLE IF EXISTS "policy_exemptions" CASCADE;

DROP INDEX IF EXISTS "idx_policy_bundles_status";

DROP INDEX IF EXISTS "idx_policy_bundles_tenant_id";

DROP TABLE IF EXISTS "policy_bundles" CASCADE;

DROP INDEX IF EXISTS "idx_policy_overrides_expires_at";

DROP INDEX IF EXISTS "idx_policy_overrides_resource_id";

DROP INDEX IF EXISTS "idx_policy_overrides_policy_id";

DROP INDEX IF EXISTS "idx_policy_overrides_tenant_id";

DROP TABLE IF EXISTS "policy_overrides" CASCADE;

DROP INDEX IF EXISTS "idx_policy_violations_severity";

DROP INDEX IF EXISTS "idx_policy_violations_status";

DROP INDEX IF EXISTS "idx_policy_violations_policy_id";

DROP INDEX IF EXISTS "idx_policy_violations_tenant_id";

DROP TABLE IF EXISTS "policy_violations" CASCADE;

DROP INDEX IF EXISTS "idx_policy_evaluations_created_at";

DROP INDEX IF EXISTS "idx_policy_evaluations_decision";

DROP INDEX IF EXISTS "idx_policy_evaluations_policy_id";

DROP INDEX IF EXISTS "idx_policy_evaluations_tenant_id";

DROP TABLE IF EXISTS "policy_evaluations" CASCADE;

DROP INDEX IF EXISTS "idx_policies_enabled";

DROP INDEX IF EXISTS "idx_policies_tenant_id";
