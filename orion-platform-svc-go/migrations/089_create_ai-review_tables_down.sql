-- Auto-generated rollback for version 089. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_review_requests_created";

DROP INDEX IF EXISTS "idx_review_requests_tenant";
