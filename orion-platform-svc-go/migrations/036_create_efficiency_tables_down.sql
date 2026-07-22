-- Auto-generated rollback for version 036. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_efficiency_recommendations_metric";

DROP INDEX IF EXISTS "idx_efficiency_recommendations_tenant";

DROP INDEX IF EXISTS "idx_efficiency_scores_date";

DROP INDEX IF EXISTS "idx_efficiency_scores_metric";

DROP INDEX IF EXISTS "idx_efficiency_metrics_scope";

DROP INDEX IF EXISTS "idx_efficiency_metrics_tenant";

DROP TABLE IF EXISTS "efficiency_recommendations" CASCADE;

DROP TABLE IF EXISTS "efficiency_scores" CASCADE;
