-- Reverse 369_create_test_execution_tables.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS test_cases CASCADE;
DROP TABLE IF EXISTS test_executions CASCADE;
