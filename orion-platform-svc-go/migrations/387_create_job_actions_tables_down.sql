-- Reverse 387_create_job_actions_tables.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS job_action_executions CASCADE;
DROP TABLE IF EXISTS job_actions CASCADE;
