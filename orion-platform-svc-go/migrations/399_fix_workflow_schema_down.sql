-- Reverse 399_fix_workflow_schema.sql.
-- Drops 4 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS workflow_instances CASCADE;
DROP TABLE IF EXISTS workflow_definitions CASCADE;
DROP TABLE IF EXISTS workflow_runs CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
