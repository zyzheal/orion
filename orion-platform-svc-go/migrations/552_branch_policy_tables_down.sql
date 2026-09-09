-- Rollback: P0-MB multi-branch strategy tables
-- Created: 2026-09-09
--
-- Drop order follows dependency order (children before parents):
-- merge_previews / deploy_events / sync_run_logs / sync_policies /
-- namespace_bindings / build_artifacts / branch_profiles.

DROP INDEX IF EXISTS idx_merge_previews_source_target;
DROP INDEX IF EXISTS idx_merge_previews_tenant;
DROP TABLE IF EXISTS merge_previews;

DROP INDEX IF EXISTS idx_deploy_events_started_at;
DROP INDEX IF EXISTS idx_deploy_events_outcome;
DROP INDEX IF EXISTS idx_deploy_events_actor;
DROP INDEX IF EXISTS idx_deploy_events_env;
DROP INDEX IF EXISTS idx_deploy_events_branch;
DROP INDEX IF EXISTS idx_deploy_events_tenant;
DROP TABLE IF EXISTS deploy_events;

DROP INDEX IF EXISTS idx_sync_run_logs_triggered_at;
DROP INDEX IF EXISTS idx_sync_run_logs_status;
DROP INDEX IF EXISTS idx_sync_run_logs_policy;
DROP INDEX IF EXISTS idx_sync_run_logs_tenant;
DROP TABLE IF EXISTS sync_run_logs;

DROP INDEX IF EXISTS idx_sync_policies_source;
DROP INDEX IF EXISTS idx_sync_policies_enabled;
DROP INDEX IF EXISTS idx_sync_policies_tenant;
DROP TABLE IF EXISTS sync_policies;

DROP INDEX IF EXISTS idx_ns_bindings_env;
DROP INDEX IF EXISTS idx_ns_bindings_branch_profile;
DROP INDEX IF EXISTS idx_ns_bindings_tenant;
DROP TABLE IF EXISTS namespace_bindings;

DROP INDEX IF EXISTS idx_build_artifacts_status;
DROP INDEX IF EXISTS idx_build_artifacts_commit;
DROP INDEX IF EXISTS idx_build_artifacts_branch;
DROP INDEX IF EXISTS idx_build_artifacts_branch_profile;
DROP INDEX IF EXISTS idx_build_artifacts_tenant;
DROP TABLE IF EXISTS build_artifacts;

DROP INDEX IF EXISTS idx_branch_profiles_status;
DROP INDEX IF EXISTS idx_branch_profiles_semantic;
DROP INDEX IF EXISTS idx_branch_profiles_repo;
DROP INDEX IF EXISTS idx_branch_profiles_tenant;
DROP TABLE IF EXISTS branch_profiles;
