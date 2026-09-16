-- Reverse 368_create_release_management_tables.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS releases CASCADE;
