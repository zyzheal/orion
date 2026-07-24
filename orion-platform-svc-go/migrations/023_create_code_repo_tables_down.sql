-- Auto-generated rollback for version 023. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_webhooks_secrets_tenant_id";

DROP TABLE IF EXISTS "webhooks_secrets" CASCADE;

DROP INDEX IF EXISTS "idx_comments_pr_id";

DROP INDEX IF EXISTS "idx_comments_tenant_id";

DROP TABLE IF EXISTS "comments" CASCADE;

DROP INDEX IF EXISTS "idx_reviews_pr_id";

DROP INDEX IF EXISTS "idx_reviews_tenant_id";

DROP TABLE IF EXISTS "reviews" CASCADE;

DROP INDEX IF EXISTS "idx_pull_requests_state";

DROP INDEX IF EXISTS "idx_pull_requests_tenant_id";

DROP TABLE IF EXISTS "pull_requests" CASCADE;

DROP INDEX IF EXISTS "idx_code_repos_tenant_id";

DROP TABLE IF EXISTS "code_repos" CASCADE;

DROP INDEX IF EXISTS "idx_code_repo_adapters_tenant_id";
