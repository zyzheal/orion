-- Reverse 373_create_test_suites_table.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS test_suites CASCADE;
