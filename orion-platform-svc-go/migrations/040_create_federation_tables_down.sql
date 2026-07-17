-- Auto-generated rollback for version 040. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_federated_clusters_tenant";

DROP TABLE IF EXISTS "federated_clusters" CASCADE;
