-- Reverse 380_create_process_step_events_and_condition_tables.sql.
-- Drops 4 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS condition_expressions CASCADE;
DROP TABLE IF EXISTS condition_groups CASCADE;
DROP TABLE IF EXISTS process_step_executions CASCADE;
DROP TABLE IF EXISTS process_step_events CASCADE;
