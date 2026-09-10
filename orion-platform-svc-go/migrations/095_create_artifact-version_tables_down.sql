-- Rollback for version 095 (artifact-version).
-- WARNING: data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS idx_artifact_version_tags_record;
DROP INDEX IF EXISTS idx_artifact_version_records_tenant;
DROP INDEX IF EXISTS idx_artifact_version_records_created;
DROP INDEX IF EXISTS idx_artifact_version_records_status;

DROP TABLE IF EXISTS artifact_version_tags;
DROP TABLE IF EXISTS artifact_version_records;
