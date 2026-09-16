-- Reverse 371_create_statistics_tables.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS statistics CASCADE;
