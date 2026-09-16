-- Reverse 367_create_execution_modes.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS execution_modes CASCADE;
