-- Reverse 691_create_cicd_orphan_tables.sql.
-- Drops the 10 ci-cd-domain orphan tables and their indexes.

DROP INDEX IF EXISTS idx_task_executions_status;
DROP INDEX IF EXISTS idx_task_executions_exec;
DROP TABLE IF EXISTS task_executions;

DROP INDEX IF EXISTS idx_stage_executions_status;
DROP INDEX IF EXISTS idx_stage_executions_run;
DROP TABLE IF EXISTS stage_executions;

DROP INDEX IF EXISTS idx_runners_status;
DROP INDEX IF EXISTS idx_runners_tenant;
DROP TABLE IF EXISTS runners;

DROP INDEX IF EXISTS idx_deployment_events_deploy;
DROP TABLE IF EXISTS deployment_events;

DROP INDEX IF EXISTS idx_deploy_progressive_stage;
DROP INDEX IF EXISTS idx_deploy_progressive_tenant;
DROP TABLE IF EXISTS deploy_progressive_stages;

DROP INDEX IF EXISTS idx_deploy_emergencies_status;
DROP INDEX IF EXISTS idx_deploy_emergencies_tenant;
DROP TABLE IF EXISTS deploy_emergencies;

DROP INDEX IF EXISTS idx_builder_images_type;
DROP INDEX IF EXISTS idx_builder_images_name;
DROP TABLE IF EXISTS builder_images;

DROP INDEX IF EXISTS idx_artifact_versions_status;
DROP INDEX IF EXISTS idx_artifact_versions_tenant;
DROP TABLE IF EXISTS artifact_versions;

DROP INDEX IF EXISTS idx_artifact_entries_name_ver;
DROP INDEX IF EXISTS idx_artifact_entries_registry;
DROP TABLE IF EXISTS artifact_entries;

DROP INDEX IF EXISTS idx_artifact_registries_tenant;
DROP TABLE IF EXISTS artifact_registries;