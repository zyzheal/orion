-- Auto-generated rollback for version 051. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_library_dependents_unique";

DROP INDEX IF EXISTS "idx_library_dependents_library_id";

DROP INDEX IF EXISTS "idx_library_versions_unique";

DROP INDEX IF EXISTS "idx_library_versions_library_id";

DROP INDEX IF EXISTS "idx_internal_libraries_owner";

DROP INDEX IF EXISTS "idx_internal_libraries_language";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "annotations";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "labels";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "quality_security_score";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "quality_test_coverage";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "dependents_total";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "latest_stable_version";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "current_version";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "documentation";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "repository";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "owner";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "status";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "language";

ALTER TABLE "internal_libraries" DROP COLUMN IF EXISTS "description";
