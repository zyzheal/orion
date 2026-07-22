-- Rollback Migration 135: Artifact Version Tracking and Traceability (GAP-CN-06)

DROP INDEX IF EXISTS idx_artifact_version_tracking_tenant_branch;
DROP INDEX IF EXISTS idx_artifact_version_tracking_commit_sha;
DROP INDEX IF EXISTS idx_artifact_version_tracking_run_id;
DROP INDEX IF EXISTS idx_artifact_version_tracking_pipeline_version;
DROP TABLE IF EXISTS artifact_version_tracking;
