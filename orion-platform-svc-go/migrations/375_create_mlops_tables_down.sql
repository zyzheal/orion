-- Reverse 375_create_mlops_tables.sql.
-- Drops 7 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS mlops_metrics CASCADE;
DROP TABLE IF EXISTS mlops_deployments CASCADE;
DROP TABLE IF EXISTS mlops_training_jobs CASCADE;
DROP TABLE IF EXISTS mlops_pipelines CASCADE;
DROP TABLE IF EXISTS mlops_artifacts CASCADE;
DROP TABLE IF EXISTS mlops_experiments CASCADE;
DROP TABLE IF EXISTS mlops_models CASCADE;
