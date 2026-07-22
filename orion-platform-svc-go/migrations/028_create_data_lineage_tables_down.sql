-- Auto-generated rollback for version 028. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_lineage_relationships_lineage";

DROP INDEX IF EXISTS "idx_lineage_nodes_lineage";

DROP INDEX IF EXISTS "idx_data_lineages_tenant";

DROP TABLE IF EXISTS "lineage_relationships" CASCADE;

DROP TABLE IF EXISTS "lineage_nodes" CASCADE;
